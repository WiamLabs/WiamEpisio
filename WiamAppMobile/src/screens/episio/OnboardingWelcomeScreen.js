/**
 * Style: WiamEpisio-Onboarding-Welcome.html
 * Continue → OnboardingGenres · Skip → Main
 */
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Play } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import LogoBadge from '../../components/episio/LogoBadge';

const { width: SW } = Dimensions.get('window');
const TILE_W = (SW - 12) / 3;

const TILES = [
  { bg: ['#3a1420', '#12122a'], mt: -30 },
  { bg: ['#2a1a3a', '#0d0d24'], mt: 0, play: true },
  { bg: ['#1a2a3a', '#12122a'], mt: -14 },
  { bg: ['#3a2a14', '#12122a'], mt: 10 },
  { bg: ['#241a3a', '#0d0d24'], mt: -10, play: true },
  { bg: ['#3a1414', '#12122a'], mt: 16 },
];

const OnboardingWelcomeScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  return (
    <View style={styles.root}>
      <View style={[styles.collage, { top: insets.top }]}>
        {TILES.map((t, i) => (
          <View key={i} style={[styles.tileWrap, { marginTop: t.mt }]}>
            <LinearGradient colors={t.bg} style={styles.tile}>
              <View style={styles.tileGlow} />
              {t.play ? (
                <View style={styles.tilePlay}>
                  <Play size={10} color="#fff" fill="#fff" />
                </View>
              ) : null}
            </LinearGradient>
          </View>
        ))}
      </View>

      <LinearGradient
        colors={['rgba(8,8,26,0.15)', 'rgba(8,8,26,0.55)', COLORS.navy]}
        locations={[0, 0.42, 0.78]}
        style={StyleSheet.absoluteFill}
      />

      <TouchableOpacity
        style={[styles.skip, { top: insets.top + 12 }]}
        onPress={() => navigation.replace('Main')}
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, 40) }]}>
        <LogoBadge size={64} />
        <Text style={styles.wordmark}>
          Wiam<Text style={{ color: COLORS.gold }}>Episio</Text>
        </Text>
        <Text style={styles.tagline}>African Vertical Drama</Text>
        <Text style={styles.sub}>
          Bold stories, short episodes. New series every week — made in Africa, built for your phone.
        </Text>

        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('OnboardingGenres')}
        >
          <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.btn}>
            <Text style={styles.btnText}>Continue</Text>
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.note}>Takes less than 30 seconds</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  collage: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '56%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 6,
    gap: 6,
  },
  tileWrap: { width: TILE_W },
  tile: {
    height: TILE_W * 1.35,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(212,160,23,0.10)',
  },
  tilePlay: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skip: {
    position: 'absolute',
    right: 20,
    zIndex: 5,
    backgroundColor: 'rgba(18,18,42,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  skipText: { fontSize: 12.5, fontFamily: FONTS.semi, color: COLORS.textDim },
  content: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 28,
    alignItems: 'center',
    zIndex: 2,
  },
  wordmark: {
    marginTop: 20,
    fontSize: 29,
    fontFamily: FONTS.extraBold,
    color: '#fff',
    letterSpacing: -0.5,
  },
  tagline: {
    marginTop: 10,
    fontSize: 15,
    fontFamily: FONTS.semi,
    color: '#E7E7F2',
  },
  sub: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20.8,
    color: COLORS.textDim,
    textAlign: 'center',
    paddingHorizontal: 6,
    marginBottom: 30,
  },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 26 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.navyLine },
  dotActive: { width: 20, borderRadius: 4, backgroundColor: COLORS.gold },
  btn: {
    width: SW - 56,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnText: { fontFamily: FONTS.extraBold, color: COLORS.navy, fontSize: 15.5 },
  note: { fontSize: 11, color: COLORS.textFaint, fontFamily: FONTS.regular },
});

export default OnboardingWelcomeScreen;
