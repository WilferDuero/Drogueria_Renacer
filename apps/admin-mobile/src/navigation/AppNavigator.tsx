import Ionicons from "@expo/vector-icons/Ionicons";
import {
  BottomTabNavigationProp,
  createBottomTabNavigator,
} from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { listOrders } from "../api/modules/orders";
import { ENV } from "../config/env";
import { theme } from "../constants/theme";
import { LoginScreen } from "../features/auth/LoginScreen";
import { DashboardScreen } from "../features/dashboard/DashboardScreen";
import { OrdersScreen } from "../features/orders/OrdersScreen";
import { ProductsScreen } from "../features/products/ProductsScreen";
import { ReviewsScreen } from "../features/reviews/ReviewsScreen";
import { SalesScreen } from "../features/sales/SalesScreen";
import { UsersScreen } from "../features/users/UsersScreen";
import { formatDateTime } from "../lib/format";
import { useAuthStore } from "../store/auth-store";
import { InAppAlert, useSyncStore } from "../store/sync-store";
import { AdminTabParamList, RootStackParamList } from "./types";

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator<AdminTabParamList>();

const tabIconByRoute: Record<keyof AdminTabParamList, keyof typeof Ionicons.glyphMap> = {
  Dashboard: "speedometer-outline",
  Productos: "cube-outline",
  Pedidos: "receipt-outline",
  Ventas: "cash-outline",
  Resenas: "star-outline",
  Usuarios: "people-outline",
};

const getAlertDestinationTab = (alert: InAppAlert): keyof AdminTabParamList | null => {
  if (alert.type === "orders") {
    return "Pedidos";
  }
  if (alert.type === "stock") {
    return "Productos";
  }
  return null;
};

