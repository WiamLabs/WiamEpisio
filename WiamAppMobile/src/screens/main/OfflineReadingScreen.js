import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, RefreshControl } from 'react-native';
import { ChevronLeft, Trash2, Download } from 'lucide-react-native';
import AppBackground from '../../components/AppBackground';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import {
  listCachedChapters,
  removeCachedChapter,
  clearAllCache,
  getCacheSize,
  formatBytes,
} from '../../services/chapterCache';
import useAuthStore from '../../store/useAuthStore';
import { canUseFeature, getOfflineBookLimit, getUserPlan } from '../../constants/premiumEntitlements';

const OfflineReadingScreen = ({ navigation }) => {
  const user = useAuthStore((s) => s.user);
  const userPlan = getUserPlan(user);
  const offlineLimit = getOfflineBookLimit(userPlan);
  const hasOfflineAccess = canUseFeature(user, 'smart_chapter_cache');
  const [rows, setRows] = useState([]);
  const [sizeBytes, setSizeBytes] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const uniqueBookCount = new Set(rows.map((r) => r.book_id).filter(Boolean)).size;

  const load = useCallback(async () => {
    const [list, total] = await Promise.all([
      listCachedChapters(),
      getCacheSize(),
    ]);
    setRows(list);
    setSizeBytes(total || 0);
  }, []);

  useEffect(() => {
    if (!hasOfflineAccess) return;
    load();
  }, [load, hasOfflineAccess]);

  const onRefresh = useCallback(async () => {
    if (!hasOfflineAccess) return;
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load, hasOfflineAccess]);

  const onDeleteOne = (item) => {
    Alert.alert(
      'Remove Cached Chapter',
      `Remove "${item.chapter_title}" from offline cache?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeCachedChapter(item.book_id, item.chapter_number);
            load();
          },
        },
      ]
    );
  };

  const onClearAll = () => {
    Alert.alert(
      'Clear Offline Cache',
      'This removes all cached chapters from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearAllCache();
            load();
          },
        },
      ]
    );
  };

  return (
    <AppBackground>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Offline Reading</Text>
        <TouchableOpacity style={styles.clearBtn} onPress={onClearAll} disabled={!rows.length}>
          <Text style={[styles.clearBtnText, !rows.length && { opacity: 0.4 }]}>Clear All</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summary}>
        <Download size={16} color={COLORS.secondary} />
        <Text style={styles.summaryText}>
          {hasOfflineAccess
            ? `${rows.length} chapters cached • ${formatBytes(sizeBytes)} • ${Math.min(uniqueBookCount, offlineLimit)}/${offlineLimit} books`
            : 'Offline reading is available on WiamPremium Basic and above'}
        </Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.secondary} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {hasOfflineAccess
              ? 'No cached chapters yet. Open chapters to cache them automatically.'
              : 'Upgrade to WiamPremium Basic to enable offline reading.'}
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => navigation.navigate('Reader', { bookId: item.book_id, chNum: item.chapter_number })}
            activeOpacity={0.8}
            disabled={!hasOfflineAccess}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle} numberOfLines={1}>{item.chapter_title}</Text>
              <Text style={styles.itemSub} numberOfLines={1}>
                {item.book_title || `Book ${item.book_id}`} • Chapter {item.chapter_number}
              </Text>
            </View>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => onDeleteOne(item)}>
              <Trash2 size={15} color="#f87171" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
      {!hasOfflineAccess && (
        <View style={styles.ctaWrap}>
          <TouchableOpacity style={styles.ctaBtn} onPress={() => navigation.navigate('PremiumScreen')}>
            <Text style={styles.ctaText}>View WiamPremium Plans</Text>
          </TouchableOpacity>
        </View>
      )}
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: 52,
    paddingBottom: SPACING.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  clearBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  clearBtnText: { color: '#f87171', fontSize: 12, fontWeight: '700' },
  summary: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryText: { color: COLORS.textSecondary, fontSize: 13 },
  list: { paddingHorizontal: SPACING.md, paddingBottom: 40 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 10,
  },
  itemTitle: { color: COLORS.text, fontWeight: '700', fontSize: 13 },
  itemSub: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248,113,113,0.12)',
  },
  empty: { color: COLORS.textMuted, textAlign: 'center', marginTop: 28, paddingHorizontal: 24 },
  ctaWrap: { paddingHorizontal: SPACING.md, paddingBottom: 24 },
  ctaBtn: {
    borderRadius: RADIUS.md,
    backgroundColor: '#c084fc',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  ctaText: { color: '#08081a', fontWeight: '700', fontSize: 13 },
});

export default OfflineReadingScreen;
