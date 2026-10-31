// Theme Loader Internationalization (i18n) Engine
// Supports Portuguese (pt), English (en), German (de), and Polish (pl).
// Plugin content (taglines, features, screenshot titles) comes already
// localized from the backend; this file only holds interface strings.

export type Language = "pt" | "en" | "de" | "pl";

export const translations: Record<Language, Record<string, string>> = {
  pt: {
    "app.title": "Theme Loader",
    "app.subtitle": "Loja de dashboards e temas para o SteamOS",
    "app.back": "Voltar",
    "app.refresh": "Atualizar lista",
    "app.loading": "Carregando loja...",
    "app.empty": "Nenhum plugin encontrado",
    "app.empty_hint": "Coloque arquivos .zip em {path}",
    "app.support": "Apoie o projeto",
    "app.support_desc": "Gostou dos temas? Me paga um café ☕",

    "stats.plugins": "{count} plugins",
    "stats.installed": "{count} instalados",
    "stats.updates": "{count} atualizações",
    "stats.plugins_one": "1 plugin",
    "stats.installed_one": "1 instalado",
    "stats.updates_one": "1 atualização",

    "tab.all": "Todos",
    "tab.dashboards": "Dashboards",
    "tab.extras": "Extras",
    "tab.installed": "Instalados",
    "tab.updates": "Atualizações",
    "tab.empty": "Nada por aqui nesta aba.",

    "status.installed": "Instalado",
    "status.not_installed": "Não instalado",
    "status.update": "Atualização disponível",
    "status.up_to_date": "Atualizado",
    "status.newer": "Versão mais nova instalada",

    "info.version": "Versão",
    "info.installed": "Instalada",
    "info.store": "Na loja",
    "info.size": "Tamanho",
    "info.author": "Autor",
    "info.prints": "Prints",

    "action.install": "Instalar",
    "action.update": "Atualizar para v{version}",
    "action.reinstall": "Reinstalar",
    "action.uninstall": "Desinstalar",
    "action.downgrade": "Instalar v{version} da loja",
    "action.installing": "Instalando...",
    "action.downloading": "Baixando... {percent}",
    "action.uninstalling": "Desinstalando...",
    "action.update_all": "Atualizar tudo ({count})",
    "action.updating_all": "Atualizando...",
    "action.random": "Tema aleatório",
    "action.rolling": "Sorteando...",
    "action.details": "Ver detalhes",

    "confirm.cancel": "Cancelar",
    "confirm.uninstall_title": "Desinstalar {name}?",
    "confirm.uninstall_body": "O plugin será removido do Decky Loader. Você pode reinstalá-lo pela loja quando quiser.",
    "confirm.uninstall_ok": "Desinstalar",
    "confirm.random_title": "Sortear um tema?",
    "confirm.random_body": "Um tema aleatório (de preferência um que você ainda não tem) será instalado.",
    "confirm.random_ok": "Sortear e instalar",
    "confirm.downgrade_title": "Instalar versão mais antiga?",
    "confirm.downgrade_body": "Você tem a v{installed} instalada, que é mais nova que a v{available} da loja. Deseja substituir?",
    "confirm.downgrade_ok": "Substituir",

    "detail.features": "Destaques",
    "detail.prints": "Prints ({count})",
    "detail.loading_prints": "Carregando prints...",
    "detail.no_prints": "Nenhum print disponível.",
    "detail.expand": "Tela cheia",

    "gallery.close": "Fechar",

    "legend.select": "Selecionar",
    "legend.back": "Voltar",
    "legend.random": "Aleatório",
    "legend.tabs": "Abas",
    "legend.prints": "Trocar print",
    "legend.fullscreen": "Tela cheia",

    "qam.open_store": "Abrir a loja",
    "qam.store_desc": "Veja todos os temas com prints em tela cheia",
    "qam.themes": "Temas",

    "self.title": "Nova versão do Theme Loader",
    "self.update": "Atualizar Theme Loader",

    "toast.installed": "{name} v{version} instalado!",
    "toast.uninstalled": "{name} foi desinstalado.",
    "toast.install_error": "Erro ao instalar",
    "toast.uninstall_error": "Erro ao desinstalar",
    "toast.unknown_error": "Erro desconhecido",
    "toast.update_all": "{count} plugin(s) atualizado(s).",
    "toast.random_title": "🎲 Tema sorteado!",
    "toast.random_body": "{name} foi instalado no seu Deck.",
    "toast.self_updated": "Theme Loader atualizado para v{version}. Ele será recarregado.",
  },
  en: {
    "app.title": "Theme Loader",
    "app.subtitle": "Dashboard and theme store for SteamOS",
    "app.back": "Back",
    "app.refresh": "Refresh list",
    "app.loading": "Loading store...",
    "app.empty": "No plugins found",
    "app.empty_hint": "Put .zip files in {path}",
    "app.support": "Support the project",
    "app.support_desc": "Enjoying the themes? Buy me a coffee ☕",

    "stats.plugins": "{count} plugins",
    "stats.installed": "{count} installed",
    "stats.updates": "{count} updates",
    "stats.plugins_one": "1 plugin",
    "stats.installed_one": "1 installed",
    "stats.updates_one": "1 update",

    "tab.all": "All",
    "tab.dashboards": "Dashboards",
    "tab.extras": "Extras",
    "tab.installed": "Installed",
    "tab.updates": "Updates",
    "tab.empty": "Nothing here in this tab.",

    "status.installed": "Installed",
    "status.not_installed": "Not installed",
    "status.update": "Update available",
    "status.up_to_date": "Up to date",
    "status.newer": "Newer version installed",

    "info.version": "Version",
    "info.installed": "Installed",
    "info.store": "In store",
    "info.size": "Size",
    "info.author": "Author",
    "info.prints": "Screenshots",

    "action.install": "Install",
    "action.update": "Update to v{version}",
    "action.reinstall": "Reinstall",
    "action.uninstall": "Uninstall",
    "action.downgrade": "Install store v{version}",
    "action.installing": "Installing...",
    "action.downloading": "Downloading... {percent}",
    "action.uninstalling": "Uninstalling...",
    "action.update_all": "Update all ({count})",
    "action.updating_all": "Updating...",
    "action.random": "Random theme",
    "action.rolling": "Rolling...",
    "action.details": "View details",

    "confirm.cancel": "Cancel",
    "confirm.uninstall_title": "Uninstall {name}?",
    "confirm.uninstall_body": "The plugin will be removed from Decky Loader. You can reinstall it from the store anytime.",
    "confirm.uninstall_ok": "Uninstall",
    "confirm.random_title": "Roll a random theme?",
    "confirm.random_body": "A random theme (preferably one you don't have yet) will be installed.",
    "confirm.random_ok": "Roll and install",
    "confirm.downgrade_title": "Install an older version?",
    "confirm.downgrade_body": "You have v{installed} installed, which is newer than store v{available}. Replace it?",
    "confirm.downgrade_ok": "Replace",

    "detail.features": "Highlights",
    "detail.prints": "Screenshots ({count})",
    "detail.loading_prints": "Loading screenshots...",
    "detail.no_prints": "No screenshots available.",
    "detail.expand": "Full screen",

    "gallery.close": "Close",

    "legend.select": "Select",
    "legend.back": "Back",
    "legend.random": "Random",
    "legend.tabs": "Tabs",
    "legend.prints": "Switch screenshot",
    "legend.fullscreen": "Full screen",

    "qam.open_store": "Open the store",
    "qam.store_desc": "Browse every theme with full-screen screenshots",
    "qam.themes": "Themes",

    "self.title": "New Theme Loader version",
    "self.update": "Update Theme Loader",

    "toast.installed": "{name} v{version} installed!",
    "toast.uninstalled": "{name} was uninstalled.",
    "toast.install_error": "Install failed",
    "toast.uninstall_error": "Uninstall failed",
    "toast.unknown_error": "Unknown error",
    "toast.update_all": "{count} plugin(s) updated.",
    "toast.random_title": "🎲 Random theme!",
    "toast.random_body": "{name} was installed on your Deck.",
    "toast.self_updated": "Theme Loader updated to v{version}. It will reload.",
  },
  de: {
    "app.title": "Theme Loader",
    "app.subtitle": "Dashboard- und Theme-Shop für SteamOS",
    "app.back": "Zurück",
    "app.refresh": "Liste aktualisieren",
    "app.loading": "Shop wird geladen...",
    "app.empty": "Keine Plugins gefunden",
    "app.empty_hint": ".zip-Dateien in {path} ablegen",
    "app.support": "Projekt unterstützen",
    "app.support_desc": "Gefallen dir die Themes? Spendier mir einen Kaffee ☕",

    "stats.plugins": "{count} Plugins",
    "stats.installed": "{count} installiert",
    "stats.updates": "{count} Updates",
    "stats.plugins_one": "1 Plugin",
    "stats.installed_one": "1 installiert",
    "stats.updates_one": "1 Update",

    "tab.all": "Alle",
    "tab.dashboards": "Dashboards",
    "tab.extras": "Extras",
    "tab.installed": "Installiert",
    "tab.updates": "Updates",
    "tab.empty": "In diesem Tab gibt es nichts.",

    "status.installed": "Installiert",
    "status.not_installed": "Nicht installiert",
    "status.update": "Update verfügbar",
    "status.up_to_date": "Aktuell",
    "status.newer": "Neuere Version installiert",

    "info.version": "Version",
    "info.installed": "Installiert",
    "info.store": "Im Shop",
    "info.size": "Größe",
    "info.author": "Autor",
    "info.prints": "Screenshots",

    "action.install": "Installieren",
    "action.update": "Auf v{version} aktualisieren",
    "action.reinstall": "Neu installieren",
    "action.uninstall": "Deinstallieren",
    "action.downgrade": "Shop-v{version} installieren",
    "action.installing": "Installiere...",
    "action.downloading": "Lade herunter... {percent}",
    "action.uninstalling": "Deinstalliere...",
    "action.update_all": "Alle aktualisieren ({count})",
    "action.updating_all": "Aktualisiere...",
    "action.random": "Zufälliges Theme",
    "action.rolling": "Würfle...",
    "action.details": "Details ansehen",

    "confirm.cancel": "Abbrechen",
    "confirm.uninstall_title": "{name} deinstallieren?",
    "confirm.uninstall_body": "Das Plugin wird aus dem Decky Loader entfernt. Du kannst es jederzeit über den Shop neu installieren.",
    "confirm.uninstall_ok": "Deinstallieren",
    "confirm.random_title": "Zufälliges Theme würfeln?",
    "confirm.random_body": "Ein zufälliges Theme (vorzugsweise eines, das du noch nicht hast) wird installiert.",
    "confirm.random_ok": "Würfeln und installieren",
    "confirm.downgrade_title": "Ältere Version installieren?",
    "confirm.downgrade_body": "Du hast v{installed} installiert, die neuer ist als die Shop-v{available}. Ersetzen?",
    "confirm.downgrade_ok": "Ersetzen",

    "detail.features": "Highlights",
    "detail.prints": "Screenshots ({count})",
    "detail.loading_prints": "Screenshots werden geladen...",
    "detail.no_prints": "Keine Screenshots verfügbar.",
    "detail.expand": "Vollbild",

    "gallery.close": "Schließen",

    "legend.select": "Auswählen",
    "legend.back": "Zurück",
    "legend.random": "Zufall",
    "legend.tabs": "Tabs",
    "legend.prints": "Screenshot wechseln",
    "legend.fullscreen": "Vollbild",

    "qam.open_store": "Shop öffnen",
    "qam.store_desc": "Alle Themes mit Vollbild-Screenshots ansehen",
    "qam.themes": "Themes",

    "self.title": "Neue Theme Loader Version",
    "self.update": "Theme Loader aktualisieren",

    "toast.installed": "{name} v{version} installiert!",
    "toast.uninstalled": "{name} wurde deinstalliert.",
    "toast.install_error": "Installation fehlgeschlagen",
    "toast.uninstall_error": "Deinstallation fehlgeschlagen",
    "toast.unknown_error": "Unbekannter Fehler",
    "toast.update_all": "{count} Plugin(s) aktualisiert.",
    "toast.random_title": "🎲 Zufälliges Theme!",
    "toast.random_body": "{name} wurde auf deinem Deck installiert.",
    "toast.self_updated": "Theme Loader auf v{version} aktualisiert. Er wird neu geladen.",
  },
  pl: {
    "app.title": "Theme Loader",
    "app.subtitle": "Sklep z dashboardami i motywami dla SteamOS",
    "app.back": "Wstecz",
    "app.refresh": "Odśwież listę",
    "app.loading": "Ładowanie sklepu...",
    "app.empty": "Nie znaleziono wtyczek",
    "app.empty_hint": "Umieść pliki .zip w {path}",
    "app.support": "Wesprzyj projekt",
    "app.support_desc": "Podobają ci się motywy? Postaw mi kawę ☕",

    "stats.plugins": "{count} wtyczek",
    "stats.installed": "{count} zainstalowanych",
    "stats.updates": "{count} aktualizacji",
    "stats.plugins_one": "1 wtyczka",
    "stats.installed_one": "1 zainstalowana",
    "stats.updates_one": "1 aktualizacja",

    "tab.all": "Wszystkie",
    "tab.dashboards": "Dashboardy",
    "tab.extras": "Dodatki",
    "tab.installed": "Zainstalowane",
    "tab.updates": "Aktualizacje",
    "tab.empty": "Nic tu nie ma.",

    "status.installed": "Zainstalowano",
    "status.not_installed": "Nie zainstalowano",
    "status.update": "Dostępna aktualizacja",
    "status.up_to_date": "Aktualna",
    "status.newer": "Zainstalowana nowsza wersja",

    "info.version": "Wersja",
    "info.installed": "Zainstalowana",
    "info.store": "W sklepie",
    "info.size": "Rozmiar",
    "info.author": "Autor",
    "info.prints": "Zrzuty",

    "action.install": "Zainstaluj",
    "action.update": "Aktualizuj do v{version}",
    "action.reinstall": "Zainstaluj ponownie",
    "action.uninstall": "Odinstaluj",
    "action.downgrade": "Zainstaluj v{version} ze sklepu",
    "action.installing": "Instalowanie...",
    "action.downloading": "Pobieranie... {percent}",
    "action.uninstalling": "Odinstalowywanie...",
    "action.update_all": "Aktualizuj wszystko ({count})",
    "action.updating_all": "Aktualizowanie...",
    "action.random": "Losowy motyw",
    "action.rolling": "Losowanie...",
    "action.details": "Zobacz szczegóły",

    "confirm.cancel": "Anuluj",
    "confirm.uninstall_title": "Odinstalować {name}?",
    "confirm.uninstall_body": "Wtyczka zostanie usunięta z Decky Loader. Możesz ją w każdej chwili zainstalować ponownie ze sklepu.",
    "confirm.uninstall_ok": "Odinstaluj",
    "confirm.random_title": "Wylosować motyw?",
    "confirm.random_body": "Zostanie zainstalowany losowy motyw (najlepiej taki, którego jeszcze nie masz).",
    "confirm.random_ok": "Losuj i zainstaluj",
    "confirm.downgrade_title": "Zainstalować starszą wersję?",
    "confirm.downgrade_body": "Masz zainstalowaną v{installed}, nowszą niż v{available} ze sklepu. Zastąpić?",
    "confirm.downgrade_ok": "Zastąp",

    "detail.features": "Najważniejsze",
    "detail.prints": "Zrzuty ekranu ({count})",
    "detail.loading_prints": "Ładowanie zrzutów...",
    "detail.no_prints": "Brak zrzutów ekranu.",
    "detail.expand": "Pełny ekran",

    "gallery.close": "Zamknij",

    "legend.select": "Wybierz",
    "legend.back": "Wstecz",
    "legend.random": "Losuj",
    "legend.tabs": "Karty",
    "legend.prints": "Zmień zrzut",
    "legend.fullscreen": "Pełny ekran",

    "qam.open_store": "Otwórz sklep",
    "qam.store_desc": "Przeglądaj motywy ze zrzutami na pełnym ekranie",
    "qam.themes": "Motywy",

    "self.title": "Nowa wersja Theme Loader",
    "self.update": "Aktualizuj Theme Loader",

    "toast.installed": "Zainstalowano {name} v{version}!",
    "toast.uninstalled": "Odinstalowano {name}.",
    "toast.install_error": "Błąd instalacji",
    "toast.uninstall_error": "Błąd odinstalowania",
    "toast.unknown_error": "Nieznany błąd",
    "toast.update_all": "Zaktualizowano wtyczki: {count}.",
    "toast.random_title": "🎲 Losowy motyw!",
    "toast.random_body": "{name} został zainstalowany na twoim Decku.",
    "toast.self_updated": "Theme Loader zaktualizowany do v{version}. Zostanie przeładowany.",
  },
};

