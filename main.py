import asyncio
import base64
import glob
import hashlib
import json
import os
import random
import shutil
import ssl
import threading
import time
import urllib.parse
import urllib.request
import zipfile

import re

try:
    import decky
except ImportError:
    class DummyDecky:
        DECKY_PLUGIN_DIR = os.path.dirname(os.path.abspath(__file__))
        DECKY_PLUGIN_SETTINGS_DIR = "/tmp"
        DECKY_USER_HOME = os.path.expanduser("~")
        class logger:
            @staticmethod
            def info(msg): print("[INFO]", msg)
            @staticmethod
            def error(msg): print("[ERROR]", msg)
            @staticmethod
            def warn(msg): print("[WARN]", msg)
    decky = DummyDecky()

SELF_ID = "theme-loader"
PLUGIN_DIR = os.path.dirname(os.path.abspath(__file__))
USER_HOME = getattr(decky, "DECKY_USER_HOME", "") or "/home/deck"
# User folder: drop any plugin .zip here and it shows up in the store
ZIPS_DIR = os.path.join(USER_HOME, "Documents", "theme-loader")
# Packages bundled inside theme-loader.zip (scripts/package.sh copies them)
BUNDLED_DIR = os.path.join(PLUGIN_DIR, "packages")
PLUGINS_DIR = os.path.join(USER_HOME, "homebrew", "plugins")
SCREENSHOTS_DIR = os.path.join(PLUGIN_DIR, "assets", "screenshots")
THUMBS_DIR = os.path.join(PLUGIN_DIR, "assets", "thumbs")
IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".webp")

# Remote catalog with the latest release of each plugin (see README "Releasing a new version").
# THEME_LOADER_CATALOG_URL overrides it (file:// URLs are accepted there, for testing).
DEFAULT_CATALOG_URL = "https://github.com/kromossomom-debug/decky-theme-loader/releases/latest/download/catalog.json"
CATALOG_URL = os.environ.get("THEME_LOADER_CATALOG_URL", DEFAULT_CATALOG_URL)
CATALOG_TTL = 15 * 60  # seconds between remote checks
CATALOG_TIMEOUT = 6
DOWNLOAD_TIMEOUT = 30
USER_AGENT = "theme-loader-decky"


def parse_version(version: str):
    """Parses 'v1.2.3-alpha.1' into ((1, 2, 3), ('alpha', 1)). Prerelease () = final release."""
    v = (version or "").strip().lstrip("vV")
    v = v.split("+", 1)[0]
    core, _, pre = v.partition("-")
    nums = []
    for part in core.split("."):
        m = re.match(r"\d+", part)
        nums.append(int(m.group()) if m else 0)
    while len(nums) < 3:
        nums.append(0)
    pre_parts = tuple(int(p) if p.isdigit() else p.lower() for p in pre.split(".")) if pre else ()
    return tuple(nums), pre_parts


def compare_versions(a: str, b: str) -> int:
    """Semver-like comparison: -1 if a < b, 0 if equal, 1 if a > b (1.0.0-alpha < 1.0.0)."""
    (ca, pa), (cb, pb) = parse_version(a), parse_version(b)
    if ca != cb:
        return -1 if ca < cb else 1
    if pa == pb:
        return 0
    if not pa:
        return 1
    if not pb:
        return -1
    for x, y in zip(pa, pb):
        if x == y:
            continue
        if isinstance(x, int) and isinstance(y, int):
            return -1 if x < y else 1
        if isinstance(x, int):
            return -1
        if isinstance(y, int):
            return 1
        return -1 if x < y else 1
    return -1 if len(pa) < len(pb) else 1


def read_zip_meta(zip_path: str) -> dict:
    """Reads name/version/author/description from plugin.json and package.json inside a zip."""
    meta = {"name": "", "version": "", "author": "", "description": "", "tags": []}
    with zipfile.ZipFile(zip_path, "r") as zf:
        names = zf.namelist()
        # Prefer the top-level files (plugin/plugin.json), not nested node_modules copies
        def pick(filename):
            matches = [n for n in names if n.endswith(filename) and n.count("/") <= 1]
            return min(matches, key=len) if matches else None
        pj_name = pick("plugin.json")
        if pj_name:
            try:
                pj = json.loads(zf.read(pj_name).decode("utf-8"))
                meta["name"] = pj.get("name", "")
                meta["author"] = pj.get("author", "")
                publish = pj.get("publish", {}) or {}
                meta["description"] = pj.get("description", "") or publish.get("description", "")
                meta["tags"] = pj.get("tags", []) or publish.get("tags", [])
                meta["version"] = pj.get("version", "")
            except Exception:
                pass
        pkg_name = pick("package.json")
        if pkg_name:
            try:
                pkg = json.loads(zf.read(pkg_name).decode("utf-8"))
                meta["version"] = pkg.get("version", "") or meta["version"]
            except Exception:
                pass
    return meta


def read_installed_meta(plugin_dir: str) -> dict:
    meta = {"name": "", "version": ""}
    try:
        with open(os.path.join(plugin_dir, "plugin.json"), "r", encoding="utf-8") as f:
            meta["name"] = json.load(f).get("name", "")
    except Exception:
        pass
    try:
        with open(os.path.join(plugin_dir, "package.json"), "r", encoding="utf-8") as f:
            meta["version"] = json.load(f).get("version", "")
    except Exception:
        pass
    return meta


def find_installed_dir(plugin_id: str, plugin_name: str = "") -> str:
    """Finds the installed folder of a plugin by folder name or by plugin.json name.

    Decky's own store installs into a folder named after the plugin, so a plugin
    installed from elsewhere may live in 'PS5 Dashboard' instead of 'ps5-dashboard'.
    """
    exact = os.path.join(PLUGINS_DIR, plugin_id)
    if os.path.isdir(exact):
        return exact
    if not os.path.isdir(PLUGINS_DIR):
        return ""
    wanted_name = (plugin_name or "").strip().lower()
    for d in os.listdir(PLUGINS_DIR):
        full = os.path.join(PLUGINS_DIR, d)
        if not os.path.isdir(full):
            continue
        if d.lower() == plugin_id.lower():
            return full
        if wanted_name and read_installed_meta(full)["name"].strip().lower() == wanted_name:
            return full
    return ""


