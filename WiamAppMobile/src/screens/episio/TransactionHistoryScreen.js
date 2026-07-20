/**
 * Layout: WiamEpisio-Transaction-History.html
 * Data: GET /coins/balance + GET /coins/history
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ChevronLeft, ArrowDown, Lock, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../constants/theme';
import coinsApi from '../../api/coins';
import useAuthStore from '../../store/useAuthStore';

const FILTERS = ['All', 'Purchases', 'Unlocks', 'Bonuses'];
const GREEN = '#3BB273';
const RED = '#E4573D';

function classify(item) {
  const raw = `${item.type || ''} ${item.reason || ''} ${item.description || ''} ${item.status || ''}`.toLowerCase();
  if (/fail|declin|cancel/.test(raw) || item.status === 'failed') return 'Failed';
  if (/purchase|buy|top.?up|paystack|package|deposit/.test(raw)) return 'Purchases';
  if (/unlock|episode|chapter|spend/.test(raw)) return 'Unlocks';
  if (/bonus|reward|daily|gift|stipend|welcome|promo/.test(raw)) return 'Bonuses';
  const amt = Number(item.amount ?? item.coins ?? item.delta ?? 0);
  if (amt > 0) return 'Bonuses';
  if (amt < 0) return 'Unlocks';
  return 'All';
}

function dayBucket(iso) {
  if (!iso) return 'Earlier';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Earlier';
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  const startWeek = new Date(startToday);
  startWeek.setDate(startWeek.getDate() - 6);
  if (d >= startToday) return 'Today';
  if (d >= startYesterday) return 'Yesterday';
  if (d >= startWeek) return 'This week';
  return 'Earlier';
}

function formatTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString(undefined, { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' });
  } catch {
    return String(iso);
  }
}

const TransactionHistoryScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [items, setItems] = useState([]);
  const [balance, setBalance] = useState(0);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (soft = false) => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    if (!soft) setLoading(true);
    try {
      const [hist, bal] = await Promise.all([
        coinsApi.getTransactions(),
        coinsApi.getBalance().catch(() => ({ balance: 0 })),
      ]);
      setItems(hist?.transactions || hist?.items || hist?.history || (Array.isArray(hist) ? hist : []));
      setBalance(bal?.balance ?? bal?.coins ?? 0);
      setError(null);
    } catch {
      setError('Could not load history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    if (filter === 'All') return items;
    return items.filter((item) => classify(item) === filter);
  }, [items, filter]);

  const sections = useMemo(() => {
    const order = ['Today', 'Yesterday', 'This week', 'Earlier'];
    const map = {};
    filtered.forEach((item) => {
      const key = dayBucket(item.created_at || item.date || item.timestamp);
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    const rows = [];
    order.forEach((label) => {
      const list = map[label];
      if (!list?.length) return;
      rows.push({ kind: 'label', id: `lbl-${label}`, label });
      list.forEach((item, i) => rows.push({ kind: 'txn', id: String(item.id || `${label}-${i}`), item }));
    });
    return rows;
  }, [filtered]);

  if (!isAuthenticated) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.empty}>Sign in to view coin history.</Text>
        <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.ctaText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.top}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <ChevronLeft size={15} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Transaction History</Text>
      </View>

      <LinearGradient
        colors={[COLORS.gold, COLORS.goldDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.balanceCard}
      >
        <View>
          <Text style={styles.balanceAmt}>{balance} coins</Text>
          <Text style={styles.balanceLabel}>Current balance</Text>
        </View>
        <TouchableOpacity style={styles.topupBtn} onPress={() => navigation.navigate('BuyCoins')}>
          <Text style={styles.topupText}>+ Top Up</Text>
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={sections}
          keyExtractor={(row) => row.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={COLORS.gold} />
          }
          ListEmptyComponent={<Text style={styles.empty}>No transactions in this filter.</Text>}
          renderItem={({ item: row }) => {
            if (row.kind === 'label') {
              return <Text style={styles.dayLabel}>{row.label}</Text>;
            }
            const item = row.item;
            const amt = Number(item.amount ?? item.coins ?? item.delta ?? 0);
            const kind = classify(item);
            const failed = kind === 'Failed';
            const positive = !failed && amt >= 0;
            const Icon = failed ? X : (positive ? ArrowDown : Lock);
            const iconStyle = failed ? styles.iconFail : (positive ? styles.iconIn : styles.iconOut);
            const iconColor = failed ? RED : (positive ? GREEN : COLORS.gold);
            const money = item.money_label || item.fiat_label || item.amount_ghs
              || (item.ghs != null ? `₵${item.ghs}` : null);
            return (
              <View style={styles.row}>
                <View style={[styles.txnIcon, iconStyle]}>
                  <Icon size={17} color={iconColor} />
                </View>
                <View style={styles.txnBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.type || item.reason || item.description || 'Coin movement'}
                  </Text>
                  <Text style={styles.rowSub}>
                    {[item.method, formatTime(item.created_at || item.date)].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <View style={styles.txnAmt}>
                  <Text style={[
                    styles.amt,
                    failed && { color: RED },
                    !failed && positive && { color: GREEN },
                    !failed && !positive && { color: '#E7E7F2' },
                  ]}
                  >
                    {failed ? 'Failed' : `${positive ? '+' : ''}${amt}`}
                  </Text>
                  <Text style={styles.amtSub}>{money || 'coins'}</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, marginBottom: 14 },
  back: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontFamily: FONTS.extraBold, color: '#fff' },
  balanceCard: {
    marginHorizontal: 20, marginBottom: 16, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  balanceAmt: { fontSize: 24, fontFamily: FONTS.extraBold, color: COLORS.navy },
  balanceLabel: { marginTop: 2, fontSize: 10.5, fontFamily: FONTS.bold, color: 'rgba(8,8,26,0.7)' },
  topupBtn: {
    backgroundColor: COLORS.navy, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10,
  },
  topupText: { fontFamily: FONTS.extraBold, color: COLORS.gold, fontSize: 11.5 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 14, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  filterChipActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  filterText: { fontSize: 11.5, fontFamily: FONTS.semi, color: '#B8B8CC' },
  filterTextActive: { color: COLORS.navy },
  dayLabel: {
    fontSize: 11, fontFamily: FONTS.extraBold, color: COLORS.textFaint,
    letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 14, marginBottom: 8,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: COLORS.navyLine,
  },
  txnIcon: {
    width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
  },
  iconIn: { backgroundColor: 'rgba(59,178,115,0.14)' },
  iconOut: { backgroundColor: 'rgba(212,160,23,0.14)' },
  iconFail: { backgroundColor: 'rgba(228,87,61,0.14)' },
  txnBody: { flex: 1, minWidth: 0 },
  rowTitle: { color: '#fff', fontFamily: FONTS.bold, fontSize: 12.5, marginBottom: 2 },
  rowSub: { color: COLORS.textFaint, fontSize: 10.5, fontFamily: FONTS.regular },
  txnAmt: { alignItems: 'flex-end' },
  amt: { fontFamily: FONTS.extraBold, fontSize: 12.5 },
  amtSub: { fontSize: 9.5, color: COLORS.textFaint, fontFamily: FONTS.regular, marginTop: 2 },
  empty: { textAlign: 'center', color: COLORS.textFaint, marginTop: 40, fontFamily: FONTS.medium },
  error: { color: COLORS.error, paddingHorizontal: 20, fontFamily: FONTS.medium },
  cta: { marginTop: 16, backgroundColor: COLORS.gold, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  ctaText: { fontFamily: FONTS.bold, color: COLORS.navy },
});

export default TransactionHistoryScreen;
