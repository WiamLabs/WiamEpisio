// © 2026 WiamApp. Powered by WiamLabs
// screens/CategoryScreen.js
// Shows all workers in a specific category with rankings
// Backend: GET /api/workers?category=&city=&sort=rating

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, FlatList,
  ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import VerifiedBadge from '../components/VerifiedBadge';

const BG      = '#FFFFFF';
const NAVY    = '#0D0D2B';
const GOLD    = '#D4A017';
const GOLD_BG = 'rgba(212,160,23,0.10)';
const BORDER  = '#EBEBEB';
const MUTED   = '#888899';
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

const RANK_ICONS = ['trophy', 'medal', 'medal'];
const RANK_COLORS = ['#D4A017', '#C0C0C0', '#CD7F32'];

export default function CategoryScreen({ navigation, route }) {
  const { categoryId, categoryName } = route?.params || {};
  const [workers,  setWorkers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [sort,     setSort]     = useState('rating');

  const SORTS = [
    { id: 'rating',    label: 'Top Rated' },
    { id: 'jobs',      label: 'Most Jobs' },
    { id: 'trust',     label: 'WiamTrust' },
    { id: 'online',    label: 'Online Now' },
    { id: 'price_asc', label: 'Price ↑' },
  ];

  useEffect(() => {
    const fetchWorkers = async () => {
      setLoading(true);
      try {
        const res  = await fetch(`${BACKEND}/api/workers?category=${categoryId}&sort=${sort}&limit=30`);
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

  const renderWorker = ({ item, index }) => (
    <TouchableOpacity
      style={s.workerRow}
      onPress={() => navigation.navigate('WorkerProfile', { workerId: item.id })}
      activeOpacity={0.85}
    >
      {/* Rank badge for top 3 */}
      <View style={s.rankWrap}>
        {index < 3
          ? <Ionicons name={RANK_ICONS[index]} size={16} color={RANK_COLORS[index]} />
          : <Text style={s.rankNum}>{index + 1}</Text>
        }
      </View>

      {/* Avatar */}
      <View style={s.avatarWrap}>
        {item.users?.avatar_url
          ? <Image source={{ uri: item.users.avatar_url }} style={s.avatar} />
          : <View style={[s.avatar, s.avatarFallback]}>
              <Text style={s.avatarInitial}>{item.users?.full_name?.[0]?.toUpperCase() || 'W'}</Text>
            </View>
        }
        {item.is_online && <View style={s.onlineDot} />}
      </View>

      {/* Info */}
      <View style={s.info}>
        <View style={s.nameRow}>
          <Text style={s.name} numberOfLines={1}>{item.users?.full_name}</Text>
          {item.verified_badge && (
            <VerifiedBadge color="blue" size={13} />
          )}
        </View>
        <Text style={s.city}>{item.users?.city}</Text>
        <View style={s.statsRow}>
          <Ionicons name="star" size={11} color={GOLD} />
          <Text style={s.rating}>{item.average_rating?.toFixed(1) || '–'}</Text>
          <Text style={s.dot}>·</Text>
          <Text style={s.jobs}>{item.total_jobs_done || 0} jobs</Text>
          {item.eligibility_score > 0 && (
            <>
              <Text style={s.dot}>·</Text>
              <Ionicons name="trophy-outline" size={10} color={GOLD} />
              <Text style={s.trust}>{Math.round(item.eligibility_score)}</Text>
            </>
          )}
        </View>
      </View>

      {/* Rate */}
      <View style={s.rateWrap}>
        <Text style={s.rate}>{item.currency || 'GHS'} {item.hourly_rate || '–'}</Text>
        <Text style={s.rateLabel}>/hr</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={NAVY} />
        </TouchableOpacity>
        <Text style={s.title}>{categoryName}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Search', { categoryId })}>
          <Ionicons name="search-outline" size={22} color={NAVY} />
        </TouchableOpacity>
      </View>

      {/* Sort pills */}
      <View style={s.sortRow}>
        {SORTS.map(opt => (
          <TouchableOpacity
            key={opt.id}
            style={[s.sortPill, sort === opt.id && s.sortPillActive]}
            onPress={() => setSort(opt.id)}
          >
            <Text style={[s.sortPillText, sort === opt.id && s.sortPillTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Workers list */}
      {loading ? (
        <ActivityIndicator color={GOLD} style={{ marginTop: 40 }} />
      ) : workers.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="people-outline" size={48} color="#DDD" />
          <Text style={s.emptyText}>No workers in {categoryName} yet</Text>
        </View>
      ) : (
        <FlatList
          data={workers}
          keyExtractor={w => w.id}
          renderItem={renderWorker}
          ItemSeparatorComponent={() => <View style={s.separator} />}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: BORDER,
  },
  backBtn: { width: 36 },
  title:   { color: NAVY, fontSize: 17, fontWeight: '700' },

  sortRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16,
    paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: BORDER,
  },
  sortPill:          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F5F5F8', borderWidth: 0.5, borderColor: BORDER },
  sortPillActive:    { backgroundColor: NAVY },
  sortPillText:      { color: MUTED, fontSize: 12 },
  sortPillTextActive:{ color: '#FFF', fontWeight: '600' },

  workerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 10,
  },
  rankWrap:   { width: 28, alignItems: 'center' },
  rankNum:    { color: MUTED, fontSize: 13, fontWeight: '600' },
  avatarWrap: { position: 'relative' },
  avatar:     { width: 50, height: 50, borderRadius: 13 },
  avatarFallback: { backgroundColor: GOLD_BG, alignItems: 'center', justifyContent: 'center' },
  avatarInitial:  { color: GOLD, fontSize: 18, fontWeight: '700' },
  onlineDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#22C55E', borderWidth: 2, borderColor: BG,
    position: 'absolute', bottom: 0, right: 0,
  },
  info:     { flex: 1 },
  nameRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  name:     { color: NAVY, fontSize: 14, fontWeight: '600', flex: 1 },
  badge:    { fontSize: 12 },
  city:     { color: MUTED, fontSize: 11, marginBottom: 3 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating:   { color: NAVY, fontSize: 11, fontWeight: '600' },
  dot:      { color: MUTED, fontSize: 11 },
  jobs:     { color: MUTED, fontSize: 11 },
  trust:    { color: '#EF4444', fontSize: 11, fontWeight: '600' },
  rateWrap: { alignItems: 'flex-end' },
  rate:     { color: GOLD, fontSize: 14, fontWeight: '700' },
  rateLabel:{ color: MUTED, fontSize: 10 },
  separator:{ height: 0.5, backgroundColor: BORDER, marginLeft: 80 },
  empty:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyText:{ color: MUTED, fontSize: 15, marginTop: 14 },
});
