/**
 * Style: WiamEpisio-Onboarding-Done.html
 * Start Watching → WelcomeBonus · Maybe later → Main
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Check } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';

const OnboardingDoneScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const genres = route.params?.genres || ['Drama', 'Romance', 'Royal & Palace'];

  const genreLine = genres.length <= 3
    ? genres.map((g) => g.replace(/ & Palace$/, '').replace(/^Royal$/, 'Royal')).join(', ').replace(/, ([^,]*)$/, ' & $1')
    : `${genres.slice(0, 2).join(', ')} & ${genres[2]}`;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 60) }]}>
      <View style={styles.glowBg} />

      <View style={styles.wrap}>
        <View style={styles.badgeRing}>
          <View style={styles.ring} />
          <View style={styles.ring2}>
            <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.checkMark}>
              <Check size={24} color={COLORS.navy} strokeWidth={3} />
            </LinearGradient>
          </View>
          <View style={[styles.spark, styles.s1]} />
          <View style={[styles.spark, styles.s2]} />
          <View style={[styles.spark, styles.s3]} />
        </View>

        <Text style={styles.h1}>You're all set!</Text>
        <Text style={styles.sub}>
          Your feed is personalized around <Text style={styles.subBold}>{genreLine}</Text>.
          {' '}New episodes drop every week.
        </Text>

        <View style={styles.coinCard}>
          <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.coinIcon}>
            <Text style={styles.coinLetter}>W</Text>
          </LinearGradient>
          <View style={styles.coinText}>
            <Text style={styles.coinTitle}>Welcome bonus</Text>
            <Text style={styles.coinSub}>Added to your wallet</Text>
          </View>
          <Text style={styles.coinAmount}>+50 coins</Text>
        </View>

        <EpisioGoldButton
          label="Start Watching"
          onPress={() => navigation.navigate('WelcomeBonus')}
          style={{ width: '100%', marginBottom: 14 }}
          textStyle={styles.btnText}
        />

        <TouchableOpacity onPress={() => navigation.replace('Main')}>
          <Text style={styles.ghostLink}>Maybe later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center' },
  glowBg: {
    position: 'absolute',
    top: 60,
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(212,160,23,0.20)',
  },
  wrap: { alignItems: 'center', paddingHorizontal: 32, width: '100%' },
  badgeRing: { width: 132, height: 132, marginBottom: 28, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 2,
    borderColor: 'rgba(212,160,23,0.35)',
    borderStyle: 'dashed',
  },
  ring2: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spark: { position: 'absolute', borderRadius: 999, backgroundColor: COLORS.gold },
  s1: { width: 8, height: 8, top: 4, right: 10, opacity: 0.8 },
  s2: { width: 5, height: 5, bottom: 14, left: 0, opacity: 0.6 },
  s3: { width: 6, height: 6, top: 40, right: -6, opacity: 0.7 },
  h1: { fontSize: 24, fontFamily: FONTS.extraBold, color: '#fff', letterSpacing: -0.3, marginBottom: 10 },
  sub: { fontSize: 13.5, color: '#7D7D97', lineHeight: 21.6, textAlign: 'center', marginBottom: 28, maxWidth: 280 },
  subBold: { color: '#fff', fontFamily: FONTS.bold },
  coinCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    borderRadius: 18,
    padding: 16,
    marginBottom: 32,
  },
  coinIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinLetter: { fontFamily: FONTS.extraBold, color: COLORS.navy, fontSize: 18 },
  coinText: { flex: 1 },
  coinTitle: { fontSize: 14.5, fontFamily: FONTS.extraBold, color: '#fff' },
  coinSub: { fontSize: 11.5, color: '#7D7D97', marginTop: 2 },
  coinAmount: { fontSize: 16, fontFamily: FONTS.extraBold, color: COLORS.gold },
  btnText: { fontSize: 15.5 },
  ghostLink: { fontSize: 12.5, color: '#7D7D97', fontFamily: FONTS.semi },
});

export default OnboardingDoneScreen;
