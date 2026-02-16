import { create } from "zustand";

export type InAppAlertType = "orders" | "stock" | "system";

export interface InAppAlert {
  id: string;
  type: InAppAlertType;
  title: string;
  message: string;
  createdAt: string;
}

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
      const duplicate = state.inAppAlerts.find(
        (item) =>
          item.type === alert.type &&
          item.title === alert.title &&
          item.message === alert.message
      );
      if (duplicate) {
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
