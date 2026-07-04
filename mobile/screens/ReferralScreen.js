// © 2026 WiamApp. Powered by WiamLabs
// screens/ReferralScreen.js
// Referral system — share code, track rewards
// Backend: GET /api/referrals/me, POST /api/referrals/apply

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView,
  ActivityIndicator, Share, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { getMyReferrals } from '../lib/api/referrals';

const NAVY    = '#0D0D2B';
const NAVY2   = '#12123A';
const GOLD    = '#D4A017';
const GOLD_BG = 'rgba(212,160,23,0.10)';
const GOLD_BD = 'rgba(212,160,23,0.25)';
const WHITE   = '#FFFFFF';
const MUTED   = 'rgba(255,255,255,0.45)';
const BORDER  = 'rgba(255,255,255,0.08)';
const GREEN   = '#22C55E';

const STATUS_LABEL = {
  pending:   { label: 'Waiting',   color: MUTED },
  qualified: { label: 'Qualified', color: GOLD },
  rewarded:  { label: 'Rewarded',  color: GREEN },
  expired:   { label: 'Expired',   color: '#EF4444' },
};

export default function ReferralScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [info, setInfo] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await getMyReferrals();
      setInfo(data);
    } catch (err) {
      Alert.alert('Could not load referrals', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const copyCode = async () => {
    if (!info?.referralCode) return;
    await Clipboard.setStringAsync(info.referralCode);
    Alert.alert('Copied', 'Your referral code has been copied.');
  };

  const shareCode = async () => {
    if (!info?.shareLink) return;
    try {
      await Share.share({
        message: `Join WiamApp with my code ${info.referralCode} and get started — trusted, verified workers in Ghana. ${info.shareLink}`,
      });
    } catch { }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.center}><ActivityIndicator color={GOLD} size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={WHITE} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invite &amp; Earn</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />}
      >
        <View style={styles.heroCard}>
          <Ionicons name="gift-outline" size={36} color={GOLD} />
          <Text style={styles.heroTitle}>Invite people you trust</Text>
          <Text style={styles.heroSub}>
            Share your code. When a worker you invite gets verified, you get 1 free month
            of Pro. When a customer you invite completes their first booking, you get a reward credit.
          </Text>
        </View>

        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Your referral code</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeText}>{info?.referralCode}</Text>
            <TouchableOpacity onPress={copyCode} style={styles.iconBtn}>
              <Ionicons name="copy-outline" size={20} color={GOLD} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.shareBtn} onPress={shareCode}>
            <Ionicons name="share-social-outline" size={18} color={NAVY} />
            <Text style={styles.shareBtnText}>Share your link</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{info?.totalReferred ?? 0}</Text>
            <Text style={styles.statLabel}>Invited</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: GREEN }]}>{info?.totalRewarded ?? 0}</Text>
            <Text style={styles.statLabel}>Rewarded</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Your invites</Text>
        {(!info?.referrals || info.referrals.length === 0) && (
          <Text style={styles.emptyText}>No invites yet — share your code to get started.</Text>
        )}
        {info?.referrals?.map((r) => {
          const s = STATUS_LABEL[r.status] || STATUS_LABEL.pending;
          return (
            <View key={r.id} style={styles.referralRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.referralName}>{r.users?.full_name || 'New member'}</Text>
                <Text style={styles.referralDate}>{new Date(r.created_at).toLocaleDateString()}</Text>
              </View>
              <Text style={[styles.referralStatus, { color: s.color }]}>{s.label}</Text>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: WHITE, fontSize: 17, fontWeight: '700' },
  heroCard: {
    backgroundColor: NAVY2, borderRadius: 16, borderWidth: 1, borderColor: GOLD_BD,
    padding: 20, alignItems: 'center', marginBottom: 16,
  },
  heroTitle: { color: WHITE, fontSize: 17, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  heroSub: { color: MUTED, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  codeCard: {
    backgroundColor: NAVY2, borderRadius: 16, borderWidth: 1, borderColor: BORDER,
    padding: 18, marginBottom: 16,
  },
  codeLabel: { color: MUTED, fontSize: 12, marginBottom: 8 },
  codeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: GOLD_BG, borderWidth: 1, borderColor: GOLD_BD, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 14,
  },
  codeText: { color: GOLD, fontSize: 22, fontWeight: '800', letterSpacing: 2 },
  iconBtn: { padding: 6 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: GOLD, borderRadius: 12, paddingVertical: 13,
  },
  shareBtnText: { color: NAVY, fontWeight: '700', fontSize: 14 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statBox: {
    flex: 1, backgroundColor: NAVY2, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', paddingVertical: 16,
  },
  statNum: { color: WHITE, fontSize: 24, fontWeight: '800' },
  statLabel: { color: MUTED, fontSize: 12, marginTop: 4 },
  sectionTitle: { color: WHITE, fontSize: 15, fontWeight: '700', marginBottom: 10 },
  emptyText: { color: MUTED, fontSize: 13, textAlign: 'center', marginTop: 20 },
  referralRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: NAVY2, borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
  },
  referralName: { color: WHITE, fontSize: 14, fontWeight: '600' },
  referralDate: { color: MUTED, fontSize: 11, marginTop: 2 },
  referralStatus: { fontSize: 12, fontWeight: '700' },
});
