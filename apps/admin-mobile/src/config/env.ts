const PROD_API_BASE_URL = "https://drogueria-renacer.onrender.com";
const DEV_API_BASE_URL = PROD_API_BASE_URL;
const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_AUTO_SYNC_INTERVAL_MS = 60 * 1000;

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, "");

const readTimeout = () => {
  const raw = process.env.EXPO_PUBLIC_API_TIMEOUT_MS;
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed >= 1000 && parsed <= 60000) {
    return parsed;
  }
  return DEFAULT_TIMEOUT_MS;
};

const readApiBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl && envUrl.trim()) {
    return normalizeBaseUrl(envUrl);
  }
  return normalizeBaseUrl(__DEV__ ? DEV_API_BASE_URL : PROD_API_BASE_URL);
};

const readIdleTimeout = () => {
  const raw = process.env.EXPO_PUBLIC_SESSION_IDLE_TIMEOUT_MS;
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed >= 60_000 && parsed <= 24 * 60 * 60 * 1000) {
    return parsed;
  }
  return DEFAULT_IDLE_TIMEOUT_MS;
};

const readAutoSyncInterval = () => {
  const raw = process.env.EXPO_PUBLIC_AUTO_SYNC_INTERVAL_MS;
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed >= 30_000 && parsed <= 10 * 60 * 1000) {
    return parsed;
  }
  return DEFAULT_AUTO_SYNC_INTERVAL_MS;
};

const readPushProjectId = () => {
  const raw = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim();
  }
  return null;
};

export const ENV = {
  appName: "Drogueria Renacer Admin",
  apiBaseUrl: readApiBaseUrl(),
  apiTimeoutMs: readTimeout(),
  sessionIdleTimeoutMs: readIdleTimeout(),
  autoSyncIntervalMs: readAutoSyncInterval(),
  pushProjectId: readPushProjectId(),
} as const;
