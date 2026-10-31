export type VersionState =
  | "not_installed"
  | "installed"
  | "up_to_date"
  | "update_available"
  | "newer_installed";

export interface PluginItem {
  id: string;
  name: string;
  console: string;
  badge: string;
  color: string;
  gradient: string;
  accent: string;
  isDashboard: boolean;
  tagline: string;
  description: string;
  features: string[];
  /** Version available in the store (zip) */
  version: string;
  author: string;
  tags: string[];
  installed: boolean;
  /** Version currently installed on the Deck ("" when not installed) */
  installedVersion: string;
  versionState: VersionState;
  updateAvailable: boolean;
  /** The newest release comes from the remote catalog and is downloaded on install */
  needsDownload: boolean;
  zipSize: number;
  screenshotsCount: number;
  /** Thumbnail data URL of the first screenshot */
  cover: string;
}

export interface ScreenshotItem {
  filename: string;
  title: string;
  thumbUrl: string;
}

export interface SelfUpdateInfo {
  current: string;
  available: string;
  updateAvailable: boolean;
  needsDownload?: boolean;
}

export interface DownloadProgress {
  active: boolean;
  pluginId: string;
  done: number;
  total: number;
}

export interface RandomResult {
  success: boolean;
  plugin_id?: string;
  name?: string;
  console?: string;
  badge?: string;
  color?: string;
  error?: string;
}

export interface OpResult {
  success: boolean;
  plugin_id?: string;
  version?: string;
  message?: string;
  error?: string;
}

export interface UpdateAllResult {
  success: boolean;
  updated: string[];
  failed: string[];
}
