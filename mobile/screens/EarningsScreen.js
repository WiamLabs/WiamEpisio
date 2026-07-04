// © 2026 WiamApp. Powered by WiamLabs
// screens/EarningsScreen.js — PRODUCTION real Supabase data

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../constants/colors';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

const NAVY  = Colors.navyDeep;
const NAVY2 = Colors.navyMid;
const GOLD  = Colors.gold;
const WHITE = Colors.white;
const MUTED = 'rgba(255,255,255,0.45)';
const BORDER= 'rgba(255,255,255,0.09)';

const PERIODS = ['This Week', 'This Month', 'All Time'];

export default function EarningsScreen({ navigation }) {
  const { profile } = useAuth();
  const [period,     setPeriod]     = useState('This Month');
  const [earnings,   setEarnings]   = useState({ total: 0, pending: 0, jobs: 0, avgPerJob: 0 });
  const [history,    setHistory]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!profile?.id) { setLoading(false); return; }
    try {
      // Date range
      const now  = new Date();
      let since  = new Date(0);
      if (period === 'This Week') {
        since = new Date(now);
        since.setDate(now.getDate() - now.getDay());
        since.setHours(0, 0, 0, 0);
      } else if (period === 'This Month') {
        since = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      const { data, error } = await supabase
        .from('bookings')
        .select('id, description, agreed_price, currency, status, scheduled_date, created_at, users!bookings_customer_id_fkey(full_name), categories(name)')
        .eq('worker_id', profile.id)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const all       = data || [];
      const completed = all.filter(b => b.status === 'completed');
      const pending   = all.filter(b => ['accepted', 'in_progress'].includes(b.status));

      const totalEarned  = completed.reduce((s, b) => s + parseFloat(b.agreed_price || 0), 0);
      const pendingEarned= pending.reduce(  (s, b) => s + parseFloat(b.agreed_price || 0), 0);
      const avgPerJob    = completed.length ? totalEarned / completed.length : 0;

      setEarnings({ total: totalEarned, pending: pendingEarned, jobs: completed.length, avgPerJob });
      setHistory(all);
    } catch (e) {
      console.warn('Earnings load error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [profile?.id, period]));

  const STATUS_COLOR = {
    completed:   Colors.success,
    in_progress: GOLD,
    accepted:    '#3B82F6',
    cancelled:   Colors.error,
    rejected:    Colors.error,
    pending:     Colors.warning,
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={GOLD} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={WHITE} />
        </TouchableOpacity>
        <Text style={styles.title}>My Earnings</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={GOLD} />}
      >
        {/* Period tabs */}
        <View style={styles.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.periodTab, period === p && styles.periodTabActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Big total */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total Earned ({period})</Text>
          <Text style={styles.totalAmount}>GHS {earnings.total.toFixed(2)}</Text>
          <View style={styles.pendingRow}>
            <Ionicons name="time-outline" size={14} color={GOLD} />
            <Text style={styles.pendingText}>GHS {earnings.pending.toFixed(2)} pending release</Text>
          </View>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="briefcase-outline" size={22} color={GOLD} />
            <Text style={styles.statVal}>{earnings.jobs}</Text>
            <Text style={styles.statLabel}>Jobs Completed</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="trending-up-outline" size={22} color={Colors.success} />
            <Text style={[styles.statVal, { color: Colors.success }]}>GHS {earnings.avgPerJob.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Avg Per Job</Text>
          </View>
        </View>

        {/* Payout info */}
        <View style={styles.payoutCard}>
          <View style={styles.payoutLeft}>
            <Ionicons name="wallet-outline" size={20} color={GOLD} />
            <View>
              <Text style={styles.payoutTitle}>Payout Method</Text>
              <Text style={styles.payoutSub}>Mobile Money · MTN / Vodafone</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.payoutBtn}>
            <Text style={styles.payoutBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Transaction history */}
        <Text style={styles.sectionTitle}>Transaction History</Text>
        {history.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Ionicons name="receipt-outline" size={40} color={MUTED} />
            <Text style={styles.emptyText}>No transactions for this period</Text>
          </View>
        ) : (
          history.map(item => {
            const isEarning = item.status === 'completed';
            const isPending = ['accepted', 'in_progress'].includes(item.status);
            return (
              <View key={item.id} style={styles.txRow}>
                <View style={[styles.txIcon, { backgroundColor: isEarning ? 'rgba(34,197,94,0.12)' : isPending ? 'rgba(212,160,23,0.1)' : 'rgba(255,255,255,0.05)' }]}>
                  <Ionicons
                    name={isEarning ? 'checkmark-circle-outline' : isPending ? 'time-outline' : 'close-circle-outline'}
                    size={18}
                    color={isEarning ? Colors.success : isPending ? GOLD : Colors.error}
                  />
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txCustomer}>{item.users?.full_name || 'Customer'}</Text>
                  <Text style={styles.txService} numberOfLines={1}>{item.description}</Text>
                  <Text style={styles.txDate}>{new Date(item.scheduled_date).toLocaleDateString('en-GH', { day:'numeric', month:'short' })}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.txAmount, { color: isEarning ? Colors.success : isPending ? GOLD : MUTED }]}>
                    {isEarning ? '+' : ''}GHS {parseFloat(item.agreed_price).toFixed(0)}
                  </Text>
                  <Text style={[styles.txStatus, { color: STATUS_COLOR[item.status] || MUTED }]}>
                    {item.status.replace('_', ' ')}
                  </Text>
                </View>
              </View>
            );
          })
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: NAVY },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, gap: 12 },
  backBtn:      { padding: 4 },
  title:        { fontSize: 20, fontWeight: '700', color: WHITE },
  periodRow:    { flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4, gap: 4 },
  periodTab:    { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 9 },
  periodTabActive:{ backgroundColor: GOLD },
  periodText:   { fontSize: 13, color: MUTED },
  periodTextActive:{ color: NAVY, fontWeight: '700' },
  totalCard:    { backgroundColor: NAVY2, marginHorizontal: 20, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 14, borderWidth: 1, borderColor: 'rgba(212,160,23,0.2)' },
  totalLabel:   { fontSize: 13, color: MUTED, marginBottom: 8 },
  totalAmount:  { fontSize: 38, fontWeight: '800', color: GOLD, marginBottom: 10 },
  pendingRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pendingText:  { fontSize: 13, color: MUTED },
  statsGrid:    { flexDirection: 'row', marginHorizontal: 20, gap: 12, marginBottom: 14 },
  statCard:     { flex: 1, backgroundColor: NAVY2, borderRadius: 14, padding: 16, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: BORDER },
  statVal:      { fontSize: 22, fontWeight: '800', color: WHITE },
  statLabel:    { fontSize: 12, color: MUTED, textAlign: 'center' },
  payoutCard:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: NAVY2, marginHorizontal: 20, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: BORDER },
  payoutLeft:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  payoutTitle:  { fontSize: 14, fontWeight: '700', color: WHITE },
  payoutSub:    { fontSize: 12, color: MUTED, marginTop: 2 },
  payoutBtn:    { borderWidth: 1, borderColor: GOLD, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  payoutBtnText:{ fontSize: 13, color: GOLD, fontWeight: '600' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: WHITE, paddingHorizontal: 20, marginBottom: 10 },
  emptyHistory: { alignItems: 'center', paddingVertical: 30, gap: 10 },
  emptyText:    { color: MUTED, fontSize: 14 },
  txRow:        { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER },
  txIcon:       { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  txInfo:       { flex: 1 },
  txCustomer:   { fontSize: 14, fontWeight: '600', color: WHITE },
  txService:    { fontSize: 12, color: MUTED, marginTop: 2 },
  txDate:       { fontSize: 11, color: MUTED, marginTop: 3 },
  txAmount:     { fontSize: 15, fontWeight: '700' },
  txStatus:     { fontSize: 11, marginTop: 3, textTransform: 'capitalize' },
});
