import { StyleSheet, Text, View } from "react-native";
import { theme } from "../constants/theme";

interface EmptyStateProps {
  title: string;
  subtitle?: string;
}

export const EmptyState = ({ title, subtitle }: EmptyStateProps) => (
  <View style={styles.container}>
    <Text style={styles.title}>{title}</Text>
    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    padding: 16,
    gap: 6,
  },
  title: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 15,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
});

