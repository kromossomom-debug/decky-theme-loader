import { Focusable, GamepadButton, GamepadEvent, Navigation } from "@decky/ui";
import { CSSProperties, FC, FocusEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  FaArrowCircleUp,
  FaArrowLeft,
  FaCheck,
  FaDice,
  FaImages,
  FaLayerGroup,
  FaSyncAlt,
} from "react-icons/fa";
import { PluginItem } from "./types";
import { useThemeLoaderStore, fetchFullScreenshot, downloadPercent } from "./store";
import { t, tn } from "./i18n";
import {
  COLORS,
  DETAIL_ROUTE,
  FONT,
  SHARED_CSS,
  USER_ZIPS_DIR,
  ButtonGlyph,
  CoffeeLabel,
  ConsoleBadge,
  LegendItem,
  StatusPill,
  confirmRandom,
  openSupportPage,
  revealInParent,
  useHideSteamHeader,
} from "./shared";

type TabId = "all" | "dashboards" | "extras" | "installed" | "updates";

const TABS: { id: TabId; filter: (p: PluginItem) => boolean }[] = [
  { id: "all", filter: () => true },
  { id: "dashboards", filter: (p) => p.isDashboard },
  { id: "extras", filter: (p) => !p.isDashboard },
  { id: "installed", filter: (p) => p.installed },
  { id: "updates", filter: (p) => p.updateAvailable },
];

function focusElement(el: HTMLElement | null) {
  if (!el) return;
  el.focus();
  try {
    (window as any).FocusNavController?.FocusElement?.(el);
  } catch {}
}

