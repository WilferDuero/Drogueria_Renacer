import Ionicons from "@expo/vector-icons/Ionicons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ENV } from "../config/env";
import { theme } from "../constants/theme";
import { LoginScreen } from "../features/auth/LoginScreen";
import { DashboardScreen } from "../features/dashboard/DashboardScreen";
import { OrdersScreen } from "../features/orders/OrdersScreen";
import { ProductsScreen } from "../features/products/ProductsScreen";
import { ReviewsScreen } from "../features/reviews/ReviewsScreen";
import { SalesScreen } from "../features/sales/SalesScreen";
import { UsersScreen } from "../features/users/UsersScreen";
import { useAuthStore } from "../store/auth-store";
import { useSyncStore } from "../store/sync-store";
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

const HeaderActions = () => {
  const logout = useAuthStore((state) => state.logout);
  const triggerSync = useSyncStore((state) => state.triggerSync);
  const alertsCount = useSyncStore((state) => state.inAppAlerts.length);

  return (
    <View style={styles.headerActions}>
      <Pressable style={styles.syncButton} onPress={triggerSync}>
        <Text style={styles.syncButtonLabel}>
          Sincronizar{alertsCount > 0 ? ` (${alertsCount})` : ""}
        </Text>
      </Pressable>
      <Pressable style={styles.logoutButton} onPress={() => void logout()}>
        <Text style={styles.logoutButtonLabel}>Salir</Text>
      </Pressable>
    </View>
  );
};

const AdminTabs = () => {
  const user = useAuthStore((state) => state.user);
  const isOwner = user?.role === "owner";

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
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={tabIconByRoute[route.name as keyof AdminTabParamList]}
            size={size}
            color={color}
          />
        ),
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
  headerActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
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
});
