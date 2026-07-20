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
import { ChevronLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../constants/theme';
import coinsApi from '../../api/coins';
import useAuthStore from '../../store/useAuthStore';

const FILTERS = ['All', 'Purchases', 'Unlocks', 'Bonuses'];

function classify(item) {
  const raw = `${item.type || ''} ${item.reason || ''} ${item.description || ''}`.toLowerCase();
  if (/purchase|buy|top.?up|paystack|package|deposit/.test(raw)) return 'Purchases';
  if (/unlock|episode|chapter|spend/.test(raw)) return 'Unlocks';
  if (/bonus|reward|daily|gift|stipend|welcome|promo/.test(raw)) return 'Bonuses';
  const amt = Number(item.amount ?? item.coins ?? item.delta ?? 0);
  if (amt > 0) return 'Bonuses';
  if (amt < 0) return 'Unlocks';
  return 'All';
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
          <ChevronLeft size={20} color={COLORS.text} />
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
          data={filtered}
          keyExtractor={(item, i) => String(item.id || i)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={COLORS.gold} />
          }
          ListEmptyComponent={<Text style={styles.empty}>No transactions in this filter.</Text>}
          renderItem={({ item }) => {
            const amt = item.amount ?? item.coins ?? item.delta ?? 0;
            const positive = Number(amt) >= 0;
            return (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{item.type || item.reason || item.description || 'Coin movement'}</Text>
                  <Text style={styles.rowSub}>{item.created_at || item.date || ''}</Text>
                </View>
                <Text style={[styles.amt, { color: positive ? COLORS.success : COLORS.error }]}>
                  {positive ? '+' : ''}{amt}
                </Text>
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
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  back: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.text },
  balanceCard: {
    marginHorizontal: 20, marginBottom: 16, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  balanceAmt: { fontSize: 24, fontFamily: FONTS.extraBold, color: COLORS.navy },
  balanceLabel: { marginTop: 2, fontSize: 10.5, fontFamily: FONTS.bold, color: 'rgba(8,8,26,0.7)' },
  topupBtn: {
    backgroundColor: 'rgba(8,8,26,0.12)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
  },
  topupText: { fontFamily: FONTS.bold, color: COLORS.navy, fontSize: 12.5 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 14, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  filterChipActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  filterText: { fontSize: 11.5, fontFamily: FONTS.semi, color: '#B8B8CC' },
  filterTextActive: { color: COLORS.navy },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navyCard,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.navyLine, padding: 14, marginBottom: 10,
  },
  rowTitle: { color: COLORS.text, fontFamily: FONTS.semi, fontSize: 13.5 },
  rowSub: { marginTop: 4, color: COLORS.textFaint, fontSize: 11, fontFamily: FONTS.regular },
  amt: { fontFamily: FONTS.bold, fontSize: 15 },
  empty: { textAlign: 'center', color: COLORS.textFaint, marginTop: 40, fontFamily: FONTS.medium },
  error: { color: COLORS.error, paddingHorizontal: 20, fontFamily: FONTS.medium },
  cta: { marginTop: 16, backgroundColor: COLORS.gold, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  ctaText: { fontFamily: FONTS.bold, color: COLORS.navy },
});

export default TransactionHistoryScreen;
