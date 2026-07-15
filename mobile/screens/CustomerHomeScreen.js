// © 2026 WiamApp. Powered by WiamLabs
// screens/CustomerHomeScreen.js — Part 13 Customer Home (Spotlight feed)

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, StatusBar, ScrollView, ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../constants/colors';
import { useAuth } from '../lib/AuthContext';
import { getNearbyWorkers, getCategories } from '../lib/api/workers';
import { supabase } from '../lib/supabase';
import { getUnreadNotificationCount, subscribeToNotifications } from '../lib/api/notifications';
import AppHeader from '../components/ui/AppHeader';
import CategoryChips from '../components/ui/CategoryChips';
import SpotlightCard from '../components/ui/SpotlightCard';

export default function CustomerHomeScreen({ navigation }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [activeCat, setActiveCat] = useState('all');
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);

  const load = async () => {
    try {
      const [cats, nearbyWorkers] = await Promise.all([
        getCategories(),
        getNearbyWorkers({ city: user?.city || 'Accra', limit: 12 }),
      ]);
      setCategories((cats || []).slice(0, 10));

      let spots = [];
      const { data: spotData } = await supabase
        .from('spotlight_posts')
        .select(`
          id, title, description, content, media_urls, category_id,
          worker_profile_id, worker_id, author_id, status, is_active,
          categories ( name ),
          worker_profiles (
            id, average_rating, total_jobs_done, city, verified_badge, is_verified,
            users ( full_name, avatar_url, city )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      spots = (spotData || []).filter(
        (p) => p.status === 'approved' || p.is_active === true,
      );

      const fromSpotlights = spots.map((post) => {
        const wp = post.worker_profiles;
        const name = wp?.users?.full_name || 'Worker';
        const city = wp?.users?.city || wp?.city || '';
        const skill = post.categories?.name || 'Professional';
        return {
          key: `spot-${post.id}`,
          workerId: wp?.id || post.worker_profile_id || post.worker_id,
          name,
          roleLine: [skill, city].filter(Boolean).join(' · '),
          rating: wp?.average_rating,
          tag: skill,
          caption: post.description || post.content || post.title || '',
          jobsCount: wp?.total_jobs_done ?? null,
          mediaUrl: Array.isArray(post.media_urls) ? post.media_urls[0] : null,
          avatarUrl: wp?.users?.avatar_url,
          verified: !!(wp?.verified_badge || wp?.is_verified),
          categoryId: post.category_id,
        };
      });

      // If Spotlight is empty, feature nearby workers in the same card layout
      const fromWorkers = (nearbyWorkers || []).map((worker) => {
        const skill = worker.worker_categories?.[0]?.categories?.name || 'Worker';
        const city = worker.users?.city || worker.city || user?.city || '';
        return {
          key: `worker-${worker.id}`,
          workerId: worker.id,
          name: worker.users?.full_name || 'Worker',
          roleLine: [skill, city].filter(Boolean).join(' · '),
          rating: worker.average_rating,
          tag: skill,
          caption: worker.bio || worker.tagline || `Available now · GHS ${worker.hourly_rate || '—'}/hr`,
          jobsCount: worker.total_jobs_done ?? 0,
          mediaUrl: worker.portfolio_images?.[0]?.image_url || null,
          avatarUrl: worker.users?.avatar_url,
          verified: !!(worker.verified_badge || worker.is_verified),
          categoryId: worker.worker_categories?.[0]?.categories?.id,
        };
      });

      setFeed(fromSpotlights.length ? fromSpotlights : fromWorkers);

      if (user?.id) {
        setUnread(await getUnreadNotificationCount(user.id));
      }
    } catch (e) {
      console.warn('CustomerHome load error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => {
    load();
    if (!user?.id) return undefined;
    const sub = subscribeToNotifications(user.id, () => setUnread((p) => p + 1));
    return () => sub.unsubscribe();
  }, [user?.id]));

  const filtered = feed.filter((item) => {
    if (activeCat === 'all') return true;
    return String(item.categoryId) === String(activeCat)
      || String(item.tag).toLowerCase().includes(
        String(categories.find((c) => String(c.id) === String(activeCat))?.name || '').toLowerCase(),
      );
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator color={Colors.gold} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />

      <View style={styles.topFixed}>
        <AppHeader
          unread={unread}
          onSearch={() => navigation.navigate('Search')}
          onNotifications={() => navigation.navigate('Notifications')}
        />
        <CategoryChips
          categories={categories}
          activeId={activeCat}
          onSelect={(cat) => {
            if (cat.id === 'all') {
              setActiveCat('all');
              return;
            }
            setActiveCat(cat.id);
          }}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={Colors.gold}
          />
        }
      >
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Spotlight</Text>
          <Text
            style={styles.seeAll}
            onPress={() => navigation.navigate('Search')}
          >
            See all
          </Text>
        </View>

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No Spotlight posts yet</Text>
            <Text style={styles.emptySub}>Workers near you will appear here as they post work.</Text>
          </View>
        ) : (
          filtered.map((item) => (
            <SpotlightCard
              key={item.key}
              name={item.name}
              roleLine={item.roleLine}
              rating={item.rating}
              tag={item.tag}
              caption={item.caption}
              jobsCount={item.jobsCount}
              mediaUrl={item.mediaUrl}
              avatarUrl={item.avatarUrl}
              verified={item.verified}
              onPressCard={() => item.workerId && navigation.navigate('WorkerProfile', { workerId: item.workerId })}
              onBook={() => item.workerId && navigation.navigate('Booking', { workerId: item.workerId })}
            />
          ))
        )}

        <Text style={styles.footer}>© 2026 WiamApp · Powered by WiamLabs</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.navy },
  topFixed: { paddingHorizontal: 20, paddingBottom: 12 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 28 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: Colors.white },
  seeAll: { fontSize: 11.5, color: Colors.gold, fontWeight: '500' },
  empty: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.navyLine,
    backgroundColor: Colors.navyCard,
    padding: 28,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: { color: Colors.white, fontWeight: '700', fontSize: 15, marginBottom: 6 },
  emptySub: { color: Colors.textDim, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  footer: {
    textAlign: 'center',
    fontSize: 10,
    color: '#3A3A56',
    paddingVertical: 12,
  },
});
