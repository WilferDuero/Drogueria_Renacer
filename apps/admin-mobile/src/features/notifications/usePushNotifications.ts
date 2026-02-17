import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { registerPushDevice } from "../../api/modules/notifications";
import { ENV } from "../../config/env";
import { setActivePushToken } from "../../lib/push-session";
import { useAuthStore } from "../../store/auth-store";
import { useSyncStore } from "../../store/sync-store";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const resolveExpoProjectId = () => {
  if (ENV.pushProjectId) {
    return ENV.pushProjectId;
  }
  const extraProjectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof extraProjectId === "string" && extraProjectId.trim()) {
    return extraProjectId.trim();
  }
  const easConfigProjectId = (Constants as { easConfig?: { projectId?: string } }).easConfig
    ?.projectId;
  if (typeof easConfigProjectId === "string" && easConfigProjectId.trim()) {
    return easConfigProjectId.trim();
  }
  return null;
};

const resolveAlertType = (rawType: unknown) => {
  const normalized = String(rawType || "").toLowerCase();
  if (normalized === "new_order") return "orders" as const;
  if (normalized === "stock_low") return "stock" as const;
  return "system" as const;
};

const registerDevicePushToken = async () => {
  if (!Device.isDevice) {
    console.warn("push register skipped: non-physical device");
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#21808d",
    });
  }

  const permissions = await Notifications.getPermissionsAsync();
  let finalStatus = permissions.status;
  if (finalStatus !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }
  if (finalStatus !== "granted") {
    console.warn("push permission not granted; trying token registration anyway");
  }

  const projectId = resolveExpoProjectId();
  try {
    const tokenResponse = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    return String(tokenResponse.data || "").trim() || null;
  } catch (error) {
    if (!projectId) {
      console.warn("push token error", error);
      return null;
    }
    try {
      const fallbackToken = await Notifications.getExpoPushTokenAsync();
      return String(fallbackToken.data || "").trim() || null;
    } catch (fallbackError) {
      console.warn("push token fallback error", fallbackError);
      return null;
    }
  }
};

const PUSH_REGISTER_RETRY_MS = 15_000;

const pushAlertFromNotification = (
  pushInAppAlert: ReturnType<typeof useSyncStore.getState>["pushInAppAlert"],
  notification:
    | Notifications.Notification
    | Notifications.NotificationResponse["notification"]
) => {
  const content = notification.request.content;
  const title = String(content.title || "").trim();
  const message = String(content.body || "").trim();
  if (!title && !message) {
    return;
  }
  const type = resolveAlertType(content.data?.type);
  pushInAppAlert({
    type,
    title: title || "Notificacion",
    message: message || "Tienes una actualizacion.",
  });
};

export const usePushNotifications = () => {
  const authStatus = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const pushInAppAlert = useSyncStore((state) => state.pushInAppAlert);

  useEffect(() => {
    if (authStatus !== "authenticated" || !userId) {
      setActivePushToken(null);
      return;
    }

    let canceled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    const clearRetry = () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
      }
    };
    const scheduleRetry = () => {
      clearRetry();
      retryTimeout = setTimeout(() => {
        void register();
      }, PUSH_REGISTER_RETRY_MS);
    };

    const register = async () => {
      try {
        const token = await registerDevicePushToken();
        if (!token || canceled) {
          if (!canceled) {
            scheduleRetry();
          }
          return;
        }
        await registerPushDevice({
          token,
          platform: Platform.OS,
        });
        if (!canceled) {
          setActivePushToken(token);
          clearRetry();
        }
      } catch (error) {
        console.warn("push register error", error);
        if (!canceled) {
          scheduleRetry();
        }
      }
    };
    void register();

    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void register();
      }
    });

    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      pushAlertFromNotification(pushInAppAlert, notification);
    });
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        pushAlertFromNotification(pushInAppAlert, response.notification);
      }
    );

    return () => {
      canceled = true;
      clearRetry();
      appStateSubscription.remove();
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [authStatus, userId, pushInAppAlert]);
};