const HeaderActions = () => {
  const navigation = useNavigation<BottomTabNavigationProp<AdminTabParamList>>();
  const logout = useAuthStore((state) => state.logout);
  const triggerSync = useSyncStore((state) => state.triggerSync);
  const inAppAlerts = useSyncStore((state) => state.inAppAlerts);
  const dismissInAppAlert = useSyncStore((state) => state.dismissInAppAlert);
  const clearInAppAlerts = useSyncStore((state) => state.clearInAppAlerts);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const alertsCount = inAppAlerts.length;
  const alertsLabel = useMemo(
    () => (alertsCount === 1 ? "1 alerta nueva" : `${alertsCount} alertas nuevas`),
    [alertsCount]
  );
  const onOpenAlert = (alert: InAppAlert) => {
    const destinationTab = getAlertDestinationTab(alert);
    if (!destinationTab) {
      return;
    }
    setAlertsOpen(false);
    navigation.navigate(destinationTab);
    dismissInAppAlert(alert.id);
  };

  return (
    <>
      <View style={styles.headerActions}>
        <Pressable style={styles.alertsButton} onPress={() => setAlertsOpen(true)}>
          <Ionicons
            name={alertsCount ? "notifications" : "notifications-outline"}
            size={15}
            color={theme.colors.white}
          />
          {alertsCount ? (
            <View style={styles.alertsBadge}>
              <Text style={styles.alertsBadgeText}>{alertsCount > 99 ? "99+" : alertsCount}</Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable style={styles.syncButton} onPress={triggerSync}>
          <Text style={styles.syncButtonLabel}>Sincronizar</Text>
        </Pressable>
        <Pressable style={styles.logoutButton} onPress={() => void logout()}>
          <Text style={styles.logoutButtonLabel}>Salir</Text>
        </Pressable>
      </View>

      <Modal
        visible={alertsOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setAlertsOpen(false)}
      >
        <View style={styles.alertModalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setAlertsOpen(false)} />
          <View style={styles.alertModalCard}>
            <View style={styles.alertModalHeader}>
              <View>
                <Text style={styles.alertModalTitle}>Alertas operativas</Text>
                <Text style={styles.alertModalSubtitle}>
                  {alertsCount ? alertsLabel : "Sin alertas nuevas"}
                </Text>
              </View>
              <Pressable style={styles.alertModalCloseButton} onPress={() => setAlertsOpen(false)}>
                <Ionicons name="close-outline" size={18} color={theme.colors.textMuted} />
              </Pressable>
            </View>

            {alertsCount ? (
              <View style={styles.alertModalActions}>
                <Pressable style={styles.alertModalClearButton} onPress={clearInAppAlerts}>
                  <Text style={styles.alertModalClearButtonText}>Limpiar todo</Text>
                </Pressable>
              </View>
            ) : null}

            {alertsCount ? (
              <ScrollView contentContainerStyle={styles.alertList}>
                {inAppAlerts.map((alert) => {
                  const destinationTab = getAlertDestinationTab(alert);
                  const icon =
                    alert.type === "orders"
                      ? "notifications-outline"
                      : alert.type === "stock"
                      ? "alert-circle-outline"
                      : "information-circle-outline";
                  return (
                    <View key={alert.id} style={styles.alertItem}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.alertItemMain,
                          destinationTab && styles.alertItemMainInteractive,
                          destinationTab && pressed && styles.alertItemMainPressed,
                        ]}
                        onPress={() => onOpenAlert(alert)}
                        disabled={!destinationTab}
                      >
                        <Ionicons name={icon} size={16} color={theme.colors.primaryStrong} />
                        <View style={styles.alertItemTextWrap}>
                          <Text style={styles.alertItemTitle}>{alert.title}</Text>
                          <Text style={styles.alertItemMessage}>{alert.message}</Text>
                          <Text style={styles.alertItemMeta}>{formatDateTime(alert.createdAt)}</Text>
                          {destinationTab ? (
                            <Text style={styles.alertItemLinkText}>Abrir {destinationTab}</Text>
                          ) : null}
                        </View>
                      </Pressable>
                      <Pressable
                        style={styles.alertItemDismissButton}
                        onPress={() => dismissInAppAlert(alert.id)}
                      >
                        <Ionicons name="close-outline" size={16} color={theme.colors.textMuted} />
                      </Pressable>
                    </View>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.alertEmptyWrap}>
                <Text style={styles.alertEmptyText}>Todo al dia. No hay alertas por revisar.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const AdminTabs = () => {
  const user = useAuthStore((state) => state.user);
  const syncTick = useSyncStore((state) => state.syncTick);
  const isOwner = user?.role === "owner";
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

  const loadPendingOrdersCount = useCallback(async () => {
    try {
      const rows = await listOrders("pendiente");
      setPendingOrdersCount(rows.length);
    } catch {
      // keep last known badge value on transient errors
    }
  }, []);

  useEffect(() => {
    void loadPendingOrdersCount();
  }, [loadPendingOrdersCount, syncTick]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: theme.colors.gradientStart },
        headerTintColor: theme.colors.white,
        headerTitleStyle: { fontWeight: "800" },
        headerRight: HeaderActions,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          height: 64,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", paddingBottom: 4 },
        tabBarIcon: ({ color, size }) => {
          const isOrdersTab = route.name === "Pedidos";
          return (
            <View style={styles.tabIconWrap}>
              <Ionicons
                name={tabIconByRoute[route.name as keyof AdminTabParamList]}
                size={size}
                color={color}
              />
              {isOrdersTab && pendingOrdersCount > 0 ? (
                <View style={styles.tabIconBadge}>
                  <Text style={styles.tabIconBadgeText}>
                    {pendingOrdersCount > 99 ? "99+" : pendingOrdersCount}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Productos" component={ProductsScreen} />
      <Tab.Screen name="Pedidos" component={OrdersScreen} />
      <Tab.Screen name="Ventas" component={SalesScreen} />
      <Tab.Screen name="Resenas" component={ReviewsScreen} />
      {isOwner ? <Tab.Screen name="Usuarios" component={UsersScreen} /> : null}
    </Tab.Navigator>
  );
};

const LoginStack = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Login" component={LoginScreen} />
  </AuthStack.Navigator>
);

export const AppNavigator = () => {
  const isAuthenticated = useAuthStore((state) => state.status === "authenticated");
  const autoSyncEnabled = useSyncStore((state) => state.autoSyncEnabled);
  const triggerAutoSync = useSyncStore((state) => state.triggerAutoSync);

  useEffect(() => {
    if (!isAuthenticated || !autoSyncEnabled) {
      return;
    }
    const timerId = setInterval(() => {
      triggerAutoSync();
    }, ENV.autoSyncIntervalMs);
    return () => clearInterval(timerId);
  }, [isAuthenticated, autoSyncEnabled, triggerAutoSync]);

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <RootStack.Screen name="Admin" component={AdminTabs} />
      ) : (
        <RootStack.Screen name="Auth" component={LoginStack} />
      )}
    </RootStack.Navigator>
  );
};

const styles = StyleSheet.create({
  tabIconWrap: {
    minWidth: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconBadge: {
    position: "absolute",
    right: -11,
    top: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 9,
    paddingHorizontal: 3,
    backgroundColor: "#ef4444",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconBadgeText: {
    color: theme.colors.white,
    fontSize: 9,
    fontWeight: "900",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  alertsButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  alertsBadge: {
    position: "absolute",
    right: -5,
    top: -5,
    minWidth: 17,
    height: 17,
    borderRadius: 10,
    paddingHorizontal: 4,
    backgroundColor: "#ef4444",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  alertsBadgeText: {
    color: theme.colors.white,
    fontSize: 9,
    fontWeight: "900",
  },
  syncButton: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  syncButtonLabel: {
    color: theme.colors.white,
    fontWeight: "700",
    fontSize: 12,
  },
  logoutButton: {
    backgroundColor: "rgba(239,68,68,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  logoutButtonLabel: {
    color: theme.colors.white,
    fontWeight: "700",
    fontSize: 12,
  },
  alertModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  alertModalCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    maxHeight: "72%",
    gap: 10,
  },
  alertModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  alertModalTitle: {
    color: theme.colors.text,
    fontWeight: "900",
    fontSize: 18,
  },
  alertModalSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  alertModalCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  alertModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  alertModalClearButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  alertModalClearButtonText: {
    color: theme.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "800",
  },
  alertList: {
    gap: 8,
  },
  alertItem: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  alertItemMain: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    flex: 1,
  },
  alertItemMainInteractive: {
    borderRadius: theme.radius.sm,
    paddingRight: 4,
  },
  alertItemMainPressed: {
    opacity: 0.75,
  },
  alertItemTextWrap: {
    flex: 1,
    gap: 2,
  },
  alertItemTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  alertItemMessage: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  alertItemMeta: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  alertItemLinkText: {
    color: theme.colors.primaryStrong,
    fontSize: 11,
    fontWeight: "800",
  },
  alertItemDismissButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  alertEmptyWrap: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  alertEmptyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
});
