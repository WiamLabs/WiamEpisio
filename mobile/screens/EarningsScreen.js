// © 2026 WiamApp. Powered by WiamLabs
// screens/EarningsScreen.js — Part 13 Worker Earnings

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, goldGradient } from '../constants/colors';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

const PAD = Colors.screenPad;

function relativeDate(dateStr) {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' });
}

export default function EarningsScreen({ navigation }) {
  const { profile } = useAuth();
  const [earnings, setEarnings] = useState({
    balance: 0,
    monthTotal: 0,
    pending: 0,
    totalEarned: 0,
    jobs: 0,
  });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!profile?.id) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, description, agreed_price, currency, status, scheduled_date, created_at, users!bookings_customer_id_fkey(full_name), categories(name)')
        .eq('worker_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const all = data || [];
      const completed = all.filter((b) => b.status === 'completed');
      const pending = all.filter((b) => ['accepted', 'in_progress'].includes(b.status));

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthCompleted = completed.filter((b) => new Date(b.created_at) >= monthStart);

      const totalEarned = completed.reduce((s, b) => s + parseFloat(b.agreed_price || 0), 0);
      const pendingEarned = pending.reduce((s, b) => s + parseFloat(b.agreed_price || 0), 0);
      const monthTotal = monthCompleted.reduce((s, b) => s + parseFloat(b.agreed_price || 0), 0);

      setEarnings({
        balance: totalEarned,
        monthTotal,
        pending: pendingEarned,
        totalEarned,
        jobs: completed.length,
      });
      setHistory(all.slice(0, 30));
    } catch (e) {
      console.warn('Earnings load error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [profile?.id]));

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />
        <ActivityIndicator color={Colors.gold} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={17} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.title}>Earnings</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={Colors.gold}
          />
        }
      >
        <LinearGradient
          colors={goldGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <View style={styles.balanceGlow} />
          <Text style={styles.balanceLabel}>Available balance</Text>
          <Text style={styles.balanceAmount}>GHS {earnings.balance.toFixed(2)}</Text>
          <TouchableOpacity style={styles.withdrawBtn} activeOpacity={0.9}>
            <Text style={styles.withdrawText}>Withdraw to Mobile Money</Text>
          </TouchableOpacity>
        </LinearGradient>

        <View style={styles.miniStats}>
          <View style={styles.miniStat}>
            <Text style={styles.miniStatLabel}>This month</Text>
            <Text style={[styles.miniStatValue, styles.miniStatGreen]}>
              GHS {Math.round(earnings.monthTotal)}
            </Text>
          </View>
          <View style={styles.miniStat}>
            <Text style={styles.miniStatLabel}>Pending</Text>
            <Text style={styles.miniStatValue}>GHS {Math.round(earnings.pending)}</Text>
          </View>
          <View style={styles.miniStat}>
            <Text style={styles.miniStatLabel}>Total earned</Text>
            <Text style={styles.miniStatValue}>GHS {Math.round(earnings.totalEarned)}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Recent Transactions</Text>

        {history.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Ionicons name="receipt-outline" size={40} color={Colors.textFaint} />
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        ) : (
          history.map((item) => {
            const isEarning = item.status === 'completed';
            const isPending = ['accepted', 'in_progress'].includes(item.status);
            const categoryName = item.categories?.name || 'Service';
            const customerName = item.users?.full_name || 'Customer';

            return (
              <View key={item.id} style={styles.txnRow}>
                <View style={[
                  styles.txnIcon,
                  !isEarning && isPending && styles.txnIconPending,
                  !isEarning && !isPending && styles.txnIconMuted,
                ]}>
                  <Ionicons
                    name={isEarning ? 'arrow-up' : isPending ? 'time-outline' : 'close-circle-outline'}
                    size={16}
                    color={isEarning ? Colors.success : isPending ? Colors.gold : Colors.textFaint}
                  />
                </View>
                <View style={styles.txnInfo}>
                  <Text style={styles.txnTitle}>
                    {isEarning ? `Payment from ${customerName}` : item.description || 'Booking'}
                  </Text>
                  <Text style={styles.txnSub} numberOfLines={1}>
                    {categoryName} · {relativeDate(item.scheduled_date || item.created_at)}
                  </Text>
                </View>
                <Text style={[
                  styles.txnAmount,
                  isEarning && styles.txnAmountIn,
                  !isEarning && !isPending && styles.txnAmountOut,
                ]}>
                  {isEarning ? '+' : ''}GHS {parseFloat(item.agreed_price || 0).toFixed(0)}
                </Text>
              </View>
            );
          })
        )}

        <Text style={styles.footer}>© 2026 WiamApp · Powered by WiamLabs</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.navy },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: PAD,
    paddingBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.navyCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '700', color: Colors.white },
  scroll: { paddingHorizontal: PAD, paddingBottom: 24 },
  balanceCard: {
    borderRadius: Colors.cardRadius,
    padding: 22,
    marginBottom: 16,
    alignItems: 'center',
    overflow: 'hidden',
  },
  balanceGlow: {
    position: 'absolute',
    right: -30,
    top: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.navy,
    opacity: 0.14,
  },
  balanceLabel: { fontSize: 12, color: '#3A2E05', marginBottom: 4 },
  balanceAmount: { fontSize: 32, fontWeight: '800', color: Colors.navy, marginBottom: 16 },
  withdrawBtn: {
    backgroundColor: Colors.navy,
    paddingVertical: 11,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  withdrawText: { fontSize: 13, fontWeight: '700', color: Colors.gold },
  miniStats: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  miniStat: {
    flex: 1,
    backgroundColor: Colors.navyCard,
    borderWidth: 1,
    borderColor: Colors.navyLine,
    borderRadius: 16,
    padding: 13,
  },
  miniStatLabel: { fontSize: 10.5, color: Colors.textFaint, marginBottom: 4 },
  miniStatValue: { fontSize: 16, fontWeight: '700', color: Colors.white },
  miniStatGreen: { color: Colors.success },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: Colors.white, marginBottom: 12 },
  emptyHistory: { alignItems: 'center', paddingVertical: 30, gap: 10 },
  emptyText: { color: Colors.textFaint, fontSize: 14 },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyLine,
  },
  txnIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(34,197,94,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnIconPending: { backgroundColor: 'rgba(212,160,23,0.12)' },
  txnIconMuted: { backgroundColor: 'rgba(255,255,255,0.05)' },
  txnInfo: { flex: 1, minWidth: 0 },
  txnTitle: { fontSize: 13, fontWeight: '600', color: Colors.white },
  txnSub: { fontSize: 11, color: Colors.textFaint, marginTop: 2 },
  txnAmount: { fontSize: 13.5, fontWeight: '700', flexShrink: 0 },
  txnAmountIn: { color: Colors.success },
  txnAmountOut: { color: '#B8B8CC' },
  footer: { textAlign: 'center', fontSize: 10, color: '#3A3A56', paddingVertical: 18 },
});
