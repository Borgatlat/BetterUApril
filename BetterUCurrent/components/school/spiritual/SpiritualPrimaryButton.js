import React from "react";
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from "react-native";
import { spiritualTheme as T } from "./spiritualTheme";

/**
 * Primary CTA for spiritual cards — active (cyan), disabled (gray + light text), or loading.
 * @param {object} props
 * @param {string} props.label
 * @param {() => void} props.onPress
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.loading]
 * @param {string} [props.disabledLabel] — shown when disabled (e.g. school link message)
 */
export function SpiritualPrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  disabledLabel,
}) {
  const isOff = disabled && !loading;
  const displayLabel = disabled && disabledLabel ? disabledLabel : label;

  return (
    <TouchableOpacity
      style={[styles.btn, isOff && styles.btnOff]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator color={isOff ? T.textOnDisabled : T.textOnAccent} />
      ) : (
        <Text style={[styles.txt, isOff && styles.txtOff]}>{displayLabel}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: T.accent,
  },
  btnOff: {
    backgroundColor: T.btnDisabledBg,
  },
  txt: {
    color: T.textOnAccent,
    fontWeight: "800",
    fontSize: 15,
  },
  txtOff: {
    color: T.textOnDisabled,
  },
});
