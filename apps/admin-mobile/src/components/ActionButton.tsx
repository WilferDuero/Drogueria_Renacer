import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { theme } from "../constants/theme";

type Variant = "primary" | "secondary" | "danger";

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
}

const backgroundByVariant: Record<Variant, string> = {
  primary: theme.colors.primary,
  secondary: "rgba(94,82,64,0.12)",
  danger: theme.colors.danger,
};

const textByVariant: Record<Variant, string> = {
  primary: theme.colors.white,
  secondary: theme.colors.text,
  danger: theme.colors.white,
};

export const ActionButton = ({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
}: ActionButtonProps) => {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: backgroundByVariant[variant] },
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textByVariant[variant]} />
      ) : (
        <Text style={[styles.label, { color: textByVariant[variant] }]}>{label}</Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontWeight: "700",
    fontSize: 14,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.55,
  },
});
