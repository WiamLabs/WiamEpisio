/**
 * Creator application accepted — navigate to StudioHome
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Check, Sparkles } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';

const CreatorApplyAcceptedScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={styles.glow} />
        <View style={styles.badge}>
          <Check size={42} color={COLORS.navy} strokeWidth={2.4} />
        </View>
        <Text style={styles.h1}>Welcome to WiamStudio</Text>
        <Text style={styles.sub}>
          The WiamEpisio team reviewed your sample and unlocked Studio for you. Build a complete series — our team publishes when everything passes review.
        </Text>

        <View style={styles.card}>
          <View style={styles.tlRow}>
            <View style={[styles.dot, styles.dotDone]}>
              <Check size={12} color="#3BB273" />
            </View>
            <View>
              <Text style={styles.tlTitle}>Application accepted</Text>
              <Text style={styles.tlSub}>You can create your first series now</Text>
            </View>
          </View>
          <View style={styles.tlRow}>
            <View style={[styles.dot, styles.dotWait]} />
            <View>
              <Text style={styles.tlTitle}>Upload cover, trailer & episodes</Text>
              <Text style={styles.tlSub}>9:16 · 4–5 min · complete story</Text>
            </View>
          </View>
          <View style={styles.tlRow}>
            <View style={[styles.dot, styles.dotWait]}>
              <Sparkles size={11} color={COLORS.textFaint} />
            </View>
            <View>
              <Text style={styles.tlTitle}>Our team publishes when ready</Text>
              <Text style={styles.tlSub}>You never self-publish to viewers</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <TouchableOpacity style={styles.cta} onPress={() => navigation.replace('StudioHome')}>
          <Text style={styles.ctaText}>Open WiamStudio</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Main')}>
          <Text style={styles.ghost}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  wrap: { alignItems: 'center', paddingHorizontal: 30, paddingTop: 40, paddingBottom: 24 },
  glow: {
    position: 'absolute', top: 20, width: 320, height: 320, borderRadius: 160,
    backgroundColor: 'rgba(212,160,23,0.18)',
  },
  badge: {
    width: 104, height: 104, borderRadius: 52, marginBottom: 26,
    backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.gold, shadowOpacity: 0.4, shadowRadius: 20, elevation: 8,
  },
  h1: { fontSize: 23, fontFamily: FONTS.extraBold, color: '#fff', textAlign: 'center', marginBottom: 10 },
  sub: {
    fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textDim, textAlign: 'center',
    lineHeight: 20, maxWidth: 300, marginBottom: 28,
  },
  card: {
    width: '100%', backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 16, padding: 16,
  },
  tlRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  dot: {
    width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
  },
  dotDone: { backgroundColor: 'rgba(59,178,115,0.16)' },
  dotWait: { backgroundColor: COLORS.navySoft, borderWidth: 1, borderColor: COLORS.navyLine },
  tlTitle: { fontSize: 12, fontFamily: FONTS.bold, color: '#fff' },
  tlSub: { fontSize: 10.5, fontFamily: FONTS.regular, color: COLORS.textFaint, marginTop: 2 },
  footer: { paddingHorizontal: 30, alignItems: 'center' },
  cta: {
    width: '100%', padding: 16, borderRadius: 16, backgroundColor: COLORS.gold,
    alignItems: 'center', marginBottom: 14,
  },
  ctaText: { fontSize: 15.5, fontFamily: FONTS.extraBold, color: COLORS.navy },
  ghost: { fontSize: 12.5, fontFamily: FONTS.semi, color: COLORS.textDim },
});

export default CreatorApplyAcceptedScreen;
