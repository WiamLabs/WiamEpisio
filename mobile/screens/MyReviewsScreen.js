// © 2026 WiamApp. Powered by WiamLabs
// screens/MyReviewsScreen.js
// Reviews a customer has written, real Supabase data.

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, StatusBar, FlatList, ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

const NAVY = '#0D0D2B';
const GOLD = '#D4A017';
const WHITE = '#FFFFFF';
const MUTED = '#888899';
const BORDER = '#EBEBEB';

export default function MyReviewsScreen({ navigation }) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadReviews = async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          id, rating, comment, created_at,
          worker_profiles (
            id,
            users (full_name, avatar_url)
          )
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (e) {
      console.warn('MyReviews load error:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadReviews(); }, [user?.id]));

  const renderItem = ({ item }) => (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{(item.worker_profiles?.users?.full_name || 'W')[0]?.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{item.worker_profiles?.users?.full_name || 'Worker'}</Text>
          <Text style={s.date}>{new Date(item.created_at).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
        </View>
        <View style={s.starsRow}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Ionicons key={i} name={i < item.rating ? 'star' : 'star-outline'} size={14} color={GOLD} />
          ))}
        </View>
      </View>
      {item.comment ? <Text style={s.comment}>{item.comment}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={WHITE} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Reviews</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={GOLD} style={{ marginTop: 60 }} />
      ) : reviews.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="star-outline" size={48} color="#DDD" />
          <Text style={s.emptyTitle}>No reviews yet</Text>
          <Text style={s.emptyText}>Reviews you leave for workers after a completed job will show up here.</Text>
        </View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WHITE },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: NAVY, paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { padding: 2 },
  headerTitle: { color: WHITE, fontSize: 17, fontWeight: '700' },
  card: { backgroundColor: '#F8F8FA', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: BORDER },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: GOLD, fontWeight: '700', fontSize: 14 },
  name: { fontSize: 14, fontWeight: '600', color: NAVY },
  date: { fontSize: 11.5, color: MUTED, marginTop: 1 },
  starsRow: { flexDirection: 'row', gap: 1 },
  comment: { fontSize: 13, color: '#444', marginTop: 10, lineHeight: 19 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: NAVY },
  emptyText: { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 19 },
});
