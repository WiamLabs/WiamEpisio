import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowLeft, House } from 'lucide-react-native';
import { COLORS, FONTS, SPACING } from '../../constants/theme';
import { STUDIO_COLORS } from '../../constants/studioTheme';

/**
 * Consistent Studio top navigation row:
 * - Back: pops current screen if possible; otherwise jumps to Main.
 * - Home: always jumps to Main (app home shell).
 */
const StudioBackHomeRow = ({ navigation, title = '' }) => {
  const onBack = () => {
    try {
      if (navigation?.canGoBack?.()) {
        navigation.goBack();
        return;
      }
    } catch {}
    navigation?.navigate?.('Main');
  };

  const onHome = () => navigation?.navigate?.('Main');

  return (
    <View style={styles.row}>
      <TouchableOpacity style={styles.btn} onPress={onBack}>
        <ArrowLeft size={18} color={COLORS.white} />
        <Text style={styles.btnText}>Back</Text>
      </TouchableOpacity>
      <View style={styles.titleWrap}>
        {!!title && <Text style={styles.title} numberOfLines={1}>{title}</Text>}
      </View>
      <TouchableOpacity style={styles.btn} onPress={onHome}>
        <House size={16} color={STUDIO_COLORS.accent} />
        <Text style={[styles.btnText, { color: STUDIO_COLORS.accent }]}>Home</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  btnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  titleWrap: {
    flex: 1,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
  },
  title: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: FONTS.body,
  },
});

export default StudioBackHomeRow;
