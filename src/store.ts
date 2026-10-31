import { callable, toaster } from "@decky/api";
import { useState, useEffect } from "react";
import {
  PluginItem,
  ScreenshotItem,
  RandomResult,
  OpResult,
  SelfUpdateInfo,
  UpdateAllResult,
  DownloadProgress,
} from "./types";
import { t, getCurrentLanguage } from "./i18n";

const getCatalog = callable<[string, boolean], PluginItem[]>("get_catalog");
const installPlugin = callable<[string], OpResult>("install_plugin");
const uninstallPlugin = callable<[string], OpResult>("uninstall_plugin");
const installRandom = callable<[], RandomResult>("install_random");
const updateAll = callable<[], UpdateAllResult>("update_all");
const getPluginScreenshots = callable<[string, string], ScreenshotItem[]>("get_plugin_screenshots");
const getScreenshotFull = callable<[string, string], { success: boolean; data?: string }>(
  "get_screenshot_full"
);
const getSelfUpdate = callable<[], SelfUpdateInfo>("get_self_update");
const updateSelf = callable<[], OpResult>("update_self");
const getDownloadProgress = callable<[string], DownloadProgress>("get_download_progress");

// Module-level caches so screenshots are fetched once per session
const screenshotCache: Record<string, ScreenshotItem[]> = {};
const fullImageCache: Record<string, string> = {};

// Global state listeners for reactivity across routes
type Listener = () => void;
const listeners = new Set<Listener>();

interface State {
  catalog: PluginItem[];
  loading: boolean;
  loaded: boolean;
  isBusy: boolean;
  busyPluginId: string | null;
  selectedPluginId: string | null;
  selfUpdate: SelfUpdateInfo | null;
  /** Release being downloaded from the remote catalog, while an install runs */
  download: DownloadProgress | null;
}

const state: State = {
  catalog: [],
  loading: false,
  loaded: false,
  isBusy: false,
  busyPluginId: null,
  selectedPluginId: null,
  selfUpdate: null,
  download: null,
};

function notify() {
  listeners.forEach((l) => l());
}

function errorToast(title: string, error?: string) {
  toaster.toast({ title, body: error || t("toast.unknown_error") });
}

/** Polls the backend download progress until stop() is called. */
function watchDownloads(): () => void {
  let stopped = false;
  const poll = async () => {
    while (!stopped) {
      try {
        const p = await getDownloadProgress("");
        if (stopped) break;
        state.download = p?.active ? p : null;
        notify();
      } catch {
        // Older backend without get_download_progress: just keep the spinner
      }
      await new Promise((r) => setTimeout(r, 350));
    }
  };
  poll();
  return () => {
    stopped = true;
    state.download = null;
  };
}

/** Runs an operation with the busy flag set, so only one install runs at a time. */
async function runBusy<T>(
  pluginId: string | null,
  op: () => Promise<T>,
  mayDownload = false
): Promise<T | null> {
  if (state.isBusy) return null;
  state.isBusy = true;
  state.busyPluginId = pluginId;
  notify();
  const stopWatching = mayDownload ? watchDownloads() : null;
  try {
    return await op();
  } finally {
    stopWatching?.();
    state.isBusy = false;
    state.busyPluginId = null;
    notify();
  }
}

/** Download percentage ("45%") of the release being fetched, or "" when unknown. */
export function downloadPercent(p: DownloadProgress | null): string {
  if (!p || !p.total) return "";
  return `${Math.min(100, Math.round((p.done / p.total) * 100))}%`;
}

/** Reloads the catalog; refreshRemote skips the 15 min cache of the remote catalog. */
export async function refreshCatalog(refreshRemote = false): Promise<void> {
  try {
    state.loading = true;
    notify();
    const [data, self] = await Promise.all([
      getCatalog(getCurrentLanguage(), refreshRemote),
      getSelfUpdate().catch(() => null),
    ]);
    state.catalog = data || [];
    state.selfUpdate = self;
  } catch (e) {
    console.error("[ThemeLoader] Error fetching catalog:", e);
  } finally {
    state.loading = false;
    state.loaded = true;
    notify();
  }
}

export async function handleInstall(pluginId: string): Promise<boolean> {
  const item = state.catalog.find((p) => p.id === pluginId);
  const name = item?.name || pluginId;
  const res = await runBusy(pluginId, async () => {
    try {
      const r = await installPlugin(pluginId);
      if (r?.success) {
        toaster.toast({
          title: t("app.title"),
          body: t("toast.installed", { name, version: r.version || item?.version || "" }),
        });
        await refreshCatalog();
        return true;
      }
      errorToast(t("toast.install_error"), r?.error);
    } catch (e: any) {
      console.error("[ThemeLoader] Install failed:", e);
      errorToast(t("toast.install_error"), e?.message);
    }
    return false;
  }, !!item?.needsDownload);
  return !!res;
}

