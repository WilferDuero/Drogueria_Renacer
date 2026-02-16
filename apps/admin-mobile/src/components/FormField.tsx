import { useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  KeyboardTypeOptions,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { theme } from "../constants/theme";

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  multiline?: boolean;
  editable?: boolean;
  showPasswordToggle?: boolean;
}

export const FormField = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  secureTextEntry = false,
  multiline = false,
  editable = true,
  showPasswordToggle = true,
}: FormFieldProps) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const canTogglePassword = secureTextEntry && showPasswordToggle && !multiline;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          multiline={multiline}
          editable={editable}
          style={[
            styles.input,
            multiline && styles.multiline,
            canTogglePassword && styles.inputWithToggle,
            !editable && styles.disabled,
          ]}
          autoCapitalize="none"
        />
        {canTogglePassword ? (
          <Pressable
            style={styles.toggleButton}
            onPress={() => setIsPasswordVisible((prev) => !prev)}
            disabled={!editable}
            hitSlop={8}
          >
            <Ionicons
              name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
              size={18}
              color={theme.colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  inputWrapper: {
    position: "relative",
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  inputWithToggle: {
    paddingRight: 42,
  },
  toggleButton: {
    position: "absolute",
    right: 10,
    top: 11,
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  disabled: {
    opacity: 0.7,
  },
});
