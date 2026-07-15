// © 2026 WiamApp. Powered by WiamLabs
// screens/WorkerProfileScreen.js
// Full worker profile — ratings, portfolio, WiamTrust, reviews, book/quote
// Backend: GET /api/workers/:id, GET /api/workers/:id/reviews

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView,
  ActivityIndicator, Image, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/colors';
import VerifiedBadge from '../components/VerifiedBadge';
import GoldAvatar from '../components/ui/GoldAvatar';

const { width } = Dimensions.get('window');
const PAD = Colors.screenPad;
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;
const GRID_GAP = 6;
const GRID_COLS = 3;
const PORT_ITEM = (width - PAD * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

export default function WorkerProfileScreen({ navigation, route }) {
  const { workerId } = route?.params || {};
  const [worker, setWorker] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [artistHandle, setArtistHandle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorker = async () => {
      try {
        const [wRes, rRes] = await Promise.all([
          fetch(`${BACKEND}/api/workers/${workerId}`),
          fetch(`${BACKEND}/api/workers/${workerId}/reviews?limit=5`),
        ]);
        const wData = await wRes.json();
        const rData = await rRes.json();
        setWorker(wData.data);
        setReviews(rData.data || []);
        if (wData.data?.id) {
          const aRes = await fetch(`${BACKEND}/api/artists/by-worker/${wData.data.id}`);
          const aData = await aRes.json();
          if (aData?.artist?.handle) setArtistHandle(aData.artist.handle);
        }
      } catch { /* empty */ } finally { setLoading(false); }
    };
    if (workerId) fetchWorker();
  }, [workerId]);

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator color={Colors.gold} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (!worker) {
    return (
      <SafeAreaView style={s.safe}>
        <TouchableOpacity style={s.floatBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color={Colors.white} />
        </TouchableOpacity>
        <View style={s.errorWrap}>
          <Text style={s.errorText}>Worker not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const reviewCount = reviews.length || worker.total_reviews || 0;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <View style={s.coverWrap}>
          <LinearGradient colors={[Colors.navySoft, '#0d0d24']} style={s.cover} />
          <TouchableOpacity style={[s.floatBtn, { top: 14, left: 14 }]} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.floatBtn, { top: 14, right: 14 }]}>
            <Ionicons name="bookmark-outline" size={16} color={Colors.white} />
          </TouchableOpacity>
        </View>

        <View style={s.profileBlock}>
          <GoldAvatar name={worker.full_name} uri={worker.avatar_url} size={76} online={worker.is_online} verified={worker.verified_badge} />

          <View style={s.nameRow}>
            <Text style={s.workerName}>{worker.full_name}</Text>
            {worker.verified_badge ? <VerifiedBadge color="blue" size={17} /> : null}
          </View>
          <Text style={s.roleLine}>{worker.category_name} · {worker.city}</Text>

          {worker.is_online ? (
            <View style={s.onlineBadge}>
              <View style={s.onlineDot} />
              <Text style={s.onlineText}>Available now</Text>
            </View>
          ) : null}

          <View style={s.quickStats}>
            <View style={s.qstat}>
              <Ionicons name="star" size={14} color={Colors.gold} />
              <Text style={s.qstatVal}>{worker.avg_rating?.toFixed(1) || '–'}</Text>
              {reviewCount > 0 ? <Text style={s.qstatSmall}>({reviewCount} reviews)</Text> : null}
            </View>
            <View style={s.qstat}>
              <Ionicons name="checkmark-done-outline" size={14} color={Colors.gold} />
              <Text style={s.qstatVal}>{worker.total_jobs || 0} jobs</Text>
            </View>
            <View style={s.qstat}>
              <Ionicons name="location-outline" size={14} color={Colors.gold} />
              <Text style={s.qstatVal}>{worker.city}</Text>
            </View>
          </View>
        </View>

        {worker.bio ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>About</Text>
            <Text style={s.bioText}>{worker.bio}</Text>
          </View>
        ) : null}

        {worker.skills?.length > 0 ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Skills</Text>
            <View style={s.skillChips}>
              {worker.skills.map((skill, i) => (
                <View key={i} style={s.skillChip}>
                  <Text style={s.skillText}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={s.section}>
          <Text style={s.sectionTitle}>Portfolio</Text>
          {worker.portfolio?.length > 0 ? (
            <View style={s.portfolioGrid}>
              {worker.portfolio.map((item, i) => (
                <View key={i} style={s.portfolioItem}>
                  <Image source={{ uri: item.image_url }} style={s.portfolioImage} resizeMode="cover" />
                </View>
              ))}
            </View>
          ) : (
            <Text style={s.emptyText}>No portfolio photos yet</Text>
          )}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Reviews ({reviewCount})</Text>
          {reviews.length > 0 ? (
            reviews.map((review, i) => (
              <View key={i} style={s.reviewCard}>
                <View style={s.reviewTop}>
                  <GoldAvatar name={review.customer_name} size={30} />
                  <Text style={s.reviewName}>{review.customer_name}</Text>
                  <View style={s.reviewStars}>
                    {Array.from({ length: 5 }, (_, si) => (
                      <Ionicons
                        key={si}
                        name={si < review.rating ? 'star' : 'star-outline'}
                        size={12}
                        color={si < review.rating ? Colors.gold : '#3E3E5C'}
                      />
                    ))}
                  </View>
                </View>
                {review.comment ? <Text style={s.reviewText}>{review.comment}</Text> : null}
              </View>
            ))
          ) : (
            <Text style={s.emptyText}>No reviews yet</Text>
          )}
        </View>

        <Text style={s.footerCopy}>© 2026 WiamApp · Powered by WiamLabs</Text>
      </ScrollView>

      <View style={s.bookBar}>
        <View style={s.priceBlock}>
          <Text style={s.priceFrom}>Starting from</Text>
          <Text style={s.priceAmount}>{worker.currency || 'GHS'} {worker.hourly_rate || '–'}</Text>
        </View>
        <TouchableOpacity
          style={s.quoteBtnSmall}
          onPress={() => navigation.navigate('QuoteRequest', { workerId: worker.id, workerName: worker.full_name })}
        >
          <Text style={s.quoteBtnSmallText}>Quote</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.bookBtn}
          onPress={() => {
            if (artistHandle) {
              navigation.navigate('ArtistBooking', { handle: artistHandle });
            } else {
              navigation.navigate('Booking', {
                workerId: worker.id,
                workerName: worker.full_name,
                hourlyRate: worker.hourly_rate,
              });
            }
          }}
          activeOpacity={0.85}
        >
          <Text style={s.bookBtnText}>{artistHandle ? 'Book Artist' : 'Book Now'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.navy },
  scroll: { paddingBottom: 100 },
  coverWrap: { marginHorizontal: PAD, position: 'relative' },
  cover: { height: 150, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  floatBtn: {
    position: 'absolute', width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(8,8,26,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  profileBlock: { paddingHorizontal: PAD, marginTop: -38 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  workerName: { fontSize: 19, fontWeight: '700', color: Colors.white },
  roleLine: { fontSize: 12.5, color: Colors.textDim, marginTop: 3, marginBottom: 10 },
  onlineBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    backgroundColor: 'rgba(34,197,94,0.12)', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, marginBottom: 16,
  },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  onlineText: { fontSize: 11, fontWeight: '600', color: Colors.success },
  quickStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginBottom: 8 },
  qstat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  qstatVal: { fontSize: 12.5, fontWeight: '600', color: Colors.white },
  qstatSmall: { fontSize: 10.5, color: Colors.textFaint },
  section: { paddingHorizontal: PAD, marginBottom: 20 },
  sectionTitle: { fontSize: 14.5, fontWeight: '600', color: Colors.white, marginBottom: 10 },
  bioText: { fontSize: 12.5, color: '#B8B8CC', lineHeight: 20 },
  skillChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  skillChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: Colors.navyCard, borderWidth: 1, borderColor: Colors.navyLine,
  },
  skillText: { fontSize: 11.5, color: '#C9C9DE' },
  portfolioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  portfolioItem: { width: PORT_ITEM, height: PORT_ITEM, borderRadius: 12, overflow: 'hidden' },
  portfolioImage: { width: '100%', height: '100%' },
  reviewCard: {
    backgroundColor: Colors.navyCard, borderWidth: 1, borderColor: Colors.navyLine,
    borderRadius: 16, padding: 13, marginBottom: 10,
  },
  reviewTop: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 6 },
  reviewName: { fontSize: 12.5, fontWeight: '600', color: Colors.white, flex: 1 },
  reviewStars: { flexDirection: 'row', gap: 1 },
  reviewText: { fontSize: 12, color: '#B8B8CC', lineHeight: 18 },
  emptyText: { fontSize: 13, color: Colors.textFaint },
  footerCopy: { textAlign: 'center', fontSize: 10, color: '#3A3A56', paddingVertical: 12 },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: Colors.textDim, fontSize: 15 },
  bookBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.navySoft, borderTopWidth: 1, borderTopColor: '#1C1C38',
    paddingHorizontal: PAD, paddingVertical: 16, minHeight: 92,
  },
  priceBlock: { flexShrink: 0 },
  priceFrom: { fontSize: 10, color: Colors.textFaint },
  priceAmount: { fontSize: 16, fontWeight: '700', color: Colors.gold },
  quoteBtnSmall: {
    paddingHorizontal: 14, paddingVertical: 14, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.navyLine,
  },
  quoteBtnSmallText: { color: '#C9C9DE', fontSize: 13, fontWeight: '600' },
  bookBtn: {
    flex: 1, backgroundColor: Colors.gold, borderRadius: 16,
    paddingVertical: 14, alignItems: 'center',
  },
  bookBtnText: { color: Colors.navy, fontSize: 14, fontWeight: '700' },
});
