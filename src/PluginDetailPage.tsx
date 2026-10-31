import { Focusable, GamepadButton, GamepadEvent, Navigation } from "@decky/ui";
import { CSSProperties, FC, FocusEvent, ReactNode, useEffect, useRef, useState } from "react";
import {
  FaArrowCircleUp,
  FaArrowLeft,
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
  FaDownload,
  FaExpand,
  FaRedo,
  FaSyncAlt,
  FaTrash,
} from "react-icons/fa";
import { PluginItem, ScreenshotItem } from "./types";
import { useThemeLoaderStore, fetchFullScreenshot, getCachedFullScreenshot, downloadPercent } from "./store";
import { t } from "./i18n";
import {
  COLORS,
  FONT,
  SHARED_CSS,
  STORE_ROUTE,
  ConsoleBadge,
  LegendItem,
  StatusPill,
  confirmUninstall,
  formatSize,
  primaryActionLabel,
  runPrimaryAction,
  revealInParent,
  useHideSteamHeader,
} from "./shared";
import { ScreenshotModal } from "./ScreenshotModal";

function focusElement(el: HTMLElement | null) {
  if (!el) return;
  el.focus();
  try {
    (window as any).FocusNavController?.FocusElement?.(el);
  } catch {}
}

function primaryStyle(item: PluginItem): CSSProperties {
  switch (item.versionState) {
    case "update_available":
      return { background: `linear-gradient(90deg, #ff9d00 0%, ${COLORS.update} 100%)`, color: "#1a1200" };
    case "not_installed":
      return { background: `linear-gradient(90deg, ${item.color} 0%, ${item.accent} 100%)`, color: "#fff" };
    default:
      return { background: COLORS.surfaceStrong, color: "#fff", border: `1px solid ${COLORS.border}` };
  }
}