def list_packages() -> dict:
    """Returns {plugin_id: zip_path}, keeping the highest version when a plugin exists
    both in the bundled packages and in the user's Documents folder."""
    found = {}
    for folder in (BUNDLED_DIR, ZIPS_DIR):
        for zip_path in sorted(glob.glob(os.path.join(folder, "*.zip"))):
            plugin_id = os.path.splitext(os.path.basename(zip_path))[0]
            if plugin_id == SELF_ID:
                continue
            try:
                version = read_zip_meta(zip_path)["version"]
            except Exception as e:
                decky.logger.error(f"[ThemeLoader] Invalid zip {zip_path}: {e}")
                continue
            current = found.get(plugin_id)
            if current is None or compare_versions(version, current[1]) >= 0:
                found[plugin_id] = (zip_path, version)
    return {pid: path for pid, (path, _) in found.items()}


def image_data_url(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    mime = {".png": "image/png", ".webp": "image/webp"}.get(ext, "image/jpeg")
    with open(path, "rb") as f:
        return f"data:{mime};base64,{base64.b64encode(f.read()).decode('utf-8')}"


def safe_extract(zf: zipfile.ZipFile, target_dir: str, strip_prefix: str = ""):
    """Extracts a zip, optionally stripping a root folder, refusing paths outside target_dir."""
    root = os.path.realpath(target_dir)
    for member in zf.infolist():
        name = member.filename.replace("\\", "/")
        if strip_prefix:
            if not name.startswith(strip_prefix):
                continue
            name = name[len(strip_prefix):]
        if not name:
            continue
        dest = os.path.realpath(os.path.join(root, name))
        if dest != root and not dest.startswith(root + os.sep):
            raise ValueError(f"Unsafe path in zip: {member.filename}")
        if member.is_dir():
            os.makedirs(dest, exist_ok=True)
        else:
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with zf.open(member) as src, open(dest, "wb") as dst:
                shutil.copyfileobj(src, dst)


def zip_root_prefix(zf: zipfile.ZipFile) -> str:
    """Returns 'folder/' when every entry of the zip lives under one root folder."""
    names = [n.replace("\\", "/") for n in zf.namelist() if n.strip()]
    if not names:
        return ""
    first = names[0].split("/", 1)[0]
    if all(n.startswith(first + "/") for n in names):
        return first + "/"
    return ""

def detect_system_language() -> str:
    """Detects current SteamOS system language: pt, en, de, pl"""
    try:
        reg_path = os.path.expanduser("~/.steam/steam/registry.vdf")
        if os.path.isfile(reg_path):
            with open(reg_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read().lower()
                if '"language"\t\t"german"' in content:
                    return "de"
                if '"language"\t\t"polish"' in content:
                    return "pl"
                if '"language"\t\t"portuguese"' in content or '"language"\t\t"brazilian"' in content:
                    return "pt"
                if '"language"\t\t"english"' in content:
                    return "en"
    except Exception:
        pass

    lang_env = os.environ.get("LANG", "").lower()
    if "pt" in lang_env:
        return "pt"
    if "de" in lang_env:
        return "de"
    if "pl" in lang_env:
        return "pl"
    if "en" in lang_env:
        return "en"
    return "en"


PLUGIN_PRESETS = {
    "ps3-dashboard": {
        "id": "ps3-dashboard",
        "name": "PS3 Dashboard",
        "console": {
            "pt": "PlayStation 3",
            "en": "PlayStation 3",
            "de": "PlayStation 3",
            "pl": "PlayStation 3"
        },
        "badge": {
            "pt": "PS3 XMB",
            "en": "PS3 XMB",
            "de": "PS3 XMB",
            "pl": "PS3 XMB"
        },
        "color": "#2F6FD0",
        "gradient": "linear-gradient(135deg, #1c3b70 0%, #0d1b33 100%)",
        "accent": "#0090ff",
        "isDashboard": True,
        "tagline": {
            "pt": "O visual clássico da Cross Media Bar (XMB) do PlayStation 3 no SteamOS",
            "en": "The classic PlayStation 3 Cross Media Bar (XMB) interface on SteamOS",
            "de": "Das klassische PlayStation 3 Cross Media Bar (XMB) Design auf SteamOS",
            "pl": "Klasyczny interfejs Cross Media Bar (XMB) z PlayStation 3 w SteamOS"
        },
        "features": {
            "pt": [
                "Menu XMB em cruz com navegação horizontal e vertical",
                "Ondas fluidas animadas na cor oficial de cada mês (Jan-Dez)",
                "Arte de fundo dinâmica do jogo selecionado",
                "Menu clássico △ de opções e sons originais do XMB",
                "Notificações de Troféus PS3 (Bronze, Prata, Ouro e Platina)"
            ],
            "en": [
                "Cross XMB menu with horizontal and vertical navigation",
                "Animated dynamic wave background matching each month (Jan-Dec)",
                "Dynamic game artwork background on hover",
                "Classic △ options menu and original XMB system sounds",
                "PS3 Trophy notifications (Bronze, Silver, Gold, Platinum)"
            ],
            "de": [
                "Kreuzförmiges XMB-Menü mit horizontaler und vertikaler Navigation",
                "Animierte dynamische Wellen in der offiziellen Monatsfarbe (Jan-Dez)",
                "Dynamische Spielhintergrundgrafik bei Auswahl",
                "Klassisches △-Optionsmenü und originale XMB-Sounds",
                "PS3-Trophäen-Benachrichtigungen (Bronze, Silber, Gold, Platin)"
            ],
            "pl": [
                "Krzyżowe menu XMB z nawigacją poziomą i pionową",
                "Animowane płynne fale w oficjalnych kolorach każdego miesiąca (Sty-Gru)",
                "Dynamiczna grafika tła wybranej gry",
                "Klasyczne menu opcji △ i oryginalne dźwięki systemowe XMB",
                "Powiadomienia o trofeach PS3 (Brąz, Srebro, Złoto i Platyna)"
            ]
        },
        "screenshots": [
            {"filename": "home.jpg", "title": {"pt": "Menu Principal XMB", "en": "Main XMB Menu", "de": "XMB-Hauptmenü", "pl": "Główne menu XMB"}},
            {"filename": "trophy.jpg", "title": {"pt": "Notificação de Troféu PS3", "en": "PS3 Trophy Notification", "de": "PS3-Trophäen-Benachrichtigung", "pl": "Powiadomienie o trofeum PS3"}},
            {"filename": "trophy-grades.jpg", "title": {"pt": "Graus de Troféus (Bronze a Platina)", "en": "Trophy Grades (Bronze to Platinum)", "de": "Trophäenstufen (Bronze bis Platin)", "pl": "Rangi trofeów (od brązu do platyny)"}},
            {"filename": "options.jpg", "title": {"pt": "Menu △ de Opções", "en": "△ Options Menu", "de": "△-Optionsmenü", "pl": "Menu opcji △"}},
            {"filename": "trophies.jpg", "title": {"pt": "Coleção de Troféus", "en": "Trophy Collection", "de": "Trophäen-Sammlung", "pl": "Kolekcja trofeów"}},
            {"filename": "game-background.jpg", "title": {"pt": "Arte Dinâmica de Fundo", "en": "Dynamic Background Art", "de": "Dynamische Hintergrundgrafik", "pl": "Dynamiczne tło gry"}},
            {"filename": "months.jpg", "title": {"pt": "Ondas nas Cores dos 12 Meses", "en": "12-Month Color Waves", "de": "Farbwellen der 12 Monate", "pl": "Fale w kolorach 12 miesięcy"}},
            {"filename": "friends.jpg", "title": {"pt": "Amigos", "en": "Friends", "de": "Freunde", "pl": "Znajomi"}},
            {"filename": "music.jpg", "title": {"pt": "Música", "en": "Music", "de": "Musik", "pl": "Muzyka"}},
            {"filename": "settings.jpg", "title": {"pt": "Configurações", "en": "Settings", "de": "Einstellungen", "pl": "Ustawienia"}}
        ]
    },
    "ps5-dashboard": {
        "id": "ps5-dashboard",
        "name": "PS5 Dashboard",
        "console": {
            "pt": "PlayStation 5",
            "en": "PlayStation 5",
            "de": "PlayStation 5",
            "pl": "PlayStation 5"
        },
        "badge": {
            "pt": "PS5",
            "en": "PS5",
            "de": "PS5",
            "pl": "PS5"
        },
        "color": "#0070D1",
        "gradient": "linear-gradient(135deg, #003791 0%, #001233 100%)",
        "accent": "#29b6f6",
        "isDashboard": True,
        "tagline": {
            "pt": "A interface moderna da tela inicial do PlayStation 5 para o Steam Deck",
            "en": "The modern PlayStation 5 home screen interface for Steam Deck",
            "de": "Die moderne PlayStation 5 Startbildschirm-Oberfläche für das Steam Deck",
            "pl": "Nowoczesny interfejs ekranu głównego PlayStation 5 dla Steam Decka"
        },
        "features": {
            "pt": [
                "Linha de jogos no topo com transição e arte hero em tela cheia",
                "Botão branco 'Jogar' característico do PS5",
                "Integração com HowLongToBeat e cartões de atividade",
                "Linhas organizadas: Favoritos, Instalados e Atalhos",
                "Grid da Biblioteca de Jogos com filtros do PS5"
            ],
            "en": [
                "Top game carousel with full-screen hero backdrop transitions",
                "Signature PS5 white 'Play' action button",
                "HowLongToBeat cards and game activity integration",
                "Curated rows: Favorites, Installed games, and Shortcuts",
                "PS5-style game library grid with console filters"
            ],
            "de": [
                "Oberes Spiel-Karussell mit Vollbild-Hero-Hintergrund",
                "Charakteristischer weißer 'Spielen'-Button der PS5",
                "HowLongToBeat-Karten und Spielaktivitäts-Integration",
                "Strukturierte Reihen: Favoriten, Installiert und Verknüpfungen",
                "PS5-Bibliotheksraster mit Konsolenfiltern"
            ],
            "pl": [
                "Górny pasek gier z pełnoekranową grafiką główną",
                "Charakterystyczny biały przycisk 'Graj' z PS5",
                "Integracja z kartami HowLongToBeat i aktywnościami",
                "Uporządkowane rzędy: Ulubione, Zainstalowane i Skróty",
                "Siatka biblioteki gier w stylu PS5 z filtrami konsolowymi"
            ]
        },
        "screenshots": [
            {"filename": "home.jpg", "title": {"pt": "Tela Inicial PS5", "en": "PS5 Home Screen", "de": "PS5-Startbildschirm", "pl": "Ekran główny PS5"}},
            {"filename": "play.jpg", "title": {"pt": "Botão Jogar e Cartões HLTB", "en": "Play Button & HLTB Cards", "de": "Spielen-Button & HLTB-Karten", "pl": "Przycisk Graj i karty HLTB"}},
            {"filename": "rows.jpg", "title": {"pt": "Linhas de Jogos e Atalhos", "en": "Game Rows & Shortcuts", "de": "Spiele-Reihen & Verknüpfungen", "pl": "Rzędy gier i skróty"}},
            {"filename": "library.jpg", "title": {"pt": "Biblioteca de Jogos", "en": "Game Library", "de": "Spielebibliothek", "pl": "Biblioteka gier"}},
            {"filename": "store.jpg", "title": {"pt": "Steam Store Integrada", "en": "Integrated Steam Store", "de": "Integrierter Steam-Shop", "pl": "Zintegrowany sklep Steam"}},
            {"filename": "media.jpg", "title": {"pt": "Mídia", "en": "Media", "de": "Medien", "pl": "Multimedia"}}
        ]
    },
    "switch2-dashboard": {
        "id": "switch2-dashboard",
        "name": "Switch 2 Dashboard",
        "console": {
            "pt": "Nintendo Switch 2",
            "en": "Nintendo Switch 2",
            "de": "Nintendo Switch 2",
            "pl": "Nintendo Switch 2"
        },
        "badge": {
            "pt": "Switch 2",
            "en": "Switch 2",
            "de": "Switch 2",
            "pl": "Switch 2"
        },
        "color": "#E60012",
        "gradient": "linear-gradient(135deg, #b3000d 0%, #1a1a2e 100%)",
        "accent": "#00C3E3",
        "isDashboard": True,
        "tagline": {
            "pt": "O aguardado menu HOME do Nintendo Switch 2 no seu Steam Deck",
            "en": "The anticipated Nintendo Switch 2 HOME menu on your Steam Deck",
            "de": "Das mit Spannung erwartete Nintendo Switch 2 HOME-Menü auf Ihrem Steam Deck",
            "pl": "Oczekiwane menu HOME z Nintendo Switch 2 na Twoim Steam Decku"
        },
        "features": {
            "pt": [
                "Menu HOME com barra de status superior e blocos quadrados",
                "Atalhos circulares com anel de arco-íris luminoso",
                "Menu Todos os Softwares (All Software) em grade rápida",
                "Página Meu Perfil (My Page) com amigos e tempo de jogo",
                "Suporte a tema Branco Básico e Escuro"
            ],
            "en": [
                "HOME menu with sleek top status bar and square game tiles",
                "Circular shortcuts with glowing rainbow accent ring",
                "All Software quick-access grid view",
                "My Page profile view with friends list and play time",
                "Basic White and Dark theme support"
            ],
            "de": [
                "HOME-Menü mit oberer Statusleiste und quadratischen Spielkacheln",
                "Runde Verknüpfungen mit leuchtendem Regenbogenring",
                "Schnellzugriff-Rasteransicht für alle Software",
                "Profilseite (My Page) mit Freundesliste und Spielzeit",
                "Unterstützung für Helles und Dunkles Design"
            ],
            "pl": [
                "Menu HOME z górnym paskiem stanu i kwadratowymi kafelkami",
                "Okrągłe skróty ze świecącym tęczowym pierścieniem",
                "Szybki widok siatki dla 'Wszystkie programy'",
                "Strona profilu (My Page) ze znajomymi i czasem gry",
                "Obsługa motywu jasnego (Basic White) i ciemnego"
            ]
        },
        "screenshots": [
            {"filename": "home.jpg", "title": {"pt": "Menu HOME Switch 2", "en": "Switch 2 HOME Menu", "de": "Switch 2 HOME-Menü", "pl": "Menu HOME Switch 2"}},
            {"filename": "all-software.jpg", "title": {"pt": "Grade de Todos os Softwares", "en": "All Software Grid", "de": "Alle Software Raster", "pl": "Siatka wszystkich programów"}},
            {"filename": "library.jpg", "title": {"pt": "Biblioteca Completa", "en": "Complete Library", "de": "Komplette Bibliothek", "pl": "Pełna biblioteka"}},
            {"filename": "my-page.jpg", "title": {"pt": "Minha Página (My Page)", "en": "My Page Profile", "de": "Mein Profil (My Page)", "pl": "Mój profil (My Page)"}},
            {"filename": "icons.jpg", "title": {"pt": "Atalhos Circulares", "en": "Circular Shortcuts", "de": "Kreisförmige Shortcuts", "pl": "Okrągłe skróty"}},
            {"filename": "white.jpg", "title": {"pt": "Visual Branco Básico", "en": "Basic White Style", "de": "Heller Stil (Basic White)", "pl": "Styl jasny (Basic White)"}},
            {"filename": "library-archived.jpg", "title": {"pt": "Biblioteca – Arquivados", "en": "Library – Archived", "de": "Bibliothek – Archiviert", "pl": "Biblioteka – zarchiwizowane"}},
            {"filename": "non-steam.jpg", "title": {"pt": "Jogos Non-Steam", "en": "Non-Steam Games", "de": "Nicht-Steam-Spiele", "pl": "Gry spoza Steam"}},
            {"filename": "my-page-profile.jpg", "title": {"pt": "Perfil", "en": "Profile", "de": "Profil", "pl": "Profil"}},
            {"filename": "my-page-friends.jpg", "title": {"pt": "Lista de Amigos", "en": "Friend List", "de": "Freundesliste", "pl": "Lista znajomych"}},
            {"filename": "my-page-add.jpg", "title": {"pt": "Adicionar Amigo", "en": "Add Friend", "de": "Freund hinzufügen", "pl": "Dodaj znajomego"}},
            {"filename": "my-page-settings.jpg", "title": {"pt": "Configurações de Usuário", "en": "User Settings", "de": "Benutzereinstellungen", "pl": "Ustawienia użytkownika"}}
        ]
    },
    "xbox-dashboard": {
        "id": "xbox-dashboard",
        "name": "Xbox Dashboard",
        "console": {
            "pt": "Xbox Series X|S",
            "en": "Xbox Series X|S",
            "de": "Xbox Series X|S",
            "pl": "Xbox Series X|S"
        },
        "badge": {
            "pt": "Xbox Series",
            "en": "Xbox Series",
            "de": "Xbox Series",
            "pl": "Xbox Series"
        },
        "color": "#107C10",
        "gradient": "linear-gradient(135deg, #0e5c0e 0%, #0a1f0a 100%)",
        "accent": "#52b788",
        "isDashboard": True,
        "tagline": {
            "pt": "A experiência da interface do Xbox Series X|S adaptada para o SteamOS",
            "en": "The Xbox Series X|S interface experience adapted for SteamOS",
            "de": "Das Xbox Series X|S Dashboard-Erlebnis angepasst für SteamOS",
            "pl": "Interfejs Xbox Series X|S zaadaptowany dla SteamOS"
        },
        "features": {
            "pt": [
                "Tela de início com arte em tela cheia e abas superiores LB/RB",
                "Painel completo 'Meus Jogos & Apps' com barra lateral",
                "Página do jogo com botão Jogar estilizado e painel Sobre",
                "Menus Guia e abas de Sistema fiéis ao ecossistema Xbox",
                "Paleta oficial de cores verde Xbox e contraste refinado"
            ],
            "en": [
                "Home screen with full-screen hero art and LB/RB top tabs",
                "Full 'My Games & Apps' dashboard with sidebar navigation",
                "Game page with stylized Play button and About section",
                "Xbox Guide overlay and System tabs authentic to Xbox",
                "Signature Xbox green color palette and refined contrast"
            ],
            "de": [
                "Startseite mit Vollbildgrafik und oberen LB/RB-Reitern",
                "Vollständiges 'Meine Spiele & Apps'-Dashboard mit Seitenleiste",
                "Spielseite mit stilisiertem Spielen-Button und Infobereich",
                "Xbox-Guide und System-Tabs originalgetreu umgesetzt",
                "Offizielle Xbox-Grün-Farbpalette und feiner Kontrast"
            ],
            "pl": [
                "Ekran główny z pełnoekranową grafiką i górnymi kartami LB/RB",
                "Pełny panel 'Moje gry i aplikacje' z bocznym paskiem",
                "Strona gry ze stylizowanym przyciskiem Graj i panelem Informacje",
                "Menu przewodnika i karty systemowe wierne konsoli Xbox",
                "Oficjalna zielona paleta Xbox i dopracowany kontrast"
            ]
        },
        "screenshots": [
            {"filename": "home.jpg", "title": {"pt": "Início Xbox Series X|S", "en": "Xbox Series X|S Home", "de": "Xbox Series X|S Startseite", "pl": "Strona główna Xbox Series X|S"}},
            {"filename": "mygames.jpg", "title": {"pt": "Painel Meus Jogos & Apps", "en": "My Games & Apps Panel", "de": "Meine Spiele & Apps", "pl": "Panel Moje gry i aplikacje"}},
            {"filename": "game.jpg", "title": {"pt": "Página do Jogo com Badges", "en": "Game Page with Badges", "de": "Spielseite mit Abzeichen", "pl": "Strona gry z odznakami"}},
            {"filename": "system.jpg", "title": {"pt": "Guia do Sistema e Configurações", "en": "System Guide & Settings", "de": "System-Guide & Einstellungen", "pl": "Przewodnik systemowy i ustawienia"}}
        ]
    },
    "achievo": {
        "id": "achievo",
        "name": "Achievo",
        "console": {
            "pt": "Notificações de Conquistas",
            "en": "Achievement Popups",
            "de": "Erfolgsbenachrichtigungen",
            "pl": "Powiadomienia o osiągnięciach"
        },
        "badge": {
            "pt": "Conquistas",
            "en": "Achievements",
            "de": "Erfolge",
            "pl": "Osiągnięcia"
        },
        "color": "#D4AF37",
        "gradient": "linear-gradient(135deg, #7a5c10 0%, #1f190a 100%)",
        "accent": "#ffd166",
        "isDashboard": False,
        "tagline": {
            "pt": "Notificações de conquistas estilo consoles (Xbox Series ou PS5)",
            "en": "Console-style achievement and trophy popups (Xbox Series or PS5)",
            "de": "Konsolen-Erfolgs- und Trophäen-Benachrichtigungen (Xbox Series oder PS5)",
            "pl": "Powiadomienia o osiągnięciach w stylu konsolowym (Xbox Series lub PS5)"
        },
        "features": {
            "pt": [
                "Pílula estilo Xbox Series X|S ou card de troféu estilo PS5",
                "Efeitos sonoros icônicos ao desbloquear conquistas",
                "Suporte a áudio personalizado (MP3, WAV, OGG, FLAC)",
                "Destaque especial para Conquistas Raras com diamante",
                "9 posições configuráveis na tela (cantos, topo, centro)"
            ],
            "en": [
                "Xbox Series X|S pill notification or PS5 trophy card style",
                "Iconic sound effects when unlocking achievements",
                "Custom audio file support (MP3, WAV, OGG, FLAC)",
                "Special diamond highlight for Rare Achievements",
                "9 configurable screen positions (corners, top, center)"
            ],
            "de": [
                "Xbox Series X|S Banner oder PS5-Trophäenkarte",
                "Kultige Soundeffekte beim Freischalten von Erfolgen",
                "Unterstützung für eigene Audiodateien (MP3, WAV, OGG, FLAC)",
                "Besondere Diamant-Hervorhebung für seltene Erfolge",
                "9 konfigurierbare Bildschirmpositionen (Ecken, oben, Mitte)"
            ],
            "pl": [
                "Pasek w stylu Xbox Series X|S lub karta trofeum w stylu PS5",
                "Kultowe efekty dźwiękowe przy odblokowywaniu osiągnięć",
                "Obsługa własnych plików dźwiękowych (MP3, WAV, OGG, FLAC)",
                "Specjalne wyróżnienie diamentem dla rzadkich osiągnięć",
                "9 konfigurowalnych pozycji na ekranie (rogi, góra, środek)"
            ]
        },
        "screenshots": [
            {"filename": "playstation.jpg", "title": {"pt": "Cards de Troféu estilo PlayStation 5", "en": "PlayStation 5 Trophy Card Style", "de": "PlayStation 5 Trophäenkarten-Stil", "pl": "Karty trofeów w stylu PlayStation 5"}},
            {"filename": "toast.jpg", "title": {"pt": "Pílula de Conquista estilo Xbox Series", "en": "Xbox Series Achievement Banner Style", "de": "Xbox Series Erfolgsbanner-Stil", "pl": "Pasek osiągnięć w stylu Xbox Series"}},
            {"filename": "toast-rare.jpg", "title": {"pt": "Conquista Rara com Diamante Roxo", "en": "Rare Achievement with Diamond", "de": "Seltener Erfolg mit Diamant", "pl": "Rzadkie osiągnięcie z diamentem"}},
            {"filename": "position-top-left.jpg", "title": {"pt": "Posicionamento no Canto Superior", "en": "Top-Left Screen Position", "de": "Position oben links", "pl": "Pozycja w lewym górnym rogu"}}
        ]
    }
}



def localized(value, lang: str, fallback=""):
    if isinstance(value, dict):
        return value.get(lang, value.get("en", value.get("pt", fallback)))
    return value if value else fallback


def screenshot_entries(plugin_id: str, lang: str) -> list:
    """Preset screenshots in curated order, followed by any extra image found in the folder."""
    preset = PLUGIN_PRESETS.get(plugin_id, {})
    folder = os.path.join(SCREENSHOTS_DIR, plugin_id)
    available = sorted(fn for fn in os.listdir(folder) if fn.lower().endswith(IMAGE_EXTS)) if os.path.isdir(folder) else []
    entries, seen = [], set()
    for s in preset.get("screenshots", []):
        if s["filename"] in available:
            entries.append({"filename": s["filename"], "title": localized(s.get("title"), lang, s["filename"])})
            seen.add(s["filename"])
    for fn in available:
        if fn not in seen:
            title = os.path.splitext(fn)[0].replace("-", " ").replace("_", " ").title()
            entries.append({"filename": fn, "title": title})
    return entries


def thumb_path(plugin_id: str, filename: str) -> str:
    thumb = os.path.join(THUMBS_DIR, plugin_id, filename)
    return thumb if os.path.isfile(thumb) else os.path.join(SCREENSHOTS_DIR, plugin_id, filename)


def version_state(installed: bool, installed_version: str, available_version: str) -> str:
    if not installed:
        return "not_installed"
    if not installed_version or not available_version:
        return "installed"
    cmp = compare_versions(installed_version, available_version)
    if cmp < 0:
        return "update_available"
    if cmp > 0:
        return "newer_installed"
    return "up_to_date"


PLUGIN_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
MAX_CATALOG_BYTES = 1024 * 1024
MAX_DOWNLOAD_BYTES = 200 * 1024 * 1024
# Last good remote catalog; "at" is when it was fetched (time.monotonic)
_remote_cache = {"at": 0.0, "plugins": {}}
_remote_lock = threading.Lock()
# plugin_id -> {"done": bytes, "total": bytes} while a release is being downloaded
DOWNLOADS = {}


def ssl_context() -> ssl.SSLContext:
    """Decky's bundled Python may not find the system CAs, so try certifi and the SteamOS bundle first."""
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        pass
    for cafile in ("/etc/ssl/certs/ca-certificates.crt", "/etc/ca-certificates/extracted/tls-ca-bundle.pem"):
        if os.path.isfile(cafile):
            return ssl.create_default_context(cafile=cafile)
    return ssl.create_default_context()


def open_url(url: str, timeout: float):
    scheme = urllib.parse.urlparse(url).scheme
    # file:// only when the catalog itself is local (testing with THEME_LOADER_CATALOG_URL)
    if scheme != "https" and not (scheme == "file" and CATALOG_URL.startswith("file://")):
        raise ValueError(f"URL not allowed: {url}")
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    return urllib.request.urlopen(req, timeout=timeout, context=ssl_context())


def parse_remote_catalog(data) -> dict:
    """Validates {"plugins": [{"id", "version", "url", "sha256", "size", ...}]} into {plugin_id: entry}."""
    entries = data.get("plugins", []) if isinstance(data, dict) else []
    result = {}
    for entry in entries if isinstance(entries, list) else []:
        if not isinstance(entry, dict):
            continue
        plugin_id = str(entry.get("id", "")).strip()
        # The id becomes a file name in ZIPS_DIR and a folder in ~/homebrew/plugins
        if not PLUGIN_ID_RE.match(plugin_id):
            decky.logger.warn(f"[ThemeLoader] Remote catalog: invalid id {plugin_id!r}")
            continue
        if not all(isinstance(entry.get(k), str) and entry[k].strip() for k in ("version", "url", "sha256")):
            decky.logger.warn(f"[ThemeLoader] Remote catalog: {plugin_id} needs version, url and sha256")
            continue
        result[plugin_id] = entry
    return result


def fetch_remote_catalog(force: bool = False) -> dict:
    """{plugin_id: entry} from CATALOG_URL, cached for CATALOG_TTL. Offline it keeps the last good result."""
    if not CATALOG_URL:
        return {}
    with _remote_lock:
        age = time.monotonic() - _remote_cache["at"]
        if not force and _remote_cache["at"] and age < CATALOG_TTL:
            return _remote_cache["plugins"]
        try:
            with open_url(CATALOG_URL, CATALOG_TIMEOUT) as resp:
                data = json.loads(resp.read(MAX_CATALOG_BYTES).decode("utf-8"))
            _remote_cache["plugins"] = parse_remote_catalog(data)
            _remote_cache["at"] = time.monotonic()
            decky.logger.info(f"[ThemeLoader] Remote catalog: {len(_remote_cache['plugins'])} plugin(s)")
        except Exception as e:
            decky.logger.warn(f"[ThemeLoader] Remote catalog unavailable ({e}); using local packages")
            # Try again in a minute instead of on every refresh while offline
            _remote_cache["at"] = time.monotonic() - CATALOG_TTL + 60
        return _remote_cache["plugins"]


async def fetch_remote_catalog_async(force: bool = False) -> dict:
    return await asyncio.get_running_loop().run_in_executor(None, fetch_remote_catalog, force)


def resolve_packages(remote: dict) -> dict:
    """{plugin_id: {"zip", "meta", "version", "remote"}} merging local zips with the remote catalog.

    "remote" holds the catalog entry when its release is newer than every local zip,
    meaning install_plugin has to download it first.
    """
    result = {}
    for plugin_id, zip_path in list_packages().items():
        try:
            meta = read_zip_meta(zip_path)
        except Exception as e:
            decky.logger.error(f"[ThemeLoader] Error reading {zip_path}: {e}")
            continue
        result[plugin_id] = {"zip": zip_path, "meta": meta, "version": meta["version"] or "0.0.0", "remote": None}
    for plugin_id, entry in remote.items():
        if plugin_id == SELF_ID:
            continue
        local = result.get(plugin_id)
        if local and compare_versions(entry["version"], local["version"]) <= 0:
            continue
        meta = dict(local["meta"]) if local else {"name": "", "version": "", "author": "", "description": "", "tags": []}
        for key in ("name", "author", "description", "tags"):
            if entry.get(key):
                meta[key] = entry[key]
        meta["version"] = entry["version"]
        result[plugin_id] = {"zip": local["zip"] if local else "", "meta": meta,
                             "version": entry["version"], "remote": entry}
    return result


def download_package(plugin_id: str, entry: dict) -> str:
    """Downloads a catalog release to ZIPS_DIR/<id>.zip, checking size, sha256 and version before replacing it."""
    os.makedirs(ZIPS_DIR, exist_ok=True)
    dest = os.path.join(ZIPS_DIR, f"{plugin_id}.zip")
    part = dest + ".part"
    expected_size = int(entry.get("size") or 0)
    expected_sha = entry["sha256"].strip().lower()
    if expected_sha.startswith("sha256:"):  # GitHub's asset "digest" format
        expected_sha = expected_sha[len("sha256:"):]
    progress = DOWNLOADS[plugin_id] = {"done": 0, "total": expected_size}
    digest = hashlib.sha256()
    decky.logger.info(f"[ThemeLoader] Downloading {plugin_id} {entry['version']} from {entry['url']}")
    try:
        with open_url(entry["url"], DOWNLOAD_TIMEOUT) as resp, open(part, "wb") as out:
            if not progress["total"]:
                progress["total"] = int(resp.headers.get("Content-Length") or 0)
            limit = expected_size or MAX_DOWNLOAD_BYTES
            while True:
                chunk = resp.read(64 * 1024)
                if not chunk:
                    break
                progress["done"] += len(chunk)
                if progress["done"] > limit:
                    raise ValueError("Download maior que o esperado")
                out.write(chunk)
                digest.update(chunk)
        if expected_size and progress["done"] != expected_size:
            raise ValueError(f"Tamanho incorreto ({progress['done']} de {expected_size} bytes)")
        if digest.hexdigest() != expected_sha:
            raise ValueError("sha256 checksum mismatch")
        version = read_zip_meta(part)["version"]
        if compare_versions(version, entry["version"]) != 0:
            raise ValueError(f"The zip contains v{version}, but the catalog lists v{entry['version']}")
        os.replace(part, dest)
        decky.logger.info(f"[ThemeLoader] Saved {dest}")
        return dest
    finally:
        DOWNLOADS.pop(plugin_id, None)
        if os.path.exists(part):
            os.remove(part)


class Plugin:
    async def get_catalog(self, lang: str = "", refresh_remote: bool = False) -> list:
        """Store catalog: bundled packages, zips in ~/Documents/theme-loader and newer remote releases."""
        if not lang or lang not in ("pt", "en", "de", "pl"):
            lang = detect_system_language()
        os.makedirs(ZIPS_DIR, exist_ok=True)
        remote = await fetch_remote_catalog_async(refresh_remote)

        results = []
        for plugin_id, pkg in sorted(resolve_packages(remote).items()):
            meta, entry = pkg["meta"], pkg["remote"]
            # A plugin without a preset (published after this release) can style itself from its catalog entry
            preset = PLUGIN_PRESETS.get(plugin_id) or entry or {}
            name = preset.get("name", meta["name"] or plugin_id)
            available_version = pkg["version"]

            installed_dir = find_installed_dir(plugin_id, meta["name"] or name)
            installed = bool(installed_dir)
            installed_version = read_installed_meta(installed_dir)["version"] if installed else ""
            state = version_state(installed, installed_version, available_version)

            tagline = localized(preset.get("tagline"), lang, meta["description"])
            shots = screenshot_entries(plugin_id, lang)
            cover = ""
            if shots:
                try:
                    cover = image_data_url(thumb_path(plugin_id, shots[0]["filename"]))
                except Exception:
                    pass

            results.append({
                "id": plugin_id,
                "name": name,
                "console": localized(preset.get("console"), lang, name),
                "badge": localized(preset.get("badge"), lang, plugin_id.upper()),
                "color": preset.get("color", "#2F6FD0"),
                "gradient": preset.get("gradient", "linear-gradient(135deg, #1c3b70 0%, #0d1b33 100%)"),
                "accent": preset.get("accent", "#0090ff"),
                "isDashboard": preset.get("isDashboard", True),
                "tagline": tagline,
                "description": meta["description"] or tagline,
                "features": localized(preset.get("features"), lang, []) or [],
                "version": available_version,
                "author": meta["author"] or "Deck Community",
                "tags": meta["tags"] or [],
                "installed": installed,
                "installedVersion": installed_version,
                "versionState": state,
                "updateAvailable": state == "update_available",
                "needsDownload": entry is not None,
                "zipSize": int(entry.get("size") or 0) if entry else os.path.getsize(pkg["zip"]),
                "screenshotsCount": len(shots),
                "cover": cover,
            })
        return results

    async def get_plugin_screenshots(self, plugin_id: str, lang: str = "") -> list:
        """Screenshot list with lightweight thumbnails; full images come from get_screenshot_full."""
        if not lang or lang not in ("pt", "en", "de", "pl"):
            lang = detect_system_language()
        result = []
        for s in screenshot_entries(plugin_id, lang):
            try:
                thumb = image_data_url(thumb_path(plugin_id, s["filename"]))
            except Exception as e:
                decky.logger.error(f"[ThemeLoader] Thumbnail error {plugin_id}/{s['filename']}: {e}")
                continue
            result.append({"filename": s["filename"], "title": s["title"], "thumbUrl": thumb})
        return result

    async def get_screenshot_full(self, plugin_id: str, filename: str) -> dict:
        """Full resolution (1280x800) screenshot as a data URL."""
        if any(os.path.basename(v) != v or v in ("", ".", "..") for v in (plugin_id, filename)):
            return {"success": False, "error": "Invalid path"}
        path = os.path.join(SCREENSHOTS_DIR, plugin_id, filename)
        if not os.path.isfile(path):
            return {"success": False, "error": f"Screenshot {filename} not found"}
        try:
            return {"success": True, "data": image_data_url(path)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def install_plugin(self, plugin_id: str) -> dict:
        """Installs (or updates) a plugin by extracting its zip into ~/homebrew/plugins.

        When the remote catalog has a newer release, it is downloaded to ~/Documents/theme-loader first.
        """
        decky.logger.info(f"[ThemeLoader] Installing plugin: {plugin_id}")
        pkg = resolve_packages(await fetch_remote_catalog_async()).get(plugin_id)
        if not pkg:
            return {"success": False, "error": f"{plugin_id}.zip not found"}
        zip_path = pkg["zip"]
        if pkg["remote"]:
            try:
                zip_path = await asyncio.get_running_loop().run_in_executor(
                    None, download_package, plugin_id, pkg["remote"])
            except Exception as e:
                decky.logger.error(f"[ThemeLoader] Download of {plugin_id} failed: {e}")
                return {"success": False, "error": f"Falha ao baixar {plugin_id} v{pkg['version']}: {e}"}

        try:
            meta = read_zip_meta(zip_path)
            # Replace an existing copy even if it lives in a differently named folder,
            # otherwise Decky would load two plugins with the same name.
            existing = find_installed_dir(plugin_id, meta["name"])
            target_dir = os.path.join(PLUGINS_DIR, plugin_id)
            for d in {existing, target_dir}:
                if d and os.path.isdir(d):
                    decky.logger.info(f"[ThemeLoader] Removing previous version at {d}")
                    shutil.rmtree(d)
            os.makedirs(target_dir, exist_ok=True)

            with zipfile.ZipFile(zip_path, "r") as zf:
                safe_extract(zf, target_dir, zip_root_prefix(zf))

            for root, dirs, files in os.walk(target_dir):
                for d in dirs:
                    os.chmod(os.path.join(root, d), 0o755)
                for f in files:
                    os.chmod(os.path.join(root, f), 0o755 if f.endswith((".sh", ".bin", ".py")) else 0o644)

            decky.logger.info(f"[ThemeLoader] {plugin_id} {meta['version']} installed at {target_dir}")
            return {"success": True, "plugin_id": plugin_id, "version": meta["version"],
                    "message": f"Plugin {plugin_id} installed successfully!"}
        except Exception as e:
            decky.logger.error(f"[ThemeLoader] Installation failed: {e}")
            return {"success": False, "error": str(e)}

    async def uninstall_plugin(self, plugin_id: str) -> dict:
        """Removes a plugin folder from ~/homebrew/plugins."""
        decky.logger.info(f"[ThemeLoader] Uninstalling plugin: {plugin_id}")
        if plugin_id == SELF_ID:
            return {"success": False, "error": "Theme Loader cannot uninstall itself"}
        pkg = resolve_packages(_remote_cache["plugins"]).get(plugin_id)
        target_dir = find_installed_dir(plugin_id, pkg["meta"]["name"] if pkg else "")
        if not target_dir:
            return {"success": False, "error": f"Plugin {plugin_id} is not installed in {PLUGINS_DIR}"}
        try:
            shutil.rmtree(target_dir)
            decky.logger.info(f"[ThemeLoader] Removed {target_dir}")
            return {"success": True, "plugin_id": plugin_id, "message": f"Plugin {plugin_id} uninstalled successfully!"}
        except Exception as e:
            decky.logger.error(f"[ThemeLoader] Uninstall failed: {e}")
            return {"success": False, "error": str(e)}

    async def update_all(self) -> dict:
        """Updates every installed plugin that has a newer version in the store."""
        catalog = await self.get_catalog()
        pending = [p for p in catalog if p["updateAvailable"]]
        updated, failed = [], []
        for p in pending:
            res = await self.install_plugin(p["id"])
            (updated if res.get("success") else failed).append(p["name"])
        return {"success": not failed, "updated": updated, "failed": failed}

    async def install_random(self) -> dict:
        """Installs a random theme, preferring ones that are not installed yet."""
        catalog = await self.get_catalog()
        if not catalog:
            return {"success": False, "error": f"No plugins found in {ZIPS_DIR}"}
        pool = [p for p in catalog if not p["installed"]] or catalog
        chosen = random.choice(pool)
        decky.logger.info(f"[ThemeLoader] Random pick: {chosen['id']} ({chosen['name']})")

        res = await self.install_plugin(chosen["id"])
        if res.get("success"):
            return {
                "success": True,
                "plugin_id": chosen["id"],
                "name": chosen["name"],
                "console": chosen.get("console", chosen["name"]),
                "badge": chosen.get("badge", chosen["id"].upper()),
                "color": chosen.get("color", "#2F6FD0"),
                "message": f"Random theme installed: {chosen['name']}!"
            }
        return res

    async def get_self_update(self) -> dict:
        """Checks theme-loader.zip in ~/Documents/theme-loader and the remote catalog for a newer Theme Loader."""
        current = read_installed_meta(PLUGIN_DIR)["version"] or "0.0.0"
        zip_path = os.path.join(ZIPS_DIR, f"{SELF_ID}.zip")
        available = ""
        if os.path.isfile(zip_path):
            try:
                available = read_zip_meta(zip_path)["version"]
            except Exception:
                pass
        entry = (await fetch_remote_catalog_async()).get(SELF_ID)
        needs_download = bool(entry) and compare_versions(entry["version"], available or "0.0.0") > 0
        if needs_download:
            available = entry["version"]
        return {
            "current": current,
            "available": available,
            "updateAvailable": bool(available) and compare_versions(current, available) < 0,
            "needsDownload": needs_download,
        }

    async def update_self(self) -> dict:
        """Extracts a newer theme-loader.zip (downloading it first if needed) over this plugin's folder.
        Decky reloads it afterwards."""
        info = await self.get_self_update()
        if not info["updateAvailable"]:
            return {"success": False, "error": "No Theme Loader update available"}
        zip_path = os.path.join(ZIPS_DIR, f"{SELF_ID}.zip")
        try:
            if info["needsDownload"]:
                zip_path = await asyncio.get_running_loop().run_in_executor(
                    None, download_package, SELF_ID, _remote_cache["plugins"][SELF_ID])
            with zipfile.ZipFile(zip_path, "r") as zf:
                safe_extract(zf, PLUGIN_DIR, zip_root_prefix(zf))
            decky.logger.info(f"[ThemeLoader] Self-updated {info['current']} -> {info['available']}")
            return {"success": True, "version": info["available"]}
        except Exception as e:
            decky.logger.error(f"[ThemeLoader] Self-update failed: {e}")
            return {"success": False, "error": str(e)}

    async def get_download_progress(self, plugin_id: str = "") -> dict:
        """Bytes downloaded so far while install_plugin/update_self fetch a release ("" = any download)."""
        if not plugin_id:
            plugin_id = next(iter(DOWNLOADS), "")
        progress = DOWNLOADS.get(plugin_id)
        if not progress:
            return {"active": False, "pluginId": "", "done": 0, "total": 0}
        return {"active": True, "pluginId": plugin_id, "done": progress["done"], "total": progress["total"]}

    async def _main(self):
        decky.logger.info("[ThemeLoader] Theme Loader service started!")
        os.makedirs(ZIPS_DIR, exist_ok=True)

    async def _unload(self):
        decky.logger.info("[ThemeLoader] Theme Loader service stopped.")
