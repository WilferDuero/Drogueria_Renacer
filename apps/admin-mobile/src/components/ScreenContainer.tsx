import { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../constants/theme";

interface ScreenContainerProps {
  children: ReactNode;
  scrollable?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export const ScreenContainer = ({
  children,
  scrollable = true,
  contentContainerStyle,
  refreshing = false,
  onRefresh,
}: ScreenContainerProps) => {
  const body = scrollable ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primaryStrong}
            colors={[theme.colors.primaryStrong]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, contentContainerStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {body}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: 14,
    gap: 12,
  },
});