const InfoCell: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div style={{ padding: "9px 12px", borderRadius: "10px", backgroundColor: COLORS.surface }}>
    <div style={{ fontSize: "10.5px", color: COLORS.textFaint, textTransform: "uppercase", letterSpacing: "0.6px" }}>
      {label}
    </div>
    <div style={{ fontSize: "13px", fontWeight: 700, marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      {children}
    </div>
  </div>
);

export const PluginDetailPage: FC = () => {
  const store = useThemeLoaderStore();
  useHideSteamHeader();
  const { selectedPlugin: item, loading, isBusy, busyPluginId } = store;

  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([]);
  const [loadingShots, setLoadingShots] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [fullSrc, setFullSrc] = useState<string | null>(null);
  const [galleryIdx, setGalleryIdx] = useState<number | null>(null);

  const primaryBtnRef = useRef<HTMLDivElement | null>(null);

  // If no plugin is selected (e.g. direct reload), go back to the store
  useEffect(() => {
    if (!loading && !item) Navigation.Navigate(STORE_ROUTE);
  }, [loading, item]);

  useEffect(() => {
    if (!item) return;
    let alive = true;
    setLoadingShots(true);
    store
      .fetchScreenshots(item.id)
      .then((shots) => {
        if (!alive) return;
        setScreenshots(shots);
        setActiveIdx(0);
      })
      .finally(() => alive && setLoadingShots(false));
    return () => {
      alive = false;
    };
  }, [item?.id]);

  // Load the full-resolution print for the active screenshot (thumbnail is shown meanwhile)
  const current = screenshots[activeIdx];
  useEffect(() => {
    if (!item || !current) return;
    const cached = getCachedFullScreenshot(item.id, current.filename);
    setFullSrc(cached);
    if (cached) return;
    let alive = true;
    fetchFullScreenshot(item.id, current.filename).then((src) => alive && src && setFullSrc(src));
    return () => {
      alive = false;
    };
  }, [item?.id, current?.filename]);

  // Focus the primary button when the page opens or the gallery closes
  useEffect(() => {
    if (galleryIdx !== null) return;
    const timers = [60, 200].map((ms) => setTimeout(() => focusElement(primaryBtnRef.current), ms));
    return () => timers.forEach(clearTimeout);
  }, [galleryIdx, item?.id]);

  if (!item) {
    return (
      <div style={{ position: "fixed", inset: 0, backgroundColor: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textDim, zIndex: 20 }}>
        <FaSyncAlt className="tl-spin" />
      </div>
    );
  }

  const isThisBusy = isBusy && busyPluginId === item.id;
  const isDownloading = isThisBusy && store.download?.pluginId === item.id;
  const total = screenshots.length;
  const step = (delta: number) => total > 1 && setActiveIdx((i) => (i + delta + total) % total);

  const onButtonDown = (evt: GamepadEvent) => {
    if (galleryIdx !== null) return;
    if (evt.detail.button === GamepadButton.BUMPER_LEFT) step(-1);
    else if (evt.detail.button === GamepadButton.BUMPER_RIGHT) step(1);
  };

  const heroSrc = fullSrc || current?.thumbUrl || item.cover;

  return (
    <Focusable
      flow-children="column"
      noFocusRing={true}
      onButtonDown={onButtonDown}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: COLORS.bg,
        color: COLORS.text,
        display: "flex",
        flexDirection: "column",
        zIndex: 20,
        overflow: "hidden",
        fontFamily: FONT,
      }}
    >
      <style>{SHARED_CSS}</style>

      {/* Backdrop */}
      {(current?.thumbUrl || item.cover) && (
        <div
          key={`bg-${current?.filename}`}
          className="tl-fade-in"
          style={{
            position: "absolute",
            inset: "-40px",
            backgroundImage: `url(${current?.thumbUrl || item.cover})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(30px) saturate(1.2)",
            opacity: 0.35,
            pointerEvents: "none",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 85% 10%, ${item.color}45 0%, transparent 55%),
            linear-gradient(180deg, rgba(11,14,20,0.5) 0%, rgba(11,14,20,0.85) 60%, #0b0e14 100%)`,
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <Focusable
        flow-children="row"
        noFocusRing={true}
        style={{ position: "relative", display: "flex", alignItems: "center", gap: "14px", padding: "16px 32px 12px" }}
      >
        <Focusable
          onActivate={() => Navigation.NavigateBack()}
          onClick={() => Navigation.NavigateBack()}
          className="tl-focus"
          focusClassName="tl-focused"
          noFocusRing={true}
          style={{
            padding: "9px 15px",
            borderRadius: "10px",
            backgroundColor: COLORS.surfaceStrong,
            border: `1px solid ${COLORS.border}`,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          <FaArrowLeft size={12} /> {t("app.back")}
        </Focusable>
        <ConsoleBadge item={item} large />
        <div style={{ fontSize: "22px", fontWeight: 800 }}>{item.name}</div>
        <StatusPill item={item} />
      </Focusable>

      {/* Body */}
      <div
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)",
          gap: "26px",
          padding: "4px 32px 14px",
        }}
      >
        {/* Left: viewer + filmstrip */}
        <Focusable flow-children="column" noFocusRing={true} style={{ display: "flex", flexDirection: "column", gap: "12px", minHeight: 0 }}>
          <Focusable
            onActivate={() => total > 0 && setGalleryIdx(activeIdx)}
            onClick={() => total > 0 && setGalleryIdx(activeIdx)}
            className="tl-focus"
            focusClassName="tl-focused"
            noFocusRing={true}
            style={{
              flex: 1,
              minHeight: 0,
              position: "relative",
              borderRadius: "16px",
              overflow: "hidden",
              backgroundColor: "#000",
              boxShadow: `0 20px 50px rgba(0,0,0,0.6), 0 0 0 1px ${COLORS.border}`,
            }}
          >
            {loadingShots && !heroSrc ? (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textDim }}>
                {t("detail.loading_prints")}
              </div>
            ) : heroSrc ? (
              <img
                key={current?.filename}
                className="tl-fade-in"
                src={heroSrc}
                alt={current?.title}
                style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
              />
            ) : (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textDim }}>
                {t("detail.no_prints")}
              </div>
            )}

            {current && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  padding: "28px 16px 12px",
                  background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.8) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                <span>{current.title}</span>
                <span style={{ display: "flex", alignItems: "center", gap: "12px", color: COLORS.textDim, fontWeight: 600, fontSize: "12px" }}>
                  {activeIdx + 1} / {total}
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <FaExpand size={11} /> {t("detail.expand")}
                  </span>
                </span>
              </div>
            )}
            {total > 1 &&
              ([-1, 1] as const).map((dir) => (
                <div
                  key={dir}
                  onClick={(e) => {
                    e.stopPropagation();
                    step(dir);
                  }}
                  style={{
                    position: "absolute",
                    top: "50%",
                    [dir < 0 ? "left" : "right"]: "12px",
                    transform: "translateY(-50%)",
                    width: "38px",
                    height: "38px",
                    borderRadius: "50%",
                    backgroundColor: "rgba(0,0,0,0.55)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  {dir < 0 ? <FaChevronLeft size={14} /> : <FaChevronRight size={14} />}
                </div>
              ))}
          </Focusable>

          {total > 1 && (
            <Focusable
              flow-children="row"
              noFocusRing={true}
              className="tl-scroll"
              style={{ display: "flex", gap: "10px", overflowX: "auto", padding: "6px 4px", flexShrink: 0 }}
            >
              {screenshots.map((shot, idx) => (
                <Focusable
                  key={shot.filename}
                  onActivate={() => setGalleryIdx(idx)}
                  onClick={() => setActiveIdx(idx)}
                  onGamepadFocus={() => setActiveIdx(idx)}
                  onFocus={(e: FocusEvent<HTMLDivElement>) =>
                    revealInParent(e.currentTarget)
                  }
                  className={`tl-thumb${idx === activeIdx ? " tl-active" : ""}`}
                  focusClassName="tl-focused"
                  noFocusRing={true}
                  style={{
                    flexShrink: 0,
                    width: "112px",
                    height: "70px",
                    borderRadius: "9px",
                    overflow: "hidden",
                    backgroundColor: "#000",
                    border: idx === activeIdx ? `2px solid ${item.color}` : `1px solid ${COLORS.border}`,
                  }}
                >
                  <img src={shot.thumbUrl} alt={shot.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </Focusable>
              ))}
            </Focusable>
          )}
        </Focusable>

        {/* Right: version + actions + description */}
        <Focusable
          flow-children="column"
          noFocusRing={true}
          className="tl-scroll"
          style={{ display: "flex", flexDirection: "column", gap: "14px", overflowY: "auto", minHeight: 0, padding: "4px 6px 4px 2px" }}
        >
          {/* Version panel */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "14px",
              backgroundColor: "rgba(0,0,0,0.35)",
              border: `1px solid ${item.updateAvailable ? "rgba(255,176,46,0.55)" : COLORS.border}`,
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "13px" }}>
              <div>
                <div style={{ fontSize: "10.5px", color: COLORS.textFaint, textTransform: "uppercase", letterSpacing: "0.6px" }}>
                  {t("info.installed")}
                </div>
                <div style={{ fontSize: "17px", fontWeight: 800, marginTop: "2px", color: item.installed ? COLORS.text : COLORS.textFaint }}>
                  {item.installed ? `v${item.installedVersion || "?"}` : "—"}
                </div>
              </div>
              <div style={{ color: item.updateAvailable ? COLORS.update : COLORS.textFaint, fontSize: "18px" }}>→</div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "10.5px", color: COLORS.textFaint, textTransform: "uppercase", letterSpacing: "0.6px" }}>
                  {t("info.store")}
                </div>
                <div style={{ fontSize: "17px", fontWeight: 800, marginTop: "2px", color: item.updateAvailable ? COLORS.update : COLORS.text }}>
                  v{item.version}
                </div>
              </div>
            </div>

            <Focusable flow-children="row" noFocusRing={true} style={{ display: "flex", gap: "10px" }}>
              <Focusable
                ref={primaryBtnRef}
                preferredFocus={true}
                onActivate={() => !isBusy && runPrimaryAction(item, store.handleInstall)}
                onClick={() => !isBusy && runPrimaryAction(item, store.handleInstall)}
                className="tl-focus"
                focusClassName="tl-focused"
                noFocusRing={true}
                style={{
                  flex: 1,
                  padding: "13px 16px",
                  borderRadius: "11px",
                  fontSize: "14.5px",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "9px",
                  boxShadow: "0 8px 22px rgba(0,0,0,0.35)",
                  opacity: isBusy && !isThisBusy ? 0.5 : 1,
                  ...primaryStyle(item),
                }}
              >
                {isDownloading ? (
                  <>
                    <FaDownload className="tl-drop" size={13} />{" "}
                    {t("action.downloading", { percent: downloadPercent(store.download) })}
                  </>
                ) : isThisBusy ? (
                  <>
                    <FaSyncAlt className="tl-spin" size={13} /> {t("action.installing")}
                  </>
                ) : (
                  <>
                    {item.versionState === "update_available" ? (
                      <FaArrowCircleUp size={15} />
                    ) : item.installed ? (
                      <FaRedo size={13} />
                    ) : (
                      <FaDownload size={14} />
                    )}
                    {primaryActionLabel(item)}
                  </>
                )}
              </Focusable>

              {item.installed && (
                <Focusable
                  onActivate={() => !isBusy && confirmUninstall(item, () => store.handleUninstall(item.id))}
                  onClick={() => !isBusy && confirmUninstall(item, () => store.handleUninstall(item.id))}
                  className="tl-focus"
                  focusClassName="tl-focused"
                  noFocusRing={true}
                  title={t("action.uninstall")}
                  style={{
                    padding: "13px 15px",
                    borderRadius: "11px",
                    backgroundColor: "rgba(255, 107, 107, 0.12)",
                    border: "1px solid rgba(255, 107, 107, 0.45)",
                    color: COLORS.danger,
                    fontSize: "13.5px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "7px",
                    opacity: isBusy ? 0.5 : 1,
                  }}
                >
                  <FaTrash size={12} /> {t("action.uninstall")}
                </Focusable>
              )}
            </Focusable>
          </div>

          <div style={{ fontSize: "14px", lineHeight: 1.5, color: "rgba(255,255,255,0.9)" }}>{item.tagline}</div>

          {item.features.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
              <div style={{ fontSize: "11px", fontWeight: 800, color: COLORS.textFaint, textTransform: "uppercase", letterSpacing: "0.8px" }}>
                {t("detail.features")}
              </div>
              {item.features.map((feat, idx) => (
                <div key={idx} style={{ display: "flex", gap: "9px", fontSize: "12.5px", lineHeight: 1.45, color: "rgba(255,255,255,0.85)" }}>
                  <FaCheck size={11} color={item.accent} style={{ marginTop: "3px", flexShrink: 0 }} />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <InfoCell label={t("info.version")}>v{item.version}</InfoCell>
            <InfoCell label={t("info.size")}>{formatSize(item.zipSize)}</InfoCell>
            <InfoCell label={t("info.author")}>{item.author}</InfoCell>
            <InfoCell label={t("info.prints")}>{item.screenshotsCount}</InfoCell>
          </div>
        </Focusable>
      </div>

      {/* Footer legend */}
      <div
        style={{
          position: "relative",
          padding: "9px 32px",
          backgroundColor: "rgba(0, 0, 0, 0.45)",
          borderTop: `1px solid ${COLORS.border}`,
          display: "flex",
          alignItems: "center",
          gap: "20px",
          fontSize: "12px",
          color: COLORS.textDim,
        }}
      >
        <LegendItem glyph="A">{t("legend.select")}</LegendItem>
        <LegendItem glyph="B">{t("legend.back")}</LegendItem>
        <LegendItem glyph="L1/R1">{t("legend.prints")}</LegendItem>
      </div>

      {galleryIdx !== null && (
        <ScreenshotModal
          pluginId={item.id}
          pluginName={item.name}
          accent={item.color}
          screenshots={screenshots}
          initialIndex={galleryIdx}
          onIndexChange={setActiveIdx}
          closeModal={() => setGalleryIdx(null)}
        />
      )}
    </Focusable>
  );
};
