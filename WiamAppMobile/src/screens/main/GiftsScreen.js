import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import apiClient from '../../api/client';
import { ChevronLeft, Gift } from 'lucide-react-native';
import SkeletonLoader from '../../components/common/SkeletonLoader';

const GiftsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const res = await apiClient.get('/gifts/received');
      setGifts(res.data.gifts || []);
    } catch { setGifts([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  const onRefresh = () => { setRefreshing(true); fetch(); };

  const renderItem = ({ item }) => (
    <View style={s.row}>
      <View style={s.iconWrap}>
        <Text style={{ fontSize: 24 }}>{item.sticker_emoji || '🎁'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.desc} numberOfLines={1}>{item.sender_name || 'Someone'} sent you a {item.sticker_name || 'gift'}</Text>
        <Text style={s.time}>{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</Text>
      </View>
    </View>
  );

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Sticker Gifts</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? (
        <View style={{ marginTop: 16 }}><SkeletonLoader.ListItem count={5} /></View>
      ) : (
        <FlatList
          data={gifts}
          keyExtractor={(i, idx) => String(i.id || idx)}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.secondary} />}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Gift size={48} color={COLORS.textMuted} />
              <Text style={s.emptyText}>No gifts received yet</Text>
              <Text style={s.emptySub}>When readers send you sticker gifts, they'll appear here</Text>
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
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(232,121,249,0.1)', alignItems: 'center', justifyContent: 'center' },
  desc: { fontSize: 13, color: COLORS.text },
  time: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  emptySub: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: 40 },
});

export default GiftsScreen;
