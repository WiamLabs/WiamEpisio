import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { COLORS, FONTS, SPACING } from '../constants/theme';

const YEAR = new Date().getFullYear();

const BrandedFooter = ({ compact = false }) => {
  const openLink = (path) => {
    Linking.openURL(`https://wiamapp.com${path}`).catch(() => {});
  };

  if (compact) {
    return (
      <View style={styles.compactWrap}>
        <Text style={styles.compactText}>
          © {YEAR} <Text style={styles.brandAccent}>WiamApp</Text> · Powered by{' '}
          <Text style={styles.brandAccent}>WiamLabs</Text>
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.footer}>
      <Text style={styles.footerBrand}>WiamApp</Text>
      <View style={styles.footerLinks}>
        <TouchableOpacity onPress={() => openLink('/careers')}>
          <Text style={styles.footerLink}>Careers</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openLink('/about')}>
          <Text style={styles.footerLink}>About</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openLink('/privacy')}>
          <Text style={styles.footerLink}>Privacy</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openLink('/terms')}>
          <Text style={styles.footerLink}>Terms</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openLink('/help')}>
          <Text style={styles.footerLink}>Help</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.footerCopy}>© {YEAR} WiamApp · Powered by WiamLabs</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    marginTop: SPACING.xxl,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    alignItems: 'center',
  },
  footerBrand: {
    color: COLORS.secondary,
    fontFamily: FONTS.display,
    fontSize: 18,
    marginBottom: SPACING.sm,
  },
  footerLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  footerLink: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  footerCopy: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  compactWrap: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  compactText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  brandAccent: {
    color: COLORS.secondary,
    fontWeight: '600',
  },
});

export default BrandedFooter;