export async function handleUninstall(pluginId: string): Promise<boolean> {
  const name = state.catalog.find((p) => p.id === pluginId)?.name || pluginId;
  const res = await runBusy(pluginId, async () => {
    try {
      const r = await uninstallPlugin(pluginId);
      if (r?.success) {
        toaster.toast({ title: t("app.title"), body: t("toast.uninstalled", { name }) });
        await refreshCatalog();
        return true;
      }
      errorToast(t("toast.uninstall_error"), r?.error);
    } catch (e: any) {
      console.error("[ThemeLoader] Uninstall failed:", e);
      errorToast(t("toast.uninstall_error"), e?.message);
    }
    return false;
  });
  return !!res;
}

export async function handleUpdateAll(): Promise<void> {
  await runBusy(null, async () => {
    try {
      const r = await updateAll();
      if (r.updated.length > 0) {
        toaster.toast({ title: t("app.title"), body: t("toast.update_all", { count: r.updated.length }) });
      }
      if (r.failed.length > 0) {
        errorToast(t("toast.install_error"), r.failed.join(", "));
      }
      await refreshCatalog();
    } catch (e: any) {
      errorToast(t("toast.install_error"), e?.message);
    }
  }, state.catalog.some((p) => p.updateAvailable && p.needsDownload));
}

export async function handleRollRandom(): Promise<RandomResult | null> {
  return runBusy(null, async () => {
    try {
      // Short pause so the roulette animation can play
      await new Promise((r) => setTimeout(r, 900));
      const res = await installRandom();
      if (res?.success) {
        toaster.toast({ title: t("toast.random_title"), body: t("toast.random_body", { name: res.name || "" }) });
        if (res.plugin_id) state.selectedPluginId = res.plugin_id;
      } else {
        errorToast(t("toast.install_error"), res?.error);
      }
      await refreshCatalog();
      return res;
    } catch (e: any) {
      console.error("[ThemeLoader] Random roll failed:", e);
      errorToast(t("toast.install_error"), e?.message);
      return { success: false, error: e?.message };
    }
  }, state.catalog.some((p) => p.needsDownload));
}

export async function handleSelfUpdate(): Promise<void> {
  await runBusy(null, async () => {
    try {
      const r = await updateSelf();
      if (r?.success) {
        toaster.toast({ title: t("app.title"), body: t("toast.self_updated", { version: r.version || "" }) });
        state.selfUpdate = null;
      } else {
        errorToast(t("toast.install_error"), r?.error);
      }
    } catch (e: any) {
      errorToast(t("toast.install_error"), e?.message);
    }
  }, !!state.selfUpdate?.needsDownload);
}

export async function fetchPluginScreenshots(pluginId: string): Promise<ScreenshotItem[]> {
  const cacheKey = `${pluginId}_${getCurrentLanguage()}`;
  if (screenshotCache[cacheKey]?.length) return screenshotCache[cacheKey];
  try {
    const shots = await getPluginScreenshots(pluginId, getCurrentLanguage());
    if (shots?.length) {
      screenshotCache[cacheKey] = shots;
      return shots;
    }
  } catch (e) {
    console.error("[ThemeLoader] Error fetching screenshots:", e);
  }
  return [];
}

/** Full resolution screenshot (loaded on demand, cached). */
export async function fetchFullScreenshot(pluginId: string, filename: string): Promise<string | null> {
  const key = `${pluginId}/${filename}`;
  if (fullImageCache[key]) return fullImageCache[key];
  try {
    const res = await getScreenshotFull(pluginId, filename);
    if (res?.success && res.data) {
      fullImageCache[key] = res.data;
      return res.data;
    }
  } catch (e) {
    console.error("[ThemeLoader] Error fetching full screenshot:", e);
  }
  return null;
}

export function getCachedFullScreenshot(pluginId: string, filename: string): string | null {
  return fullImageCache[`${pluginId}/${filename}`] || null;
}

export function setSelectedPluginId(id: string | null) {
  state.selectedPluginId = id;
  notify();
}

export function useThemeLoaderStore() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((n) => n + 1);
    listeners.add(listener);
    if (!state.loaded && !state.loading) {
      refreshCatalog();
    }
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const selectedPlugin = state.catalog.find((p) => p.id === state.selectedPluginId) || null;

  return {
    catalog: state.catalog,
    loading: state.loading && !state.loaded,
    refreshing: state.loading,
    isBusy: state.isBusy,
    busyPluginId: state.busyPluginId,
    selectedPluginId: state.selectedPluginId,
    selectedPlugin,
    selfUpdate: state.selfUpdate,
    download: state.download,
    updatesCount: state.catalog.filter((p) => p.updateAvailable).length,
    installedCount: state.catalog.filter((p) => p.installed).length,
    refreshCatalog,
    handleInstall,
    handleUninstall,
    handleUpdateAll,
    handleRollRandom,
    handleSelfUpdate,
    fetchScreenshots: fetchPluginScreenshots,
    setSelectedPluginId,
  };
}
