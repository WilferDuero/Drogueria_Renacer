import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../constants/theme";

type KpiTone = "primary" | "success" | "warning" | "danger" | "neutral";

interface KpiCardProps {
  label: string;
  value: string;
  tone?: KpiTone;
  icon?: keyof typeof Ionicons.glyphMap;
  compact?: boolean;
}

const gradientByTone: Record<KpiTone, readonly [string, string]> = {
  primary: ["rgba(33,128,141,0.2)", "rgba(11,99,208,0.06)"],
  success: ["rgba(16,185,129,0.2)", "rgba(16,185,129,0.05)"],
  warning: ["rgba(245,158,11,0.2)", "rgba(245,158,11,0.05)"],
  danger: ["rgba(239,68,68,0.2)", "rgba(239,68,68,0.05)"],
  neutral: ["rgba(98,108,113,0.16)", "rgba(98,108,113,0.04)"],
};

const iconColorByTone: Record<KpiTone, string> = {
  primary: theme.colors.primaryStrong,
  success: theme.colors.success,
  warning: theme.colors.warning,
  danger: theme.colors.danger,
  neutral: theme.colors.textMuted,
};

export const KpiCard = ({
  label,
  value,
  tone = "primary",
  icon = "stats-chart-outline",
  compact = false,
}: KpiCardProps) => (
  <View style={[styles.shell, { borderColor: gradientByTone[tone][0] }]}>
    <LinearGradient
      colors={gradientByTone[tone]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFillObject}
    />
    <View style={styles.content}>
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: "rgba(255,255,255,0.7)" }]}>
          <Ionicons name={icon} size={14} color={iconColorByTone[tone]} />
        </View>
        <Text style={styles.label} numberOfLines={2}>
          {label}
        </Text>
      </View>
      <Text
        style={[styles.value, compact && styles.valueCompact]}
        numberOfLines={2}
        minimumFontScale={0.8}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  shell: {
    borderWidth: 1,
    borderRadius: theme.radius.md,
    overflow: "hidden",
    backgroundColor: theme.colors.card,
    minHeight: 102,
  },
  content: {
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: theme.colors.textMuted,
    fontWeight: "700",
    fontSize: 12,
    flexShrink: 1,
    lineHeight: 16,
  },
  value: {
    color: theme.colors.text,
    fontWeight: "900",
    fontSize: 22,
    lineHeight: 26,
    fontVariant: ["tabular-nums"],
  },
  valueCompact: {
    fontSize: 17,
    lineHeight: 21,
  },
});