/** Header button with icon + label. */
const HeaderButton: FC<{
  onClick: () => void;
  background?: string;
  color?: string;
  border?: string;
  title?: string;
  children: ReactNode;
}> = ({ onClick, background, color, border, title, children }) => (
  <Focusable
    onActivate={onClick}
    onClick={onClick}
    className="tl-focus"
    focusClassName="tl-focused"
    noFocusRing={true}
    title={title}
    style={{
      padding: "9px 15px",
      borderRadius: "10px",
      background: background || COLORS.surfaceStrong,
      border: border || `1px solid ${COLORS.border}`,
      color: color || COLORS.text,
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "13px",
      fontWeight: 700,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </Focusable>
);

export const StorePage: FC = () => {
  const store = useThemeLoaderStore();
  useHideSteamHeader();
  const { catalog, loading, isBusy, selectedPluginId, updatesCount, installedCount, selfUpdate } = store;

  const [tab, setTab] = useState<TabId>("all");
  const [focusedId, setFocusedId] = useState<string | null>(selectedPluginId);
  const [heroImage, setHeroImage] = useState<Record<string, string>>({});
  const [rolling, setRolling] = useState(false);
  const [rollName, setRollName] = useState("");

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const visible = useMemo(
    () => catalog.filter(TABS.find((x) => x.id === tab)!.filter),
    [catalog, tab]
  );
  const focused =
    visible.find((p) => p.id === focusedId) || catalog.find((p) => p.id === focusedId) || visible[0] || null;

  // Upgrade the spotlight from the small cover thumbnail to the full-resolution print
  useEffect(() => {
    if (!focused || heroImage[focused.id]) return;
    let alive = true;
    const timer = setTimeout(async () => {
      const shots = await store.fetchScreenshots(focused.id);
      if (!alive || shots.length === 0) return;
      const full = await fetchFullScreenshot(focused.id, shots[0].filename);
      if (alive && full) setHeroImage((prev) => ({ ...prev, [focused.id]: full }));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [focused?.id]);

  // Put gamepad focus on the remembered card (or the first one) when the page/tab opens
  useEffect(() => {
    if (loading || visible.length === 0) return;
    const target =
      (selectedPluginId && visible.some((p) => p.id === selectedPluginId)
        ? cardRefs.current[selectedPluginId]
        : null) || cardRefs.current[visible[0].id];
    const timers = [0, 80, 250].map((ms) => setTimeout(() => focusElement(target), ms));
    return () => timers.forEach(clearTimeout);
  }, [loading, tab, visible.length]);

  const openPlugin = (item: PluginItem) => {
    store.setSelectedPluginId(item.id);
    Navigation.Navigate(DETAIL_ROUTE);
  };

  const switchTab = (delta: number) => {
    const idx = TABS.findIndex((x) => x.id === tab);
    setTab(TABS[(idx + delta + TABS.length) % TABS.length].id);
  };

  const startRandom = () => {
    if (isBusy || rolling || catalog.length === 0) return;
    confirmRandom(async () => {
      setRolling(true);
      let i = 0;
      const spin = setInterval(() => setRollName(catalog[i++ % catalog.length].name), 110);
      try {
        const res = await store.handleRollRandom();
        if (res?.success && res.plugin_id) {
          setFocusedId(res.plugin_id);
          setTab("all");
        }
      } finally {
        clearInterval(spin);
        setRolling(false);
      }
    });
  };

  const onButtonDown = (evt: GamepadEvent) => {
    const button = evt.detail.button;
    if (button === GamepadButton.BUMPER_LEFT) switchTab(-1);
    else if (button === GamepadButton.BUMPER_RIGHT) switchTab(1);
  };

  const accent = focused?.color || COLORS.focus;
  const heroSrc = focused ? heroImage[focused.id] || focused.cover : "";

  return (
    <Focusable
      flow-children="column"
      noFocusRing={true}
      onButtonDown={onButtonDown}
      onOptionsButton={startRandom}
      onOptionsActionDescription={t("legend.random")}
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

      {/* Dynamic backdrop: blurred print of the focused item + its brand color */}
      {heroSrc && (
        <div
          key={`bg-${focused?.id}`}
          className="tl-fade-in"
          style={{
            position: "absolute",
            inset: "-40px",
            backgroundImage: `url(${focused?.cover || heroSrc})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(28px) saturate(1.2)",
            opacity: 0.4,
            pointerEvents: "none",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 80% 0%, ${accent}40 0%, transparent 55%),
            linear-gradient(180deg, rgba(11,14,20,0.55) 0%, rgba(11,14,20,0.82) 55%, #0b0e14 100%)`,
          transition: "background 0.4s ease",
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <Focusable
        flow-children="row"
        noFocusRing={true}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: "14px",
          padding: "16px 32px 10px",
        }}
      >
        <HeaderButton onClick={() => Navigation.NavigateBack()}>
          <FaArrowLeft size={12} /> {t("app.back")}
        </HeaderButton>

        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "11px",
            background: "linear-gradient(135deg, #1a9fff 0%, #7b2ff7 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 16px rgba(26, 159, 255, 0.45)",
            flexShrink: 0,
          }}
        >
          <FaLayerGroup size={20} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "21px", fontWeight: 800, lineHeight: 1.1 }}>{t("app.title")}</div>
          <div style={{ fontSize: "12px", color: COLORS.textDim, marginTop: "2px" }}>
            {tn("stats.plugins", catalog.length)} · {tn("stats.installed", installedCount)}
            {updatesCount > 0 && (
              <span style={{ color: COLORS.update, fontWeight: 700 }}>
                {" "}
                · {tn("stats.updates", updatesCount)}
              </span>
            )}
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {updatesCount > 0 && (
          <HeaderButton
            onClick={() => store.handleUpdateAll()}
            background={COLORS.update}
            color="#1a1200"
            border="1px solid transparent"
          >
            <FaArrowCircleUp size={14} />
            {store.download
              ? t("action.downloading", { percent: downloadPercent(store.download) })
              : isBusy
                ? t("action.updating_all")
                : t("action.update_all", { count: updatesCount })}
          </HeaderButton>
        )}
        <HeaderButton
          onClick={startRandom}
          background="linear-gradient(90deg, #1a9fff 0%, #7b2ff7 100%)"
          border="1px solid transparent"
        >
          <FaDice size={15} /> {rolling ? t("action.rolling") : t("action.random")}
          <ButtonGlyph label="Y" color="rgba(255,255,255,0.9)" />
        </HeaderButton>
        <HeaderButton onClick={() => store.refreshCatalog(true)} title={t("app.refresh")}>
          <FaSyncAlt size={13} className={store.refreshing ? "tl-spin" : undefined} />
        </HeaderButton>
        <HeaderButton
          onClick={openSupportPage}
          background={COLORS.coffee}
          color="#1a1200"
          border="1px solid transparent"
        >
          <CoffeeLabel />
        </HeaderButton>
      </Focusable>

      {/* Theme Loader self-update banner */}
      {selfUpdate?.updateAvailable && (
        <Focusable
          flow-children="row"
          noFocusRing={true}
          className="tl-rise-in"
          style={{
            position: "relative",
            margin: "2px 32px 6px",
            padding: "8px 10px 8px 16px",
            borderRadius: "10px",
            background: "rgba(255, 176, 46, 0.14)",
            border: "1px solid rgba(255, 176, 46, 0.5)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "13px",
          }}
        >
          <FaArrowCircleUp color={COLORS.update} size={16} />
          <span style={{ flex: 1 }}>
            <strong>{t("self.title")}</strong>
            <span style={{ color: COLORS.textDim }}>
              {" "}
              · v{selfUpdate.current} → v{selfUpdate.available}
            </span>
          </span>
          <HeaderButton
            onClick={() => store.handleSelfUpdate()}
            background={COLORS.update}
            color="#1a1200"
            border="1px solid transparent"
          >
            {store.download?.pluginId === "theme-loader"
              ? t("action.downloading", { percent: downloadPercent(store.download) })
              : t("self.update")}
          </HeaderButton>
        </Focusable>
      )}

      {/* Tabs (L1 / R1) */}
      <Focusable
        flow-children="row"
        noFocusRing={true}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 32px 4px",
        }}
      >
        <ButtonGlyph label="L1" />
        {TABS.map((x) => {
          const count = catalog.filter(x.filter).length;
          const active = x.id === tab;
          const isUpdates = x.id === "updates";
          return (
            <Focusable
              key={x.id}
              onActivate={() => setTab(x.id)}
              onClick={() => setTab(x.id)}
              className="tl-tab"
              focusClassName="tl-focused"
              noFocusRing={true}
              style={{
                padding: "6px 14px",
                borderRadius: "999px",
                fontSize: "13px",
                fontWeight: 700,
                backgroundColor: active ? "#ffffff" : "rgba(255,255,255,0.07)",
                color: active ? "#0b0e14" : COLORS.textDim,
                display: "flex",
                alignItems: "center",
                gap: "7px",
              }}
            >
              {t(`tab.${x.id}`)}
              <span
                style={{
                  fontSize: "11px",
                  padding: "0 6px",
                  borderRadius: "999px",
                  backgroundColor:
                    isUpdates && count > 0 ? COLORS.update : active ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.1)",
                  color: isUpdates && count > 0 ? "#1a1200" : "inherit",
                }}
              >
                {count}
              </span>
            </Focusable>
          );
        })}
        <ButtonGlyph label="R1" />
      </Focusable>

      {/* Main: spotlight + cards row */}
      <div
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          padding: "10px 32px 0",
          gap: "14px",
        }}
      >
        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textDim }}>
            <FaSyncAlt className="tl-spin" style={{ marginRight: "10px" }} /> {t("app.loading")}
          </div>
        ) : catalog.length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <FaLayerGroup size={40} style={{ opacity: 0.3 }} />
            <div style={{ fontSize: "18px", fontWeight: 700 }}>{t("app.empty")}</div>
            <div style={{ color: COLORS.textDim, fontSize: "13px" }}>{t("app.empty_hint", { path: USER_ZIPS_DIR })}</div>
          </div>
        ) : (
          <>
            {/* Spotlight of the focused item */}
            {focused && (
              <div
                key={focused.id}
                className="tl-fade-in"
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 1fr)",
                  gap: "26px",
                  alignItems: "stretch",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    minHeight: 0,
                    borderRadius: "16px",
                    overflow: "hidden",
                    backgroundColor: "#000",
                    boxShadow: `0 20px 50px rgba(0,0,0,0.6), 0 0 0 1px ${COLORS.border}`,
                  }}
                >
                  {heroSrc && (
                    <img
                      src={heroSrc}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  )}
                  <div
                    style={{
                      position: "absolute",
                      left: "12px",
                      bottom: "12px",
                      padding: "5px 10px",
                      borderRadius: "8px",
                      backgroundColor: "rgba(0,0,0,0.65)",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <FaImages size={11} color={COLORS.focus} /> {focused.screenshotsCount} {t("info.prints").toLowerCase()}
                  </div>
                </div>

                <div
                  className="tl-scroll"
                  style={{ minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", paddingTop: "4px" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <ConsoleBadge item={focused} large />
                    <StatusPill item={focused} />
                  </div>
                  <div style={{ fontSize: "30px", fontWeight: 800, lineHeight: 1.1, textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
                    {focused.name}
                  </div>
                  <div style={{ fontSize: "13.5px", lineHeight: 1.45, color: "rgba(255,255,255,0.85)" }}>
                    {focused.tagline}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: COLORS.textDim }}>
                    {focused.updateAvailable ? (
                      <>
                        <span>v{focused.installedVersion}</span>
                        <span style={{ color: COLORS.update }}>→</span>
                        <span style={{ color: COLORS.update, fontWeight: 700 }}>v{focused.version}</span>
                      </>
                    ) : (
                      <span>
                        {t("info.version")} {focused.installed && focused.installedVersion ? focused.installedVersion : focused.version}
                      </span>
                    )}
                    <span>· {focused.console}</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "2px" }}>
                    {focused.features.slice(0, 3).map((feat, i) => (
                      <div key={i} style={{ display: "flex", gap: "8px", fontSize: "12.5px", lineHeight: 1.4, color: "rgba(255,255,255,0.82)" }}>
                        <FaCheck size={11} color={focused.accent} style={{ marginTop: "3px", flexShrink: 0 }} />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Cards row */}
            {visible.length === 0 ? (
              <div style={{ height: "196px", display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textFaint }}>
                {t("tab.empty")}
              </div>
            ) : (
              <Focusable
                flow-children="row"
                noFocusRing={true}
                className="tl-scroll"
                style={{
                  display: "flex",
                  gap: "18px",
                  overflowX: "auto",
                  overflowY: "visible",
                  padding: "14px 6px 18px",
                  margin: "0 -6px",
                  flexShrink: 0,
                }}
              >
                {visible.map((item, idx) => (
                  <Focusable
                    key={item.id}
                    ref={(el: HTMLDivElement | null) => {
                      cardRefs.current[item.id] = el;
                    }}
                    preferredFocus={idx === 0}
                    className="tl-card"
                    focusClassName="tl-focused"
                    noFocusRing={true}
                    onActivate={() => openPlugin(item)}
                    onClick={() => openPlugin(item)}
                    onGamepadFocus={() => setFocusedId(item.id)}
                    onFocus={(e: FocusEvent<HTMLDivElement>) => {
                      setFocusedId(item.id);
                      revealInParent(e.currentTarget);
                    }}
                    onMouseEnter={() => setFocusedId(item.id)}
                    style={
                      {
                        "--tl-accent": item.color,
                        flexShrink: 0,
                        width: "220px",
                        borderRadius: "14px",
                        overflow: "hidden",
                        position: "relative",
                        backgroundColor: "#151a23",
                        border: `1px solid ${item.id === focused?.id ? "rgba(255,255,255,0.35)" : COLORS.border}`,
                        boxShadow: "0 8px 20px rgba(0,0,0,0.45)",
                      } as CSSProperties
                    }
                  >
                    <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 10", backgroundColor: "#000" }}>
                      {item.cover ? (
                        <img src={item.cover} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      ) : (
                        <div style={{ position: "absolute", inset: 0, background: item.gradient }} />
                      )}
                      <div style={{ position: "absolute", top: "8px", left: "8px" }}>
                        <ConsoleBadge item={item} />
                      </div>
                      {item.updateAvailable && (
                        <div style={{ position: "absolute", top: "8px", right: "8px" }}>
                          <span
                            className="tl-pulse"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              backgroundColor: COLORS.update,
                              color: "#1a1200",
                              fontSize: "10px",
                              fontWeight: 800,
                              padding: "3px 7px",
                              borderRadius: "999px",
                            }}
                          >
                            <FaArrowCircleUp size={10} /> v{item.version}
                          </span>
                        </div>
                      )}
                      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "4px", backgroundColor: item.color }} />
                    </div>
                    <div style={{ padding: "9px 11px 11px", display: "flex", flexDirection: "column", gap: "5px" }}>
                      <div style={{ fontSize: "14.5px", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.name}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                        <StatusPill item={item} compact />
                        {!item.updateAvailable && (
                          <span style={{ fontSize: "10.5px", color: COLORS.textFaint, whiteSpace: "nowrap" }}>
                            v{item.installed && item.installedVersion ? item.installedVersion : item.version}
                          </span>
                        )}
                      </div>
                    </div>
                  </Focusable>
                ))}
              </Focusable>
            )}
          </>
        )}
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
          justifyContent: "space-between",
          fontSize: "12px",
          color: COLORS.textDim,
        }}
      >
        <div style={{ display: "flex", gap: "20px" }}>
          <LegendItem glyph="A">{t("legend.select")}</LegendItem>
          <LegendItem glyph="B">{t("legend.back")}</LegendItem>
          <LegendItem glyph="Y">{t("legend.random")}</LegendItem>
          <LegendItem glyph="L1/R1">{t("legend.tabs")}</LegendItem>
        </div>
        <div style={{ color: COLORS.textFaint }}>{USER_ZIPS_DIR}</div>
      </div>

      {/* Roulette overlay */}
      {rolling && (
        <div
          className="tl-fade-in"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 50,
            backgroundColor: "rgba(5, 7, 12, 0.82)",
            backdropFilter: "blur(6px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "18px",
          }}
        >
          <FaDice size={56} className="tl-spin" color="#7b2ff7" />
          <div style={{ fontSize: "30px", fontWeight: 800, minHeight: "40px" }}>{rollName}</div>
          <div style={{ fontSize: "13px", color: COLORS.textDim }}>{t("action.rolling")}</div>
        </div>
      )}
    </Focusable>
  );
};
