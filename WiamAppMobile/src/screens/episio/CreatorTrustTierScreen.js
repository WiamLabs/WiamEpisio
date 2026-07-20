/**
 * Layout: WiamStudio-Creator-Trust-Tier.html
 * API: GET /creator/studio/trust-tier
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ChevronLeft, Star } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';

const CreatorTrustTierScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    studioEpisioApi.trustTier()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []));

  const tier = data?.tier || 'new';
  const live = data?.live_seasons || 0;
  const need = data?.progress_to_next?.need ?? 1;
  const progress = tier === 'elite' ? 1 : tier === 'trusted' ? (live / 6) : tier === 'rising' ? (live / 3) : (live / 1);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={15} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.h1}>Creator Trust Tier</Text>
      </View>

      {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          <View style={styles.hero}>
            <View style={styles.badge}><Star size={28} color={COLORS.gold} fill={COLORS.gold} /></View>
            <Text style={styles.tierName}>
              {{ new: 'New Creator', rising: 'Rising Creator', trusted: 'Trusted Creator', elite: 'Elite Creator' }[tier]}
            </Text>
            <Text style={styles.tierSub}>
              {live} series delivered complete.
              {need > 0 ? ` ${need} more to level up.` : ' Sustained excellence.'}
            </Text>
          </View>

          <View style={styles.progressCard}>
            <View style={styles.progressHead}>
              <Text style={styles.progressLabel}>Progress</Text>
              <Text style={styles.progressVal}>{live} seasons · ~{data?.sla_hours || 72}h review SLA</Text>
            </View>
            <View style={styles.bar}>
              <View style={[styles.fill, { width: `${Math.min(100, Math.round(progress * 100))}%` }]} />
            </View>
            <Text style={styles.progressNote}>{data?.progress_to_next?.label || 'Keep delivering complete seasons'}</Text>
          </View>

          <Text style={styles.section}>Trust Tiers</Text>
          {(data?.tiers || []).map((t) => {
            const current = t.id === tier;
            return (
              <View key={t.id} style={[styles.tierRow, current && styles.tierCurrent]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tierRowTitle}>
                    {t.name}
                    {current ? <Text style={styles.youTag}>  YOU ARE HERE</Text> : null}
                  </Text>
                  <Text style={styles.tierRowSub}>{t.sub}</Text>
                </View>
              </View>
            );
          })}

          <View style={styles.benefit}>
            <Text style={styles.benefitTitle}>What Trusted unlocks</Text>
            <Text style={styles.benefitItem}>Review time drops toward under 24 hours</Text>
            <Text style={styles.benefitItem}>System QC auto-clears more; humans only on edge cases</Text>
            <Text style={styles.benefitItem}>Featured placement consideration for launches</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  h1: { fontSize: 16, fontFamily: FONTS.extraBold, color: '#fff' },
  hero: { alignItems: 'center', paddingVertical: 18, marginBottom: 8 },
  badge: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(212,160,23,0.14)',
    borderWidth: 1.5, borderColor: 'rgba(212,160,23,0.4)', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  tierName: { fontSize: 18, fontFamily: FONTS.extraBold, color: '#fff' },
  tierSub: { marginTop: 8, fontSize: 12, color: COLORS.textDim, textAlign: 'center', lineHeight: 18, fontFamily: FONTS.regular },
  progressCard: {
    backgroundColor: COLORS.navyCard, borderRadius: 16, borderWidth: 1, borderColor: COLORS.navyLine,
    padding: 16, marginBottom: 20,
  },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressLabel: { fontSize: 12, color: COLORS.textDim, fontFamily: FONTS.semi },
  progressVal: { fontSize: 12, color: '#fff', fontFamily: FONTS.bold },
  bar: { height: 8, borderRadius: 4, backgroundColor: COLORS.navySoft, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: COLORS.gold },
  progressNote: { marginTop: 10, fontSize: 11.5, color: COLORS.textDim, fontFamily: FONTS.regular },
  section: {
    fontSize: 12, fontFamily: FONTS.extraBold, color: COLORS.textDim,
    letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 10,
  },
  tierRow: {
    flexDirection: 'row', padding: 14, borderRadius: 14, backgroundColor: COLORS.navyCard,
    borderWidth: 1, borderColor: COLORS.navyLine, marginBottom: 10,
  },
  tierCurrent: { borderColor: COLORS.gold, backgroundColor: 'rgba(212,160,23,0.08)' },
  tierRowTitle: { fontSize: 13.5, fontFamily: FONTS.bold, color: '#fff' },
  youTag: { fontSize: 10, color: COLORS.gold, fontFamily: FONTS.extraBold },
  tierRowSub: { marginTop: 4, fontSize: 11.5, color: COLORS.textDim, fontFamily: FONTS.regular },
  benefit: {
    marginTop: 12, backgroundColor: 'rgba(212,160,23,0.12)', borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.28)', borderRadius: 16, padding: 16,
  },
  benefitTitle: { fontSize: 12.5, fontFamily: FONTS.extraBold, color: '#fff', marginBottom: 10 },
  benefitItem: { fontSize: 11.5, color: '#D9C89A', lineHeight: 18, marginBottom: 8, fontFamily: FONTS.regular },
});

export default CreatorTrustTierScreen;
