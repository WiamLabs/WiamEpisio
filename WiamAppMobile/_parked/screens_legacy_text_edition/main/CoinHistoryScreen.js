/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import coinsApi from '../../api/coins';
import { ChevronLeft, Coins, ArrowUpRight, ArrowDownRight } from 'lucide-react-native';
import SkeletonLoader from '../../components/common/SkeletonLoader';

const CoinHistoryScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [txns, setTxns] = useState([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const [balRes, txnRes] = await Promise.all([
        coinsApi.getBalance().catch(() => ({ balance: 0 })),
        coinsApi.getTransactions().catch(() => ({ transactions: [] })),
      ]);
      setBalance(balRes.balance || 0);
      setTxns(txnRes.transactions || []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  const onRefresh = () => { setRefreshing(true); fetch(); };

  const renderItem = ({ item }) => {
    const isCredit = item.type === 'purchase' || item.type === 'bonus' || item.type === 'refund';
    return (
      <View style={s.row}>
        <View style={[s.iconWrap, { backgroundColor: isCredit ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)' }]}>
          {isCredit ? <ArrowDownRight size={18} color="#4ade80" /> : <ArrowUpRight size={18} color="#f87171" />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.desc} numberOfLines={1}>{item.description || item.type}</Text>
          <Text style={s.time}>{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</Text>
        </View>
        <Text style={[s.amount, { color: isCredit ? '#4ade80' : '#f87171' }]}>
          {isCredit ? '+' : '-'}{Math.abs(item.amount)}
        </Text>
      </View>
    );
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Coin History</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={s.balCard}>
        <Coins size={28} color={COLORS.secondary} />
        <Text style={s.balLabel}>Current Balance</Text>
        <Text style={s.balValue}>{balance.toLocaleString()}</Text>
        <Text style={s.balSub}>coins</Text>
      </View>
      {loading ? (
        <View style={{ marginTop: 16 }}><SkeletonLoader.ListItem count={5} /></View>
      ) : (
        <FlatList
          data={txns}
          keyExtractor={(i) => String(i.id)}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.secondary} />}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Coins size={40} color={COLORS.textMuted} />
              <Text style={s.emptyText}>No transactions yet</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  balCard: { alignItems: 'center', paddingVertical: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  balLabel: { fontSize: 12, color: COLORS.textMuted, marginTop: 8 },
  balValue: { fontSize: 36, fontWeight: '800', color: COLORS.secondary, marginTop: 4 },
  balSub: { fontSize: 12, color: COLORS.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  desc: { fontSize: 13, color: COLORS.text },
  time: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 14, color: COLORS.textMuted },
});

export default CoinHistoryScreen;
