import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/theme';

/**
 * LetterAvatar — consistent fallback avatar across the app.
 * Shows the first letter(s) of the user's name in a colored circle.
 *
 * Props:
 *   name      — display name or first name (required)
 *   size      — circle diameter (default 44)
 *   fontSize  — override letter font size (default ~45% of size)
 *   bg        — background color (default COLORS.secondary)
 *   color     — letter color (default '#000')
 *   style     — extra View styles
 *   letters   — how many initials to show (1 or 2, default 1)
 *   borderWidth — optional border width
 *   borderColor — optional border color
 */
const LetterAvatar = ({
  name = '',
  size = 44,
  fontSize,
  bg,
  color,
  style,
  letters = 1,
  borderWidth = 2,
  borderColor,
}) => {
  const parts = (name || 'U').trim().split(/\s+/);
  const initials =
    letters >= 2 && parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : (parts[0][0] || 'U').toUpperCase();

  const sz = size;
  const fs = fontSize || Math.round(sz * 0.45);

  return (
    <View
      style={[
        {
          width: sz,
          height: sz,
          borderRadius: sz / 2,
          backgroundColor: bg || COLORS.secondary,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth,
          borderColor: borderColor || 'rgba(212,168,67,0.5)',
        },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: fs,
          fontWeight: '700',
          color: color || '#000',
          includeFontPadding: false,
        }}
      >
        {initials}
      </Text>
    </View>
  );
};

export default LetterAvatar;
