import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../constants/theme";

interface SectionCardProps {
  title?: string;
  children: ReactNode;
}

export const SectionCard = ({ title, children }: SectionCardProps) => (
  <View style={styles.card}>
    {title ? <Text style={styles.title}>{title}</Text> : null}
    {children}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 12,
    gap: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  title: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 15,
  },
});
