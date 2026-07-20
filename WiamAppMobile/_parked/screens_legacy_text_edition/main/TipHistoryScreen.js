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
import { COLORS } from '../../constants/theme';
import walletApi from '../../api/wallet';
import { ChevronLeft, Heart, ArrowUpRight, ArrowDownRight } from 'lucide-react-native';
import SkeletonLoader from '../../components/common/SkeletonLoader';

const TipHistoryScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const res = await walletApi.getHistory();
      const all = res.transactions || res.history || [];
      setTips(all.filter(t => t.type === 'tip_sent' || t.type === 'tip_received' || t.description?.toLowerCase().includes('tip')));
    } catch { setTips([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  const onRefresh = () => { setRefreshing(true); fetch(); };

  const renderItem = ({ item }) => {
    const isSent = item.type === 'tip_sent' || item.amount < 0;
    return (
      <View style={s.row}>
        <View style={[s.iconWrap, { backgroundColor: isSent ? 'rgba(236,72,153,0.15)' : 'rgba(74,222,128,0.15)' }]}>
          {isSent ? <ArrowUpRight size={18} color="#ec4899" /> : <ArrowDownRight size={18} color="#4ade80" />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.desc} numberOfLines={1}>{item.description || (isSent ? 'Tip Sent' : 'Tip Received')}</Text>
          <Text style={s.time}>{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</Text>
        </View>
        <Text style={[s.amount, { color: isSent ? '#ec4899' : '#4ade80' }]}>
          {isSent ? '-' : '+'}{Math.abs(item.amount)} coins
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
        <Text style={s.headerTitle}>Tip History</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? (
        <View style={{ marginTop: 16 }}><SkeletonLoader.ListItem count={4} /></View>
      ) : (
        <FlatList
          data={tips}
          keyExtractor={(i) => String(i.id)}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.secondary} />}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Heart size={40} color={COLORS.textMuted} />
              <Text style={s.emptyText}>No tips yet</Text>
              <Text style={s.emptySub}>Tips you send or receive will appear here</Text>
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
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  desc: { fontSize: 13, color: COLORS.text },
  time: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  amount: { fontSize: 14, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  emptySub: { fontSize: 13, color: COLORS.textMuted },
});

export default TipHistoryScreen;
