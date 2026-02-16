import { StyleSheet, Text, View } from "react-native";
import { theme } from "../constants/theme";

interface StatusBadgeProps {
  text: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}

const toneStyle = {
  neutral: {
    backgroundColor: "rgba(98,108,113,0.15)",
    color: theme.colors.text,
  },
  success: {
    backgroundColor: "rgba(16,185,129,0.18)",
    color: "#065f46",
  },
  warning: {
    backgroundColor: "rgba(245,158,11,0.2)",
    color: "#854d0e",
  },
  danger: {
    backgroundColor: "rgba(239,68,68,0.18)",
    color: "#991b1b",
  },
} as const;

export const StatusBadge = ({ text, tone = "neutral" }: StatusBadgeProps) => {
  const palette = toneStyle[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.backgroundColor }]}>
      <Text style={[styles.text, { color: palette.color }]}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});

