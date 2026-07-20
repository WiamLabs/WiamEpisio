/**
 * Primary gold CTA — matches HTML linear-gradient gold buttons.
 */
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const EpisioGoldButton = ({
  label,
  onPress,
  disabled,
  loading,
  style,
  textStyle,
  variant = 'gold',
}) => {
  if (variant === 'ghost') {
    return (
      <TouchableOpacity
        style={[styles.ghost, disabled && styles.disabled, style]}
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.gold} />
        ) : (
          <Text style={[styles.ghostText, textStyle]}>{label}</Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.9}
      style={[disabled && styles.disabled, style]}
    >
      <LinearGradient
        colors={[COLORS.gold, COLORS.goldDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gold}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.navy} />
        ) : (
          <Text style={[styles.goldText, textStyle]}>{label}</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  gold: {
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldText: {
    fontFamily: FONTS.extraBold,
    fontSize: 13,
    color: COLORS.navy,
  },
  ghost: {
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
  },
  ghostText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#C9C9DE',
  },
  disabled: { opacity: 0.5 },
});

export default EpisioGoldButton;
