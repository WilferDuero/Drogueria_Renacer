import { create } from "zustand";

export type InAppAlertType = "orders" | "stock" | "system";

export interface InAppAlert {
  id: string;
  type: InAppAlertType;
  title: string;
  message: string;
  dedupeKey?: string;
  createdAt: string;
}

const ALERT_DEDUPE_WINDOW_MS = 12_000;

const toTimestamp = (isoDate: string) => {
  const parsed = Date.parse(isoDate);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildAlertKey = (alert: Pick<InAppAlert, "type" | "title" | "message" | "dedupeKey">) => {
  const explicitKey = String(alert.dedupeKey || "").trim();
  if (explicitKey) {
    return explicitKey;
  }
  return `${alert.type}|${String(alert.title || "").trim()}|${String(alert.message || "").trim()}`;
};

interface SyncState {
  syncTick: number;
  lastManualSyncAt: string | null;
  lastAutoSyncAt: string | null;
  autoSyncEnabled: boolean;
  inAppAlerts: InAppAlert[];
  triggerSync: () => void;
  triggerAutoSync: () => void;
  setAutoSyncEnabled: (enabled: boolean) => void;
  pushInAppAlert: (alert: Omit<InAppAlert, "id" | "createdAt">) => void;
  dismissInAppAlert: (id: string) => void;
  clearInAppAlerts: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  syncTick: 0,
  lastManualSyncAt: null,
  lastAutoSyncAt: null,
  autoSyncEnabled: true,
  inAppAlerts: [],
  triggerSync: () =>
    set((state) => ({
      syncTick: state.syncTick + 1,
      lastManualSyncAt: new Date().toISOString(),
    })),
  triggerAutoSync: () =>
    set((state) => ({
      syncTick: state.syncTick + 1,
      lastAutoSyncAt: new Date().toISOString(),
    })),
  setAutoSyncEnabled: (enabled) => set({ autoSyncEnabled: enabled }),
  pushInAppAlert: (alert) =>
    set((state) => {
      const createdAt = new Date().toISOString();
      const createdAtTs = toTimestamp(createdAt);
      const incomingKey = buildAlertKey(alert);
      const duplicateRecent = state.inAppAlerts.some((item) => {
        if (buildAlertKey(item) !== incomingKey) {
          return false;
        }
        const ageMs = createdAtTs - toTimestamp(item.createdAt);
        return ageMs >= 0 && ageMs <= ALERT_DEDUPE_WINDOW_MS;
      });
      if (duplicateRecent) {
        return state;
      }
      const next = [
        {
          id: `${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt,
          ...alert,
        },
        ...state.inAppAlerts,
      ].slice(0, 20);
      return { inAppAlerts: next };
    }),
  dismissInAppAlert: (id) =>
    set((state) => ({
      inAppAlerts: state.inAppAlerts.filter((item) => item.id !== id),
    })),
  clearInAppAlerts: () => set({ inAppAlerts: [] }),
}));
