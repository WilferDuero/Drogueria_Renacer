import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ActionButton } from "../../components/ActionButton";
import { FormField } from "../../components/FormField";
import { ScreenContainer } from "../../components/ScreenContainer";
import { theme } from "../../constants/theme";
import { useAuthStore } from "../../store/auth-store";
import { ENV } from "../../config/env";

export const LoginScreen = () => {
  const login = useAuthStore((state) => state.login);
  const isLoginPending = useAuthStore((state) => state.isLoginPending);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    const user = username.trim();
    const pass = password.trim();
    if (!user || !pass) {
      setErrorMessage("Usuario y contrasena son obligatorios.");
      return;
    }

    try {
      setErrorMessage(null);
      await login(user, pass);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No fue posible iniciar sesion.";
      setErrorMessage(message);
    }
  };

  return (
    <ScreenContainer scrollable={false} contentContainerStyle={styles.screenContent}>
      <LinearGradient
        colors={[theme.colors.gradientStart, theme.colors.gradientEnd]}
        style={styles.header}
      >
        <Image
          source={require("../../../assets/logo-drogueria.jpg")}
          style={styles.logo}
        />
        <View style={styles.headerText}>
          <Text style={styles.title}>Drogueria Renacer</Text>
          <Text style={styles.subtitle}>Panel Admin Movil</Text>
        </View>
      </LinearGradient>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Acceso restringido</Text>
        <FormField
          label="Usuario"
          value={username}
          onChangeText={setUsername}
          placeholder="owner o staff"
        />
        <FormField
          label="Contrasena"
          value={password}
          onChangeText={setPassword}
          placeholder="********"
          secureTextEntry
        />
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        <ActionButton
          label="Ingresar"
          onPress={() => void handleLogin()}
          loading={isLoginPending}
          disabled={isLoginPending}
        />
        <Text style={styles.apiLabel}>API: {ENV.apiBaseUrl}</Text>
      </View>

      {isLoginPending ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={theme.colors.white} size="large" />
        </View>
      ) : null}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  screenContent: {
    justifyContent: "center",
    gap: 14,
    flex: 1,
    padding: 16,
  },
  header: {
    borderRadius: theme.radius.lg,
    minHeight: 128,
    padding: 16,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  logo: {
    width: 74,
    height: 74,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: theme.colors.white,
    fontWeight: "800",
    fontSize: 22,
  },
  subtitle: {
    color: "rgba(255,255,255,0.95)",
    fontWeight: "600",
  },
  formCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    padding: 14,
    gap: 12,
  },
  formTitle: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 18,
  },
  apiLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  error: {
    color: "#991b1b",
    backgroundColor: "rgba(239,68,68,0.12)",
    borderRadius: theme.radius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
});
