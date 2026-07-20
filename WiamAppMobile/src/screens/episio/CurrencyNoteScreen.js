/**
 * WiamEpisio-Currency-Note.html — About Coins & Pricing.
 * Live FX from USD base (global fair pricing).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS } from '../../constants/theme';
import apiClient from '../../api/client';
import useAuthStore from '../../store/useAuthStore';

const INFO_BLOCKS = [
  {
    title: 'Coins are the only in-app currency',
    body: 'Unlocks are always 10 coins per episode worldwide. Coin packs are priced in USD on our books, then shown in your local currency so Ghana and the USA pay the same value.',
  },
  {
    title: 'Prices are shown in your local currency',
    body: 'On mobile, prices appear in your country currency. On web, we convert from USD using our FX table so the value stays fair.',
  },
  {
    title: "Coins don't expire",
    body: 'Once purchased, coins remain in your wallet indefinitely — no forced expiry, no monthly reset.',
  },
  {
    title: 'Refund policy',
    body: "Coin purchases are generally non-refundable once used to unlock content. If a payment was charged but coins weren't delivered, contact support@wiamapp.com within 7 days for a review.",
  },
];

const CurrencyNoteScreen = () => {
  const user = useAuthStore((s) => s.user);
  const [rates, setRates] = useState([]);
  const [region, setRegion] = useState('USD');
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const country = user?.country || '';
        const { data } = await apiClient.get('/fx', {
          params: country ? { country } : undefined,
        });
        const list = data?.rates || [];
        setRates(list);
        if (data?.suggested_currency) setRegion(data.suggested_currency);
        else if (list.find((r) => r.currency === 'USD')) setRegion('USD');
        const u = list.find((r) => r.updated_at)?.updated_at;
        if (u) setUpdated(String(u).slice(0, 10));
      } catch {
        setRates([
          { currency: 'USD', rate_per_usd: 1, symbol: '$' },
          { currency: 'GHS', rate_per_usd: 15.5, symbol: 'GH₵' },
        ]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.country]);

  const selected = rates.find((r) => r.currency === region) || rates[0];
  // Flat 10 coins/episode; illustrative local value of one unlock from a ~$0.99/100-coin pack
  const localPerCoin = selected
    ? ((0.99 * (selected.rate_per_usd || 1)) / 100)
    : 0;

  return (
    <EpisioScreenShell title="About Coins & Pricing">
      <View style={styles.rateCard}>
        <Text style={styles.rateTitle}>Your local pricing (USD base)</Text>
        {loading ? (
          <ActivityIndicator color={COLORS.gold} />
        ) : (
          <>
            <View style={styles.rateRow}>
              <Text style={styles.rateK}>Display currency</Text>
              <Text style={styles.rateV}>
                {selected?.symbol || ''} {selected?.currency || region}
              </Text>
            </View>
            <View style={styles.rateRow}>
              <Text style={styles.rateK}>FX vs USD</Text>
              <Text style={styles.rateV}>
                1 USD = {selected?.rate_per_usd} {selected?.currency}
              </Text>
            </View>
            <View style={[styles.rateRow, styles.rateRowLast]}>
              <Text style={styles.rateK}>~1 coin</Text>
              <Text style={styles.rateV}>
                {selected?.symbol}
                {localPerCoin.toFixed(3)} (illustrative)
              </Text>
            </View>
            {updated ? (
              <Text style={styles.updated}>Rates updated {updated}</Text>
            ) : null}
          </>
        )}
      </View>

      <Text style={styles.sectionTitle}>How pricing works</Text>

      {INFO_BLOCKS.map((block) => (
        <View key={block.title} style={styles.infoBlock}>
          <Text style={styles.infoTitle}>{block.title}</Text>
          <Text style={styles.infoBody}>{block.body}</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Currencies</Text>
      <View style={styles.regionList}>
        {rates.map((r) => {
          const on = r.currency === region;
          return (
            <TouchableOpacity
              key={r.currency}
              style={[styles.regionChip, on && styles.regionChipOn]}
              onPress={() => setRegion(r.currency)}
              activeOpacity={0.85}
            >
              <Text style={[styles.regionChipText, on && styles.regionChipTextOn]}>
                {r.symbol} {r.currency}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  rateCard: {
    backgroundColor: COLORS.navyCard,
    borderRadius: 18,
    padding: 16,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
  },
  rateTitle: {
    fontFamily: FONTS.bold, color: COLORS.gold, fontSize: 13, marginBottom: 12,
  },
  rateRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10,
  },
  rateRowLast: { marginBottom: 0 },
  rateK: { fontFamily: FONTS.regular, color: COLORS.textFaint, fontSize: 12.5 },
  rateV: { fontFamily: FONTS.semi, color: '#fff', fontSize: 12.5 },
  updated: {
    marginTop: 10, fontSize: 11, color: COLORS.textFaint, fontFamily: FONTS.regular,
  },
  sectionTitle: {
    fontFamily: FONTS.bold, color: '#fff', fontSize: 14, marginBottom: 12, marginTop: 4,
  },
  infoBlock: { marginBottom: 16 },
  infoTitle: { fontFamily: FONTS.semi, color: COLORS.gold, fontSize: 13, marginBottom: 4 },
  infoBody: {
    fontFamily: FONTS.regular, color: '#C9C9DE', fontSize: 12.5, lineHeight: 18,
  },
  regionList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  regionChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  regionChipOn: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  regionChipText: { fontFamily: FONTS.semi, color: '#fff', fontSize: 12 },
  regionChipTextOn: { color: COLORS.navy },
});

export default CurrencyNoteScreen;
