import { ConfirmModal, Navigation, classMap, findSP, showModal } from "@decky/ui";
import { FC, ReactNode, useEffect } from "react";
import {
  FaArrowCircleUp,
  FaCheckCircle,
  FaCoffee,
  FaGamepad,
  FaPlaystation,
  FaTrophy,
  FaXbox,
} from "react-icons/fa";
import { PluginItem } from "./types";
import { t } from "./i18n";

export const STORE_ROUTE = "/theme-loader";
export const DETAIL_ROUTE = "/theme-loader/detail";
export const SUPPORT_URL = "https://buymeacoffee.com/kromossomoc";
export const USER_ZIPS_DIR = "~/Documents/theme-loader";

export const COLORS = {
  bg: "#0b0e14",
  surface: "rgba(255, 255, 255, 0.06)",
  surfaceStrong: "rgba(255, 255, 255, 0.1)",
  border: "rgba(255, 255, 255, 0.12)",
  text: "#ffffff",
  textDim: "rgba(255, 255, 255, 0.68)",
  textFaint: "rgba(255, 255, 255, 0.45)",
  focus: "#66c0f4",
  installed: "#3ddc84",
  update: "#ffb02e",
  danger: "#ff6b6b",
  coffee: "#ffdd00",
};

export const FONT = "'Motiva Sans', 'Segoe UI', Arial, sans-serif";

/** Focus, hover and animation styles shared by the full-screen pages. */
export const SHARED_CSS = `
  .tl-focus, .tl-card, .tl-thumb, .tl-tab {
    outline: none !important;
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;
    transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s ease,
      border-color 0.18s ease, background-color 0.18s ease, opacity 0.18s ease !important;
  }
  .tl-focus.gpfocus, .tl-focus:focus-visible, .tl-focus.tl-focused {
    transform: scale(1.04);
    box-shadow: 0 0 0 2px #fff, 0 0 0 5px rgba(102, 192, 244, 0.8), 0 6px 20px rgba(0, 0, 0, 0.5) !important;
    z-index: 5;
  }
  .tl-card.gpfocus, .tl-card:focus-visible, .tl-card.tl-focused {
    transform: translateY(-6px) scale(1.04);
    box-shadow: 0 0 0 3px #fff, 0 0 0 7px var(--tl-accent, #66c0f4), 0 18px 40px rgba(0, 0, 0, 0.7) !important;
    z-index: 10;
  }
  .tl-thumb { opacity: 0.6; }
  .tl-thumb.tl-active { opacity: 1; }
  .tl-thumb.gpfocus, .tl-thumb:focus-visible, .tl-thumb.tl-focused {
    opacity: 1;
    transform: scale(1.08);
    box-shadow: 0 0 0 2px #fff, 0 0 0 5px rgba(102, 192, 244, 0.8), 0 8px 20px rgba(0, 0, 0, 0.7) !important;
    z-index: 10;
  }
  .tl-tab.gpfocus, .tl-tab:focus-visible, .tl-tab.tl-focused {
    box-shadow: 0 0 0 2px #fff, 0 0 0 4px rgba(102, 192, 244, 0.8) !important;
  }
  .tl-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
  .tl-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 3px; }
  .tl-scroll::-webkit-scrollbar-track { background: transparent; }
  @keyframes tl-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes tl-rise-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  @keyframes tl-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(255, 176, 46, 0.55); } 50% { box-shadow: 0 0 0 6px rgba(255, 176, 46, 0); } }
  @keyframes tl-spin { to { transform: rotate(360deg); } }
  .tl-fade-in { animation: tl-fade-in 0.35s ease both; }
  .tl-rise-in { animation: tl-rise-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
  .tl-pulse { animation: tl-pulse 1.8s ease-in-out infinite; }
  .tl-spin { animation: tl-spin 0.9s linear infinite; display: inline-block; }
  @keyframes tl-drop { 0% { transform: translateY(-3px); opacity: 0.4; } 60% { transform: translateY(1px); opacity: 1; } 100% { transform: translateY(2px); opacity: 0.4; } }
  .tl-drop { animation: tl-drop 0.9s ease-in infinite; display: inline-block; }
`;

export const ConsoleIcon: FC<{ id: string; size?: number }> = ({ id, size = 14 }) => {
  if (id.includes("ps3") || id.includes("ps5")) return <FaPlaystation size={size} />;
  if (id.includes("xbox")) return <FaXbox size={size} />;
  if (id.includes("achievo")) return <FaTrophy size={size} />;
  return <FaGamepad size={size} />;
};

export function formatSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

const HIDE_HEADER_STYLE_ID = "theme-loader-hide-header";
let headerHolds = 0;

/** Steam hashes its class names, so the top bar is found by the stable keys of its module. */
function steamHeaderSelector(): string | null {
  const hashes = new Set<string>();
  for (const m of classMap as Record<string, string>[]) {
    if (m?.Header && m?.HeaderItem && m?.Clock && m?.DashboardBar) hashes.add(m.Header);
  }
  return hashes.size ? [...hashes].map((h) => `.${CSS.escape(h)}`).join(", ") : null;
}

function gameModeDocument(): Document {
  try {
    return findSP()?.document || document;
  } catch {
    return document;
  }
}

/** Hides Steam's top bar (clock, battery, profile) while a full-screen Theme Loader page is open. */
export function useHideSteamHeader() {
  useEffect(() => {
    headerHolds++;
    const doc = gameModeDocument();
    const selector = steamHeaderSelector();
    if (selector && doc.head && !doc.getElementById(HIDE_HEADER_STYLE_ID)) {
      const style = doc.createElement("style");
      style.id = HIDE_HEADER_STYLE_ID;
      style.textContent = `${selector} { visibility: hidden !important; pointer-events: none !important; }`;
      doc.head.appendChild(style);
    }
    return () => {
      headerHolds--;
      // Going from the store to a detail page unmounts one page before mounting the next,
      // so wait a moment instead of flashing the bar back in between.
      setTimeout(() => {
        if (headerHolds === 0) doc.getElementById(HIDE_HEADER_STYLE_ID)?.remove();
      }, 300);
    };
  }, []);
}

