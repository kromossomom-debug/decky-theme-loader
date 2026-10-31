import { definePlugin, routerHook } from "@decky/api";
import {
  ButtonItem,
  Navigation,
  PanelSection,
  PanelSectionRow,
  ProgressBar,
  ProgressBarWithInfo,
  staticClasses,
} from "@decky/ui";
import { FC } from "react";
import { FaArrowCircleUp, FaDice, FaLayerGroup, FaStore, FaSyncAlt } from "react-icons/fa";
import { StorePage } from "./StorePage";
import { PluginDetailPage } from "./PluginDetailPage";
import { useThemeLoaderStore, downloadPercent } from "./store";
import { t, tn } from "./i18n";
import { PluginItem } from "./types";
import {
  COLORS,
  DETAIL_ROUTE,
  STORE_ROUTE,
  CoffeeLabel,
  ConsoleIcon,
  StatusPill,
  confirmRandom,
  openSupportPage,
} from "./shared";

const openRoute = (route: string) => {
  Navigation.Navigate(route);
  Navigation.CloseSideMenus();
};

const PluginRow: FC<{ item: PluginItem; onOpen: () => void }> = ({ item, onOpen }) => (
  <ButtonItem layout="below" onClick={onOpen}>
    <div style={{ display: "flex", alignItems: "center", gap: "10px", textAlign: "left" }}>
      <div
        style={{
          position: "relative",
          width: "64px",
          height: "40px",
          flexShrink: 0,
          borderRadius: "6px",
          overflow: "hidden",
          background: item.gradient,
          boxShadow: `inset 0 -3px 0 ${item.color}`,
        }}
      >
        {item.cover && (
          <img src={item.cover} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        )}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "13px",
            fontWeight: 700,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          <ConsoleIcon id={item.id} size={11} /> {item.name}
        </div>
        <div style={{ marginTop: "3px" }}>
          <StatusPill item={item} compact />
        </div>
        <div
          style={{
            fontSize: "10px",
            opacity: 0.6,
            marginTop: "3px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.updateAvailable
            ? `v${item.installedVersion} → v${item.version}`
            : `v${item.installed && item.installedVersion ? item.installedVersion : item.version}`}
        </div>
      </div>
    </div>
  </ButtonItem>
);

// Quick Access Menu (QAM sidebar)
const Content: FC = () => {
  const store = useThemeLoaderStore();
  const { catalog, loading, isBusy, updatesCount, installedCount, selfUpdate } = store;

  const openPlugin = (item: PluginItem) => {
    store.setSelectedPluginId(item.id);
    openRoute(DETAIL_ROUTE);
  };

  return (
    <div>
      <PanelSection>
        <PanelSectionRow>
          <div
            style={{
              borderRadius: "12px",
              padding: "14px",
              background: "linear-gradient(135deg, #1a9fff 0%, #7b2ff7 100%)",
              boxShadow: "0 6px 18px rgba(26, 159, 255, 0.35)",
              color: "#fff",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "15px", fontWeight: 800 }}>
              <FaLayerGroup /> {t("app.title")}
            </div>
            <div style={{ fontSize: "11.5px", opacity: 0.9, marginTop: "4px", lineHeight: 1.35 }}>
              {t("qam.store_desc")}
            </div>
            <div style={{ display: "flex", gap: "6px", marginTop: "10px", flexWrap: "wrap", fontSize: "10.5px", fontWeight: 700 }}>
              <span style={{ padding: "2px 8px", borderRadius: "999px", backgroundColor: "rgba(0,0,0,0.25)" }}>
                {tn("stats.plugins", catalog.length)}
              </span>
              <span style={{ padding: "2px 8px", borderRadius: "999px", backgroundColor: "rgba(0,0,0,0.25)" }}>
                {tn("stats.installed", installedCount)}
              </span>
              {updatesCount > 0 && (
                <span style={{ padding: "2px 8px", borderRadius: "999px", backgroundColor: COLORS.update, color: "#1a1200" }}>
                  {tn("stats.updates", updatesCount)}
                </span>
              )}
            </div>
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={() => openRoute(STORE_ROUTE)}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontWeight: 700 }}>
              <FaStore /> {t("qam.open_store")}
            </span>
          </ButtonItem>
        </PanelSectionRow>
        {selfUpdate?.updateAvailable && (
          <PanelSectionRow>
            <ButtonItem layout="below" disabled={isBusy} onClick={store.handleSelfUpdate} description={`v${selfUpdate.current} → v${selfUpdate.available}`}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: COLORS.update, fontWeight: 700 }}>
                <FaArrowCircleUp /> {t("self.update")}
              </span>
            </ButtonItem>
          </PanelSectionRow>
        )}
        {updatesCount > 0 && (
          <PanelSectionRow>
            <ButtonItem layout="below" disabled={isBusy} onClick={store.handleUpdateAll}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: COLORS.update, fontWeight: 700 }}>
                <FaArrowCircleUp /> {t("action.update_all", { count: updatesCount })}
              </span>
            </ButtonItem>
          </PanelSectionRow>
        )}
        <PanelSectionRow>
          <ButtonItem layout="below" disabled={isBusy} onClick={() => confirmRandom(store.handleRollRandom)}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <FaDice /> {t("action.random")}
            </span>
          </ButtonItem>
        </PanelSectionRow>
        {isBusy && (
          <PanelSectionRow>
            {store.download?.total ? (
              <ProgressBarWithInfo
                nProgress={(store.download.done / store.download.total) * 100}
                sOperationText={t("action.downloading", { percent: downloadPercent(store.download) })}
              />
            ) : (
              <ProgressBar indeterminate={true} />
            )}
          </PanelSectionRow>
        )}
      </PanelSection>

      <PanelSection title={t("qam.themes")}>
        {loading ? (
          <PanelSectionRow>
            <div style={{ textAlign: "center", padding: "12px 0", opacity: 0.5 }}>{t("app.loading")}</div>
          </PanelSectionRow>
        ) : (
          // Updates first, then installed, then the rest
          [...catalog]
            .sort((a, b) => Number(b.updateAvailable) - Number(a.updateAvailable) || Number(b.installed) - Number(a.installed))
            .map((item) => (
              <PanelSectionRow key={item.id}>
                <PluginRow item={item} onOpen={() => openPlugin(item)} />
              </PanelSectionRow>
            ))
        )}
        <PanelSectionRow>
          <ButtonItem layout="below" disabled={store.refreshing} onClick={() => store.refreshCatalog(true)}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
              <FaSyncAlt /> {t("app.refresh")}
            </span>
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title={t("app.support")}>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={openSupportPage} description={t("app.support_desc")}>
            <span style={{ color: COLORS.coffee, fontWeight: 700 }}>
              <CoffeeLabel text="Buy Me a Coffee" />
            </span>
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
    </div>
  );
};

export default definePlugin(() => {
  // Full-screen store routes in Game Mode
  routerHook.addRoute(STORE_ROUTE, StorePage, { exact: true });
  routerHook.addRoute(DETAIL_ROUTE, PluginDetailPage, { exact: true });

  return {
    name: "Theme Loader",
    titleView: <div className={staticClasses.Title}>Theme Loader</div>,
    content: <Content />,
    icon: <FaLayerGroup />,
    onDismount() {
      routerHook.removeRoute(STORE_ROUTE);
      routerHook.removeRoute(DETAIL_ROUTE);
    },
  };
});
