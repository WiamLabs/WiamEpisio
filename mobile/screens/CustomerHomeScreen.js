// © 2026 WiamApp. Powered by WiamLabs
// screens/CustomerHomeScreen.js — PRODUCTION real Supabase data

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, TextInput,
  ActivityIndicator, RefreshControl, Image, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import VerifiedBadge from '../components/VerifiedBadge';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../constants/colors';
import { useAuth } from '../lib/AuthContext';
import { getNearbyWorkers, getCategories } from '../lib/api/workers';
import { supabase } from '../lib/supabase';
import { getUnreadNotificationCount, subscribeToNotifications } from '../lib/api/notifications';

const C = Colors.light;

export default function CustomerHomeScreen({ navigation }) {
  const { user } = useAuth();
  const [categories,    setCategories]    = useState([]);
  const [workers,       setWorkers]       = useState([]);
  const [spotlights,    setSpotlights]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [unread,        setUnread]        = useState(0);
  const [searchText,    setSearchText]    = useState('');

  const load = async () => {
    try {
      const [cats, nearbyWorkers] = await Promise.all([
        getCategories(),
        getNearbyWorkers({ city: user?.city || 'Accra', limit: 10 }),
      ]);
      setCategories(cats || []);
      setWorkers(nearbyWorkers || []);

      // Load spotlight posts
      const { data: spots } = await supabase
        .from('spotlight_posts')
        .select(`*, worker_profiles(id, users(full_name, avatar_url))`)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5);
      setSpotlights(spots || []);

      if (user?.id) {
        const count = await getUnreadNotificationCount(user.id);
        setUnread(count);
      }
    } catch (e) {
      console.warn('CustomerHome load error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [user?.id]));

  useEffect(() => {
    if (!user?.id) return;
    const sub = subscribeToNotifications(user.id, () => setUnread(prev => prev + 1));
    return () => sub.unsubscribe();
  }, [user?.id]);

  const firstName = user?.full_name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.gold} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.background} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.gold} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}, {firstName} 👋</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={Colors.gold} />
              <Text style={styles.location}>{user?.city || 'Accra'}, Ghana</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.navigate('EmergencyMode')}
            >
              <Ionicons name="flash" size={20} color={Colors.error} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Ionicons name="notifications-outline" size={20} color={Colors.navy} />
              {unread > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Search bar */}
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => navigation.navigate('Search')}
        >
          <Ionicons name="search-outline" size={18} color={C.textSecondary} />
          <Text style={styles.searchPlaceholder}>Search electricians, plumbers, cleaners...</Text>
        </TouchableOpacity>

        {/* Emergency banner */}
        <TouchableOpacity
          style={styles.emergencyBanner}
          onPress={() => navigation.navigate('EmergencyMode')}
        >
          <Ionicons name="flash" size={18} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.emergencyTitle}>Need help RIGHT NOW?</Text>
            <Text style={styles.emergencySub}>Emergency mode — find available workers in minutes</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>

        {/* Categories */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Browse by Category</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Search')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={styles.catChip}
              onPress={() => navigation.navigate('Category', { categoryId: cat.id, categoryName: cat.name })}
            >
              <Text style={styles.catIcon}>{cat.icon || '🔧'}</Text>
              <Text style={styles.catName}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Top Workers Nearby */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Top Workers Near You</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Search')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        {workers.length === 0 ? (
          <View style={styles.emptyWorkers}>
            <Text style={styles.emptyWorkersText}>No workers found near {user?.city || 'Accra'}</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
            {workers.map(worker => (
              <TouchableOpacity
                key={worker.id}
                style={styles.workerCard}
                onPress={() => navigation.navigate('WorkerProfile', { workerId: worker.id })}
              >
                <View style={styles.workerAvatarWrap}>
                  {worker.users?.avatar_url
                    ? <Image source={{ uri: worker.users.avatar_url }} style={styles.workerAvatar} />
                    : <View style={[styles.workerAvatar, styles.avatarFallback]}>
                        <Text style={styles.avatarInitial}>{(worker.users?.full_name || 'W')[0]}</Text>
                      </View>
                  }
                  {worker.is_available && <View style={styles.onlineDot} />}
                  {worker.verified_badge && (
                    <View style={styles.verifiedBadge}>
                      <VerifiedBadge color="blue" size={14} />
                    </View>
                  )}
                </View>
                <Text style={styles.workerName} numberOfLines={1}>{worker.users?.full_name}</Text>
                <Text style={styles.workerCategory} numberOfLines={1}>
                  {worker.worker_categories?.[0]?.categories?.name || 'Worker'}
                </Text>
                <View style={styles.workerRating}>
                  <Ionicons name="star" size={12} color={Colors.gold} />
                  <Text style={styles.workerRatingText}>
                    {worker.average_rating ? worker.average_rating.toFixed(1) : 'New'}
                  </Text>
                  <Text style={styles.workerJobs}>· {worker.total_jobs_done} jobs</Text>
                </View>
                <Text style={styles.workerRate}>GHS {worker.hourly_rate}/hr</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Spotlight Posts */}
        {spotlights.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Worker Spotlights</Text>
            </View>
            {spotlights.map(post => (
              <TouchableOpacity
                key={post.id}
                style={styles.spotlightCard}
                onPress={() => navigation.navigate('WorkerProfile', { workerId: post.worker_profile_id })}
              >
                <View style={styles.spotlightAvatar}>
                  <Text style={styles.spotlightAvatarText}>
                    {(post.worker_profiles?.users?.full_name || 'W')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.spotlightName}>{post.worker_profiles?.users?.full_name}</Text>
                  <Text style={styles.spotlightContent} numberOfLines={2}>{post.content}</Text>
                </View>
                <View style={styles.spotlightTag}>
                  <Ionicons name="star" size={11} color={Colors.gold} />
                  <Text style={styles.spotlightTagText}>Featured</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:                { flex: 1, backgroundColor: C.background },
  header:              { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 },
  greeting:            { fontSize: 20, fontWeight: '700', color: Colors.navy },
  locationRow:         { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  location:            { fontSize: 13, color: Colors.light.textSecondary },
  headerActions:       { flexDirection: 'row', gap: 10 },
  iconBtn:             { width: 42, height: 42, borderRadius: 12, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  notifBadge:          { position: 'absolute', top: -3, right: -3, backgroundColor: Colors.error, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  notifBadgeText:      { fontSize: 9, color: '#fff', fontWeight: '700' },
  searchBar:           { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, marginHorizontal: 20, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  searchPlaceholder:   { fontSize: 14, color: C.textSecondary, flex: 1 },
  emergencyBanner:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.error, marginHorizontal: 20, borderRadius: 14, padding: 14, marginBottom: 20 },
  emergencyTitle:      { color: '#fff', fontWeight: '700', fontSize: 14 },
  emergencySub:        { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  sectionHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle:        { fontSize: 16, fontWeight: '700', color: Colors.navy },
  seeAll:              { fontSize: 13, color: Colors.gold, fontWeight: '600' },
  categoriesScroll:    { marginBottom: 20 },
  catChip:             { alignItems: 'center', backgroundColor: C.surface, borderRadius: 14, padding: 14, gap: 6, borderWidth: 1, borderColor: C.border, minWidth: 80 },
  catIcon:             { fontSize: 24 },
  catName:             { fontSize: 12, fontWeight: '600', color: Colors.navy, textAlign: 'center' },
  workerCard:          { backgroundColor: C.surface, borderRadius: 16, padding: 14, width: 150, borderWidth: 1, borderColor: C.border },
  workerAvatarWrap:    { position: 'relative', marginBottom: 10 },
  workerAvatar:        { width: 60, height: 60, borderRadius: 30 },
  avatarFallback:      { backgroundColor: 'rgba(212,160,23,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarInitial:       { fontSize: 22, fontWeight: '700', color: Colors.gold },
  onlineDot:           { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.success, borderWidth: 2, borderColor: '#fff' },
  verifiedBadge:       { position: 'absolute', top: -2, right: -2, backgroundColor: '#fff', borderRadius: 8 },
  workerName:          { fontSize: 14, fontWeight: '700', color: Colors.navy },
  workerCategory:      { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  workerRating:        { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 5 },
  workerRatingText:    { fontSize: 12, fontWeight: '700', color: Colors.navy },
  workerJobs:          { fontSize: 11, color: C.textSecondary },
  workerRate:          { fontSize: 13, fontWeight: '700', color: Colors.gold, marginTop: 6 },
  emptyWorkers:        { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 20 },
  emptyWorkersText:    { fontSize: 14, color: C.textSecondary },
  spotlightCard:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, marginHorizontal: 20, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  spotlightAvatar:     { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(212,160,23,0.15)', alignItems: 'center', justifyContent: 'center' },
  spotlightAvatarText: { fontSize: 18, fontWeight: '700', color: Colors.gold },
  spotlightName:       { fontSize: 14, fontWeight: '700', color: Colors.navy },
  spotlightContent:    { fontSize: 13, color: C.textSecondary, marginTop: 3, lineHeight: 18 },
  spotlightTag:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(212,160,23,0.1)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  spotlightTagText:    { fontSize: 11, color: Colors.gold, fontWeight: '600' },
});