/**
 * Scrolls only the element's direct scroll container so it is fully visible.
 * (scrollIntoView would also scroll the overflow:hidden page root and shift the whole screen.)
 */
export function revealInParent(el: HTMLElement, center = false) {
  const parent = el.parentElement;
  if (!parent) return;
  const margin = 16;
  const left = el.getBoundingClientRect().left - parent.getBoundingClientRect().left + parent.scrollLeft;
  const right = left + el.offsetWidth;
  let target = parent.scrollLeft;
  if (center) target = left - (parent.clientWidth - el.offsetWidth) / 2;
  else if (left - margin < parent.scrollLeft) target = left - margin;
  else if (right + margin > parent.scrollLeft + parent.clientWidth) target = right + margin - parent.clientWidth;
  parent.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
}

export function openSupportPage() {
  Navigation.NavigateToExternalWeb(SUPPORT_URL);
}

/** Small colored chip with the console badge (PS5, Xbox Series...). */
export const ConsoleBadge: FC<{ item: PluginItem; large?: boolean }> = ({ item, large }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      backgroundColor: item.color,
      color: "#fff",
      fontSize: large ? "12px" : "10.5px",
      fontWeight: 700,
      padding: large ? "4px 10px" : "3px 8px",
      borderRadius: "6px",
      letterSpacing: "0.5px",
      textTransform: "uppercase",
      boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
      whiteSpace: "nowrap",
    }}
  >
    <ConsoleIcon id={item.id} size={large ? 13 : 11} />
    {item.badge}
  </span>
);

/** Install state chip: update available / installed / not installed. */
export const StatusPill: FC<{ item: PluginItem; compact?: boolean }> = ({ item, compact }) => {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: compact ? "2px 7px" : "4px 10px",
    borderRadius: "999px",
    fontSize: compact ? "10px" : "11.5px",
    fontWeight: 700,
    whiteSpace: "nowrap" as const,
  };
  if (item.updateAvailable) {
    return (
      <span
        className="tl-pulse"
        style={{ ...base, backgroundColor: COLORS.update, color: "#1a1200" }}
      >
        <FaArrowCircleUp size={compact ? 10 : 12} /> {t("status.update")}
      </span>
    );
  }
  if (item.installed) {
    return (
      <span
        style={{
          ...base,
          backgroundColor: "rgba(61, 220, 132, 0.16)",
          color: COLORS.installed,
          border: "1px solid rgba(61, 220, 132, 0.45)",
        }}
      >
        <FaCheckCircle size={compact ? 10 : 12} /> {t("status.installed")}
      </span>
    );
  }
  return (
    <span
      style={{
        ...base,
        backgroundColor: "rgba(0,0,0,0.45)",
        color: COLORS.textDim,
        border: `1px solid ${COLORS.border}`,
      }}
    >
      {t("status.not_installed")}
    </span>
  );
};

/** Gamepad glyph used in the footer legend. */
export const ButtonGlyph: FC<{ label: string; color?: string }> = ({ label, color }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: "20px",
      height: "20px",
      padding: label.length > 1 ? "0 6px" : 0,
      borderRadius: label.length > 1 ? "5px" : "50%",
      backgroundColor: color || "rgba(255,255,255,0.88)",
      color: "#0b0e14",
      fontSize: "10.5px",
      fontWeight: 800,
    }}
  >
    {label}
  </span>
);

export const LegendItem: FC<{ glyph: string; children: ReactNode }> = ({ glyph, children }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: "7px" }}>
    <ButtonGlyph label={glyph} />
    {children}
  </span>
);

/** Ko-fi style "Buy me a coffee" button content (wrap it in a focusable). */
export const CoffeeLabel: FC<{ text?: string }> = ({ text }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: "7px" }}>
    <FaCoffee size={13} /> {text || t("app.support")}
  </span>
);

/** Primary action label for an item, based on its version state. */
export function primaryActionLabel(item: PluginItem): string {
  switch (item.versionState) {
    case "update_available":
      return t("action.update", { version: item.version });
    case "newer_installed":
      return t("action.downgrade", { version: item.version });
    case "not_installed":
      return t("action.install");
    default:
      return t("action.reinstall");
  }
}

function confirm(title: string, description: string, okText: string, onOK: () => void) {
  showModal(
    <ConfirmModal
      strTitle={title}
      strDescription={description}
      strOKButtonText={okText}
      strCancelButtonText={t("confirm.cancel")}
      onOK={onOK}
    />
  );
}

export function confirmUninstall(item: PluginItem, onOK: () => void) {
  confirm(
    t("confirm.uninstall_title", { name: item.name }),
    t("confirm.uninstall_body"),
    t("confirm.uninstall_ok"),
    onOK
  );
}

export function confirmRandom(onOK: () => void) {
  confirm(t("confirm.random_title"), t("confirm.random_body"), t("confirm.random_ok"), onOK);
}

/** Runs the primary install action, asking first when it would downgrade. */
export function runPrimaryAction(item: PluginItem, install: (id: string) => void) {
  if (item.versionState === "newer_installed") {
    confirm(
      t("confirm.downgrade_title"),
      t("confirm.downgrade_body", { installed: item.installedVersion, available: item.version }),
      t("confirm.downgrade_ok"),
      () => install(item.id)
    );
    return;
  }
  install(item.id);
}
