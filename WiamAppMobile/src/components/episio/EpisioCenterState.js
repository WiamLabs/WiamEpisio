/**
 * Full-screen centered status layout (Maintenance / Offline / Force Update pattern).
 * Gold radial glow + icon circle + headline + sub + optional card + actions.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../../constants/theme';

const EpisioCenterState = ({
  icon,
  title,
  subtitle,
  card,
  statusRow,
  primary,
  secondary,
  tertiary,
  hideBack,
  onBack,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 24) }]}>
      <View style={styles.glow} pointerEvents="none" />
      {!hideBack && onBack ? (
        <TouchableOpacity style={styles.backLink} onPress={onBack}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      ) : <View style={{ height: 28 }} />}

      <View style={styles.wrap}>
        {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
        {card ? <View style={styles.card}>{card}</View> : null}
        {statusRow ? <View style={styles.statusRow}>{statusRow}</View> : null}
        {primary}
        {secondary ? <View style={{ marginTop: 10, width: '100%' }}>{secondary}</View> : null}
        {tertiary ? <View style={{ marginTop: 14 }}>{tertiary}</View> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.navy,
    paddingHorizontal: 32,
  },
  glow: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(212,160,23,0.12)',
  },
  backLink: { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { fontFamily: FONTS.semi, fontSize: 12, color: COLORS.textFaint },
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
  },
  title: {
    fontFamily: FONTS.extraBold,
    fontSize: 19,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  sub: {
    fontFamily: FONTS.regular,
    fontSize: 12.5,
    color: COLORS.textDim,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 24,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 26,
  },
});

export default EpisioCenterState;
