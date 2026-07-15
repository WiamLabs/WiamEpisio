// © 2026 WiamApp. Powered by WiamLabs
// screens/CategoryScreen.js — Part 13 Category workers list

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, FlatList,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import VerifiedBadge from '../components/VerifiedBadge';
import GoldAvatar from '../components/ui/GoldAvatar';
import { Colors } from '../constants/colors';

const PAD = Colors.screenPad;
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

const SORTS = [
  { id: 'rating', label: 'Top rated' },
  { id: 'jobs', label: 'Most jobs' },
  { id: 'trust', label: 'WiamTrust' },
  { id: 'online', label: 'Online now' },
  { id: 'price_asc', label: 'Price ↑' },
];

export default function CategoryScreen({ navigation, route }) {
  const { categoryId, categoryName } = route?.params || {};
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('rating');

  useEffect(() => {
    const fetchWorkers = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${BACKEND}/api/workers?category=${categoryId}&sort=${sort}&limit=30`);
        const data = await res.json();
        setWorkers(data.data || []);
      } catch {
        setWorkers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchWorkers();
  }, [categoryId, sort]);

  const sortLabel = SORTS.find((s) => s.id === sort)?.label || 'Top rated';

  const cycleSort = () => {
    const idx = SORTS.findIndex((s) => s.id === sort);
    setSort(SORTS[(idx + 1) % SORTS.length].id);
  };

  const renderWorker = ({ item }) => (
    <TouchableOpacity
      style={styles.workerCard}
      onPress={() => navigation.navigate('WorkerProfile', { workerId: item.id })}
      activeOpacity={0.85}
    >
      <GoldAvatar
        name={item.users?.full_name}
        uri={item.users?.avatar_url}
        size={50}
        online={!!item.is_online}
      />
      {item.verified_badge ? (
        <View style={styles.verifiedWrap}>
          <VerifiedBadge color="blue" size={14} />
        </View>
      ) : null}
      <View style={styles.workerInfo}>
        <Text style={styles.workerName} numberOfLines={1}>{item.users?.full_name}</Text>
        <Text style={styles.workerCat}>{item.users?.city || 'Accra'}</Text>
        <View style={styles.workerMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="star" size={11} color={Colors.gold} />
            <Text style={styles.metaText}>{item.average_rating?.toFixed(1) || '–'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="checkmark" size={11} color={Colors.gold} />
            <Text style={styles.metaText}>{item.total_jobs_done || 0} jobs</Text>
          </View>
          {item.eligibility_score > 0 ? (
            <View style={styles.metaItem}>
              <Ionicons name="trophy-outline" size={11} color={Colors.gold} />
              <Text style={styles.metaText}>{Math.round(item.eligibility_score)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />

      <View style={styles.topFixed}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={17} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{categoryName}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Search', { categoryId })} style={styles.searchBtn}>
            <Ionicons name="search-outline" size={18} color={Colors.white} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortChips}>
          {SORTS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.subtypeChip, sort === opt.id && styles.subtypeChipActive]}
              onPress={() => setSort(opt.id)}
            >
              <Text style={[styles.subtypeText, sort === opt.id && styles.subtypeTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.sortRow}>
        <Text style={styles.resultsCount}>
          {workers.length} {categoryName?.toLowerCase() || 'workers'} found
        </Text>
        <TouchableOpacity style={styles.sortBtn} onPress={cycleSort}>
          <Ionicons name="options-outline" size={13} color={Colors.gold} />
          <Text style={styles.sortBtnText}>Sort: {sortLabel}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.gold} style={{ marginTop: 40 }} />
      ) : workers.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={48} color={Colors.navyLine} />
          <Text style={styles.emptyText}>No workers in {categoryName} yet</Text>
        </View>
      ) : (
        <FlatList
          data={workers}
          keyExtractor={(w) => w.id}
          renderItem={renderWorker}
          contentContainerStyle={styles.list}
          ListFooterComponent={
            <Text style={styles.footer}>© 2026 WiamApp · Powered by WiamLabs</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.navy },
  topFixed: { paddingHorizontal: PAD, paddingBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.navyCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.white },
  searchBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.navyCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortChips: { gap: 8 },
  subtypeChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: Colors.navyCard,
    borderWidth: 1,
    borderColor: Colors.navyLine,
  },
  subtypeChipActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  subtypeText: { fontSize: 12, fontWeight: '500', color: '#B8B8CC' },
  subtypeTextActive: { color: Colors.navy, fontWeight: '700' },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD,
    paddingTop: 14,
    paddingBottom: 6,
  },
  resultsCount: { fontSize: 12, color: Colors.textFaint },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sortBtnText: { fontSize: 12, color: Colors.gold, fontWeight: '600' },
  list: { paddingHorizontal: PAD, paddingBottom: 28 },
  workerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 18,
    backgroundColor: Colors.navyCard,
    borderWidth: 1,
    borderColor: Colors.navyLine,
    marginBottom: 10,
  },
  verifiedWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(212,160,23,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerInfo: { flex: 1, minWidth: 0 },
  workerName: { fontSize: 13.5, fontWeight: '600', color: Colors.white },
  workerCat: { fontSize: 11.5, color: Colors.textDim, marginTop: 2, marginBottom: 4 },
  workerMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11, color: '#B8B8CC' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyText: { color: Colors.textDim, fontSize: 15, marginTop: 14 },
  footer: { textAlign: 'center', fontSize: 10, color: '#3A3A56', paddingVertical: 12 },
});
