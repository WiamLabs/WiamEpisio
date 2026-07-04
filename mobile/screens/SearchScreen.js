// © 2026 WiamApp. Powered by WiamLabs
// screens/SearchScreen.js — PRODUCTION real Supabase search

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, FlatList, TextInput,
  ActivityIndicator, Switch, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import VerifiedBadge from '../components/VerifiedBadge';
import { Colors } from '../constants/colors';
import { useAuth } from '../lib/AuthContext';
import { searchWorkers, getCategories } from '../lib/api/workers';

const C    = Colors.light;
const GOLD = Colors.gold;
const NAVY = Colors.navy;

export default function SearchScreen({ navigation, route }) {
  const { user } = useAuth();
  const inputRef = useRef(null);

  const [query,          setQuery]          = useState(route.params?.query || '');
  const [category,       setCategory]       = useState(route.params?.category || null);
  const [verifiedOnly,   setVerifiedOnly]   = useState(false);
  const [results,        setResults]        = useState([]);
  const [categories,     setCategories]     = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [searched,       setSearched]       = useState(false);

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

  const renderWorker = ({ item }) => (
    <TouchableOpacity
      style={styles.workerCard}
      onPress={() => navigation.navigate('WorkerProfile', { workerId: item.id })}
    >
      <View style={styles.workerLeft}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(item.users?.full_name || 'W')[0].toUpperCase()}</Text>
          {item.is_available && <View style={styles.onlineDot} />}
        </View>
        <View style={styles.workerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.workerName}>{item.users?.full_name}</Text>
            {item.verified_badge && (
              // Section 8B: blue = individual worker. All results here are
              // individual workers today. Once Section 17B's Provider
              // business search ships, branch on item.result_type:
              // <VerifiedBadge color={item.result_type === 'business' ? 'gold' : 'blue'} size={16} />
              <VerifiedBadge color="blue" size={16} />
            )}
          </View>
          <Text style={styles.workerCat}>
            {item.worker_categories?.[0]?.categories?.name || 'Worker'}
          </Text>
          <View style={styles.workerMeta}>
            <Ionicons name="location-outline" size={12} color={C.textSecondary} />
            <Text style={styles.metaText}>{item.users?.city || 'Accra'}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Ionicons name="star" size={12} color={GOLD} />
            <Text style={styles.metaText}>{item.average_rating ? item.average_rating.toFixed(1) : 'New'}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{item.total_jobs_done} jobs</Text>
          </View>
        </View>
      </View>
      <View style={styles.workerRight}>
        <Text style={styles.rate}>GHS {item.hourly_rate}</Text>
        <Text style={styles.rateUnit}>/hr</Text>
        <View style={[styles.availBadge, { backgroundColor: item.is_available ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)' }]}>
          <Text style={[styles.availText, { color: item.is_available ? Colors.success : Colors.error }]}>
            {item.is_available ? 'Available' : 'Busy'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.background} />

      {/* Search bar */}
      <View style={styles.searchRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={NAVY} />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={C.textSecondary} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search workers, services..."
            placeholderTextColor={C.textSecondary}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={doSearch}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
              <Ionicons name="close-circle" size={18} color={C.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
          <TouchableOpacity
            style={[styles.filterChip, !category && styles.filterChipActive]}
            onPress={() => setCategory(null)}
          >
            <Text style={[styles.filterText, !category && styles.filterTextActive]}>All</Text>
          </TouchableOpacity>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.filterChip, category === cat.name && styles.filterChipActive]}
              onPress={() => setCategory(category === cat.name ? null : cat.name)}
            >
              <Text style={styles.filterEmoji}>{cat.icon || '🔧'}</Text>
              <Text style={[styles.filterText, category === cat.name && styles.filterTextActive]}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Verified toggle */}
      <View style={styles.verifiedRow}>
        <Text style={styles.verifiedLabel}>Verified workers only</Text>
        <Switch
          value={verifiedOnly}
          onValueChange={setVerifiedOnly}
          trackColor={{ false: C.border, true: GOLD }}
          thumbColor={verifiedOnly ? NAVY : '#aaa'}
        />
      </View>

      {/* Results */}
      {loading ? (
        <ActivityIndicator color={GOLD} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={i => i.id}
          renderItem={renderWorker}
          contentContainerStyle={results.length === 0 ? styles.emptyContainer : styles.list}
          ListHeaderComponent={
            searched && !loading
              ? <Text style={styles.resultCount}>{results.length} worker{results.length !== 1 ? 's' : ''} found</Text>
              : null
          }
          ListEmptyComponent={
            searched ? (
              <View style={styles.empty}>
                <Ionicons name="search-outline" size={48} color={C.border} />
                <Text style={styles.emptyTitle}>No workers found</Text>
                <Text style={styles.emptyText}>Try a different search or remove filters</Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={48} color={C.border} />
                <Text style={styles.emptyTitle}>Search for workers</Text>
                <Text style={styles.emptyText}>Type a service or pick a category above</Text>
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}



const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: C.background },
  searchRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  backBtn:         { padding: 4 },
  searchBar:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.border },
  searchInput:     { flex: 1, fontSize: 15, color: NAVY },
  filtersRow:      { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  filterChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.surface, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: C.border },
  filterChipActive:{ backgroundColor: NAVY, borderColor: NAVY },
  filterEmoji:     { fontSize: 14 },
  filterText:      { fontSize: 13, color: C.textSecondary, fontWeight: '500' },
  filterTextActive:{ color: '#fff', fontWeight: '700' },
  verifiedRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  verifiedLabel:   { fontSize: 14, color: NAVY, fontWeight: '500' },
  resultCount:     { fontSize: 13, color: C.textSecondary, paddingHorizontal: 20, marginBottom: 8, marginTop: 4 },
  list:            { paddingBottom: 40 },
  emptyContainer:  { flex: 1 },
  empty:           { alignItems: 'center', paddingTop: 70, gap: 10 },
  emptyTitle:      { fontSize: 17, fontWeight: '600', color: C.textSecondary },
  emptyText:       { fontSize: 14, color: C.textSecondary, textAlign: 'center', paddingHorizontal: 30 },
  workerCard:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  workerLeft:      { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar:          { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(212,160,23,0.12)', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  avatarText:      { fontSize: 20, fontWeight: '700', color: GOLD },
  onlineDot:       { position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.success, borderWidth: 2, borderColor: '#fff' },
  workerInfo:      { flex: 1 },
  nameRow:         { flexDirection: 'row', alignItems: 'center', gap: 5 },
  workerName:      { fontSize: 15, fontWeight: '700', color: NAVY },
  workerCat:       { fontSize: 13, color: C.textSecondary, marginTop: 2 },
  workerMeta:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  metaText:        { fontSize: 12, color: C.textSecondary },
  metaDot:         { fontSize: 12, color: C.border },
  workerRight:     { alignItems: 'flex-end', gap: 4 },
  rate:            { fontSize: 16, fontWeight: '800', color: NAVY },
  rateUnit:        { fontSize: 11, color: C.textSecondary },
  availBadge:      { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  availText:       { fontSize: 11, fontWeight: '600' },
});
