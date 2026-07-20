/**
 * WiamEpisio-Wiam-Origin-Intro.html — Origin shelf intro
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const WiamOriginIntroScreen = () => {
  const navigation = useNavigation();

  return (
    <EpisioScreenShell
      title="Wiam Origin"
      subtitle="Stories born on WiamEpisio"
      footer={(
        <TouchableOpacity
          style={styles.cta}
          onPress={() => navigation.navigate('Shelf', { mode: 'origin', title: 'Wiam Origin' })}
        >
          <Text style={styles.ctaText}>Explore Origin</Text>
        </TouchableOpacity>
      )}
    >
      <LinearGradient colors={['#241a3a', '#0d0d24', COLORS.navy]} style={styles.hero}>
        <Sparkles size={36} color={COLORS.gold} />
        <Text style={styles.brand}>Wiam Origin</Text>
        <Text style={styles.tagline}>Exclusive series from Ghana-founded creators — premium drama made for mobile.</Text>
      </LinearGradient>
      <View style={styles.bullets}>
        {['Founder-curated shelf', 'Early access for VIP members', 'New drops every month'].map((b) => (
          <Text key={b} style={styles.bullet}>• {b}</Text>
        ))}
      </View>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  hero: {
    borderRadius: RADIUS.lg, padding: 28, alignItems: 'center', gap: 12, marginTop: 12,
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  brand: { fontFamily: FONTS.display, fontSize: 26, color: COLORS.gold },
  tagline: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textDim, textAlign: 'center', lineHeight: 20 },
  bullets: { marginTop: 24, gap: 10 },
  bullet: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.text, lineHeight: 22 },
  cta: { backgroundColor: COLORS.gold, borderRadius: RADIUS.md, padding: 15, alignItems: 'center' },
  ctaText: { fontFamily: FONTS.extraBold, fontSize: 14, color: COLORS.navy },
});

export default WiamOriginIntroScreen;