/**
 * Detect system language from Steam client localization manager or browser/OS navigator.
 */
export function getSystemLanguage(): Language {
  const fromCode = (value: string): Language | null => {
    const v = value.toLowerCase();
    if (v.includes("portuguese") || v.includes("brazilian") || v.startsWith("pt")) return "pt";
    if (v.includes("german") || v.includes("deutsch") || v.startsWith("de")) return "de";
    if (v.includes("polish") || v.includes("polski") || v.startsWith("pl")) return "pl";
    if (v.includes("english") || v.startsWith("en")) return "en";
    return null;
  };

  try {
    const steamLang = (window as any).LocalizationManager?.m_strCurrentLanguage;
    const lang = steamLang && fromCode(steamLang);
    if (lang) return lang;
  } catch {}

  try {
    const candidates = [navigator.language, ...(navigator.languages || [])];
    for (const c of candidates) {
      const lang = c && fromCode(c);
      if (lang) return lang;
    }
  } catch {}

  return "en";
}

let currentLang: Language = getSystemLanguage();

export function getCurrentLanguage(): Language {
  return currentLang;
}

/**
 * Translate a key into the active language with optional parameter interpolation.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = translations[currentLang] || translations.en;
  let text = dict[key] || translations.en[key] || translations.pt[key] || key;

  if (params) {
    Object.keys(params).forEach((paramKey) => {
      text = text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(params[paramKey]));
    });
  }

  return text;
}

/** Like t(), but uses the "<key>_one" variant when count is 1. */
export function tn(key: string, count: number): string {
  const one = `${key}_one`;
  return count === 1 && t(one) !== one ? t(one) : t(key, { count });
}
