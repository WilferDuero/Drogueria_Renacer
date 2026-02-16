import { create } from "zustand";
import { fetchAuthMe, loginAdmin } from "../api/modules/auth";
import { unregisterPushDevice } from "../api/modules/notifications";
import { AuthUser } from "../types/domain";
import { getActivePushToken, setActivePushToken } from "../lib/push-session";
import { tokenStorage } from "../lib/token-storage";
import { setAuthTokenResolver, setUnauthorizedHandler } from "../api/client";

type AuthStatus = "checking" | "authenticated" | "unauthenticated";

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  token: string | null;
  isBootstrapping: boolean;
  isLoginPending: boolean;
  bootstrap: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "checking",
  user: null,
  token: null,
  isBootstrapping: false,
  isLoginPending: false,

  bootstrap: async () => {
    if (get().isBootstrapping) {
      return;
    }
    set({ isBootstrapping: true, status: "checking" });

    try {
      const token = await tokenStorage.get();
      if (!token) {
        setActivePushToken(null);
        set({ status: "unauthenticated", user: null, token: null });
        return;
      }

      set({ token });
      const user = await fetchAuthMe();
      set({ status: "authenticated", user, token });
    } catch {
      setActivePushToken(null);
      await tokenStorage.clear();
      set({ status: "unauthenticated", user: null, token: null });
    } finally {
      set({ isBootstrapping: false });
    }
  },

  login: async (username: string, password: string) => {
    set({ isLoginPending: true });
    try {
      const result = await loginAdmin(username, password);
      await tokenStorage.set(result.token);
      set({
        status: "authenticated",
        token: result.token,
        user: result.user,
      });
    } finally {
      set({ isLoginPending: false });
    }
  },

  logout: async () => {
    const activePushToken = getActivePushToken();
    if (activePushToken) {
      try {
        await unregisterPushDevice(activePushToken);
      } catch {
      } finally {
        setActivePushToken(null);
      }
    }
    await tokenStorage.clear();
    set({
      status: "unauthenticated",
      token: null,
      user: null,
      isLoginPending: false,
    });
  },
}));

setAuthTokenResolver(() => useAuthStore.getState().token);
setUnauthorizedHandler(() => {
  const state = useAuthStore.getState();
  if (state.status === "authenticated") {
    void state.logout();
  }
});

