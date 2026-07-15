// © 2026 WiamApp. Powered by WiamLabs
// screens/SearchScreen.js — Part 13 Search (real Supabase search)

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, FlatList, TextInput,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import VerifiedBadge from '../components/VerifiedBadge';
import GoldAvatar from '../components/ui/GoldAvatar';
import { Colors } from '../constants/colors';
import { useAuth } from '../lib/AuthContext';
import { searchWorkers, getCategories } from '../lib/api/workers';

const PAD = Colors.screenPad;

const FILTER_CHIPS = [
  { id: 'available', label: 'Available now', icon: 'time-outline' },
  { id: 'rating', label: '4.5+ rating', icon: 'star' },
  { id: 'verified', label: 'Verified', icon: 'shield-checkmark-outline' },
];

export default function SearchScreen({ navigation, route }) {
  const { user } = useAuth();
  const inputRef = useRef(null);

  const [query, setQuery] = useState(route.params?.query || '');
  const [category, setCategory] = useState(route.params?.category || null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [ratingOnly, setRatingOnly] = useState(false);
  const [results, setResults] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
    if (query || category) doSearch();
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { if (query.length > 1 || category) doSearch(); }, 400);
    return () => clearTimeout(t);
  }, [query, category, verifiedOnly]);

  const doSearch = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const data = await searchWorkers({ query, category, verifiedOnly });
      setResults(data || []);
    } catch (e) {
      console.warn('Search error:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleChip = (id) => {
    if (id === 'available') setAvailableOnly((v) => !v);
    if (id === 'rating') setRatingOnly((v) => !v);
    if (id === 'verified') setVerifiedOnly((v) => !v);
  };

  const chipActive = (id) => {
    if (id === 'available') return availableOnly;
    if (id === 'rating') return ratingOnly;
    if (id === 'verified') return verifiedOnly;
    return false;
  };

  const filteredResults = useMemo(() => {
    let list = results;
    if (availableOnly) list = list.filter((w) => w.is_available);
    if (ratingOnly) list = list.filter((w) => (w.average_rating || 0) >= 4.5);
    return list;
  }, [results, availableOnly, ratingOnly]);

  const renderWorker = ({ item }) => {
    const catName = item.worker_categories?.[0]?.categories?.name || 'Worker';
    const city = item.users?.city || 'Accra';
    return (
      <TouchableOpacity
        style={styles.workerCard}
        onPress={() => navigation.navigate('WorkerProfile', { workerId: item.id })}
        activeOpacity={0.85}
      >
        <GoldAvatar
          name={item.users?.full_name}
          uri={item.users?.avatar_url}
          size={50}
          online={!!item.is_available}
        />
        {item.verified_badge ? (
          <View style={styles.verifiedWrap}>
            <VerifiedBadge color="blue" size={14} />
          </View>
        ) : null}
        <View style={styles.workerInfo}>
          <Text style={styles.workerName} numberOfLines={1}>{item.users?.full_name}</Text>
          <Text style={styles.workerCat}>{catName} · {city}</Text>
          <View style={styles.workerMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="star" size={11} color={Colors.gold} />
              <Text style={styles.metaText}>
                {item.average_rating ? item.average_rating.toFixed(1) : 'New'}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="checkmark" size={11} color={Colors.gold} />
              <Text style={styles.metaText}>{item.total_jobs_done || 0} jobs</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={11} color={Colors.gold} />
              <Text style={styles.metaText}>{city}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const locationLabel = user?.city || 'your area';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />

      <View style={styles.topFixed}>
        <Text style={styles.pageTitle}>Search</Text>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={16} color={Colors.textFaint} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Search electricians, plumbers, braiders..."
              placeholderTextColor={Colors.textFaint}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              onSubmitEditing={doSearch}
            />
            {query.length > 0 ? (
              <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
                <Ionicons name="close-circle" size={18} color={Colors.textFaint} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity style={styles.filterBtn} accessibilityLabel="Filters">
            <Ionicons name="options-outline" size={16} color={Colors.navy} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTER_CHIPS.map((chip) => {
            const active = chipActive(chip.id);
            return (
              <TouchableOpacity
                key={chip.id}
                style={[styles.fchip, active && styles.fchipActive]}
                onPress={() => toggleChip(chip.id)}
              >
                <Ionicons name={chip.icon} size={12} color={active ? Colors.gold : '#B8B8CC'} />
                <Text style={[styles.fchipText, active && styles.fchipTextActive]}>{chip.label}</Text>
              </TouchableOpacity>
            );
          })}
          {categories.slice(0, 4).map((cat) => {
            const active = category === cat.name;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.fchip, active && styles.fchipActive]}
                onPress={() => setCategory(active ? null : cat.name)}
              >
                <Text style={styles.fchipEmoji}>{cat.icon || '🔧'}</Text>
                <Text style={[styles.fchipText, active && styles.fchipTextActive]}>{cat.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.gold} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredResults}
          keyExtractor={(i) => i.id}
          renderItem={renderWorker}
          contentContainerStyle={filteredResults.length === 0 ? styles.emptyContainer : styles.list}
          ListHeaderComponent={
            searched && !loading ? (
              <Text style={styles.resultCount}>
                {filteredResults.length} worker{filteredResults.length !== 1 ? 's' : ''} found near {locationLabel}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            searched ? (
              <View style={styles.empty}>
                <Ionicons name="search-outline" size={48} color={Colors.navyLine} />
                <Text style={styles.emptyTitle}>No workers found</Text>
                <Text style={styles.emptyText}>Try a different search or remove filters</Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={48} color={Colors.navyLine} />
                <Text style={styles.emptyTitle}>Search for workers</Text>
                <Text style={styles.emptyText}>Type a service or pick a category above</Text>
              </View>
            )
          }
          ListFooterComponent={
            filteredResults.length > 0 ? (
              <Text style={styles.footer}>© 2026 WiamApp · Powered by WiamLabs</Text>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.navy },
  topFixed: { paddingHorizontal: PAD, paddingBottom: 12 },
  pageTitle: { fontSize: 20, fontWeight: '700', color: Colors.white, marginTop: 4, marginBottom: 14 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: Colors.navyCard,
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.navyLine,
  },
  searchInput: { flex: 1, fontSize: 13.5, color: Colors.white },
  filterBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: { gap: 8, marginTop: 12, paddingBottom: 2 },
  fchip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: Colors.navyCard,
    borderWidth: 1,
    borderColor: Colors.navyLine,
  },
  fchipActive: {
    backgroundColor: 'rgba(212,160,23,0.12)',
    borderColor: Colors.gold,
  },
  fchipText: { fontSize: 11.5, fontWeight: '500', color: '#B8B8CC' },
  fchipTextActive: { color: Colors.gold },
  fchipEmoji: { fontSize: 12 },
  resultCount: { fontSize: 12, color: Colors.textFaint, marginBottom: 12, paddingHorizontal: PAD },
  list: { paddingHorizontal: PAD, paddingBottom: 28 },
  emptyContainer: { flex: 1, paddingHorizontal: PAD },
  empty: { alignItems: 'center', paddingTop: 70, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: Colors.textDim },
  emptyText: { fontSize: 14, color: Colors.textDim, textAlign: 'center', paddingHorizontal: 30 },
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
  footer: { textAlign: 'center', fontSize: 10, color: '#3A3A56', paddingVertical: 12 },
});
