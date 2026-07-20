/**
 * Layout: WiamStudio-Quality-Rejected-Banner.html
 * Compact / full variants for Studio Home + Episode List.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertCircle, X } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';

const QualityRejectedBanner = ({
  variant = 'compact',
  title,
  subtitle,
  onPress,
  ctaLabel = 'Fix →',
}) => {
  if (variant === 'full') {
    return (
      <View style={styles.full}>
        <View style={styles.fullHead}>
          <X size={15} color={COLORS.error} />
          <Text style={styles.fullTitle}>{title}</Text>
        </View>
        {subtitle ? <Text style={styles.fullText}>{subtitle}</Text> : null}
        {onPress ? (
          <TouchableOpacity onPress={onPress} style={styles.fullBtn}>
            <Text style={styles.fullBtnText}>{ctaLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.compact} onPress={onPress} disabled={!onPress} activeOpacity={0.85}>
      <AlertCircle size={18} color={COLORS.error} />
      <View style={styles.compactBody}>
        <Text style={styles.compactTitle}>{title}</Text>
        {subtitle ? <Text style={styles.compactSub}>{subtitle}</Text> : null}
      </View>
      {onPress ? <Text style={styles.compactLink}>{ctaLabel}</Text> : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(228,87,61,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(228,87,61,0.3)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  compactBody: { flex: 1 },
  compactTitle: { fontFamily: FONTS.bold, color: '#fff', fontSize: 12 },
  compactSub: { marginTop: 2, fontFamily: FONTS.regular, color: '#E0A79A', fontSize: 10.5 },
  compactLink: { fontFamily: FONTS.extraBold, color: COLORS.gold, fontSize: 11 },
  full: {
    backgroundColor: 'rgba(228,87,61,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(228,87,61,0.3)',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.error,
    borderRadius: 12,
    padding: 13,
    marginBottom: 14,
  },
  fullHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  fullTitle: { fontFamily: FONTS.extraBold, color: '#fff', fontSize: 12 },
  fullText: { fontFamily: FONTS.regular, color: '#E0A79A', fontSize: 11, lineHeight: 17, marginBottom: 10 },
  fullBtn: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.gold,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  fullBtnText: { fontFamily: FONTS.extraBold, color: COLORS.navy, fontSize: 11 },
});

export default QualityRejectedBanner;
