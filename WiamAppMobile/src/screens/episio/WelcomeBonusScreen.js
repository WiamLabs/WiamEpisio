/**
 * Style: WiamEpisio-Welcome-Bonus.html
 * Claim & Start Watching → Main
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Circle, Check } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';

const PERKS = [
  'Follow any creator for +10 bonus coins',
  'Come back daily for free member points',
  'Save series to My List, never lose your place',
];

const WelcomeBonusScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 24) }]}>
      <View style={styles.glow} />

      <View style={[styles.body, { paddingTop: insets.top + 40 }]}>
        <View style={styles.coinStack}>
          <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.coin}>
            <Circle size={40} color={COLORS.navy} fill={COLORS.navy} />
          </LinearGradient>
        </View>

        <Text style={styles.h1}>Welcome to WiamEpisio!</Text>
        <Text style={styles.amount}>+50 Coins</Text>
        <Text style={styles.sub}>
          Your free coins are ready. Use them to{'\n'}unlock any locked episode right now.
        </Text>

        <View style={styles.perks}>
          {PERKS.map((line) => (
            <View key={line} style={styles.perkRow}>
              <Check size={16} color={COLORS.gold} strokeWidth={2} />
              <Text style={styles.perkText}>{line}</Text>
            </View>
          ))}
        </View>

        <EpisioGoldButton
          label="Claim & Start Watching"
          onPress={() => navigation.replace('Main')}
          style={{ width: '100%' }}
          textStyle={styles.claimText}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(212,160,23,0.2)',
  },
  body: { width: '100%', paddingHorizontal: 30, alignItems: 'center' },
  coinStack: { marginBottom: 22, zIndex: 1 },
  coin: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  h1: { fontSize: 22, fontFamily: FONTS.extraBold, color: '#fff', marginBottom: 8, zIndex: 1 },
  amount: { fontSize: 36, fontFamily: FONTS.extraBold, color: COLORS.gold, marginBottom: 6, zIndex: 1 },
  sub: {
    fontSize: 12.5,
    color: '#7D7D97',
    lineHeight: 19.4,
    textAlign: 'center',
    marginBottom: 28,
    zIndex: 1,
  },
  perks: { width: '100%', marginBottom: 28, zIndex: 1 },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    borderRadius: 14,
    padding: 12,
    paddingHorizontal: 14,
    marginBottom: 9,
  },
  perkText: { flex: 1, fontSize: 12, color: '#D3D3E2', fontFamily: FONTS.regular },
  claimText: { fontFamily: FONTS.bold, fontSize: 14.5 },
});

export default WelcomeBonusScreen;
