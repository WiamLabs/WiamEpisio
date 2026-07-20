/**
 * Style: WiamEpisio-Onboarding-Genres.html
 * Min 3 genres · Continue → OnboardingDone
 */
import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronLeft, Check, Layers, Heart, Sparkles, Lock, Crown,
  Smile, Shield, Play, Users, Tv,
} from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';

const MIN_GENRES = 3;

const GENRES = [
  { id: 'drama', name: 'Drama', count: '1,204 series', Icon: Layers },
  { id: 'romance', name: 'Romance', count: '980 series', Icon: Heart },
  { id: 'revenge', name: 'Revenge', count: '640 series', Icon: Sparkles },
  { id: 'hidden', name: 'Hidden Identity', count: '512 series', Icon: Lock },
  { id: 'royal', name: 'Royal & Palace', count: '388 series', Icon: Crown },
  { id: 'comedy', name: 'Comedy', count: '276 series', Icon: Smile },
  { id: 'thriller', name: 'Thriller', count: '341 series', Icon: Shield },
  { id: 'action', name: 'Action', count: '299 series', Icon: Play },
  { id: 'feud', name: 'Family Feud', count: '204 series', Icon: Users },
  { id: 'anime', name: 'Anime', count: '150 series', Icon: Tv },
];

const OnboardingGenresScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [selected, setSelected] = useState(['drama', 'romance', 'royal']);

  const toggle = (id) => {
    setSelected((prev) => (
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    ));
  };

  const ready = selected.length >= MIN_GENRES;
  const counterLabel = useMemo(() => {
    if (selected.length < MIN_GENRES) {
      return ` of ${MIN_GENRES} selected — pick ${MIN_GENRES - selected.length} more`;
    }
    return ` of ${MIN_GENRES} selected — you're good to go`;
  }, [selected.length]);

  const continueNext = () => {
    const names = GENRES.filter((g) => selected.includes(g.id)).map((g) => g.name);
    navigation.navigate('OnboardingDone', { genres: names });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topbar}>
        <View style={styles.backRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <ChevronLeft size={15} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.replace('Main')}>
            <Text style={styles.skipLink}>Skip</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
        </View>

        <Text style={styles.h1}>What do you love watching?</Text>
        <Text style={styles.sub}>
          Pick at least <Text style={styles.subBold}>3 genres</Text> — we'll build your Home around them.
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {GENRES.map(({ id, name, count, Icon }) => {
            const sel = selected.includes(id);
            return (
              <TouchableOpacity
                key={id}
                activeOpacity={0.85}
                onPress={() => toggle(id)}
                style={[styles.chip, sel && styles.chipSel]}
              >
                <View style={[styles.check, sel && styles.checkSel]}>
                  {sel ? <Check size={11} color={COLORS.navy} strokeWidth={3} /> : null}
                </View>
                <View style={[styles.chipIcon, sel && styles.chipIconSel]}>
                  <Icon size={16} color={sel ? COLORS.navy : '#C9C9DE'} />
                </View>
                <Text style={styles.chipName}>{name}</Text>
                <Text style={styles.chipCount}>{count}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 26) }]}>
        <Text style={styles.counter}>
          <Text style={styles.counterBold}>{selected.length}</Text>
          {counterLabel}
        </Text>
        <TouchableOpacity activeOpacity={0.9} onPress={continueNext} disabled={!ready}>
          <LinearGradient
            colors={[COLORS.gold, COLORS.goldDark]}
            style={[styles.btn, !ready && styles.btnDisabled]}
          >
            <Text style={styles.btnText}>Continue</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  topbar: { paddingHorizontal: 24, paddingBottom: 18 },
  backRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  skipLink: { fontSize: 12.5, fontFamily: FONTS.semi, color: COLORS.textDim },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 22 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.navyLine },
  dotActive: { width: 20, borderRadius: 4, backgroundColor: COLORS.gold },
  h1: { fontSize: 23, fontFamily: FONTS.extraBold, color: '#fff', letterSpacing: -0.3, marginBottom: 8 },
  sub: { fontSize: 13, color: COLORS.textDim, lineHeight: 19.5 },
  subBold: { color: COLORS.gold, fontFamily: FONTS.bold },
  scroll: { flex: 1, paddingHorizontal: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  chip: {
    width: '48%',
    borderRadius: 16,
    padding: 16,
    paddingRight: 14,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1.5,
    borderColor: COLORS.navyLine,
    overflow: 'hidden',
  },
  chipSel: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(212,160,23,0.12)',
  },
  check: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.navyLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSel: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  chipIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.navySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  chipIconSel: { backgroundColor: COLORS.gold },
  chipName: { fontSize: 13.5, fontFamily: FONTS.bold, color: '#fff' },
  chipCount: { fontSize: 10, color: COLORS.textFaint, marginTop: 2 },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.navyLine,
    backgroundColor: COLORS.navy,
  },
  counter: { textAlign: 'center', fontSize: 12, color: COLORS.textDim, fontFamily: FONTS.semi, marginBottom: 12 },
  counterBold: { color: COLORS.gold, fontFamily: FONTS.bold },
  btn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.35 },
  btnText: { fontFamily: FONTS.extraBold, color: COLORS.navy, fontSize: 15 },
});

export default OnboardingGenresScreen;
