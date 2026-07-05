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
import VerifiedBadge from '../components/VerifiedBadge';

const { width } = Dimensions.get('window');

const BG      = '#FFFFFF';
const NAVY    = '#0D0D2B';
const GOLD    = '#D4A017';
const GOLD_BG = 'rgba(212,160,23,0.10)';
const GOLD_BD = 'rgba(212,160,23,0.25)';
const BORDER  = '#EBEBEB';
const MUTED   = '#888899';
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function WorkerProfileScreen({ navigation, route }) {
  const { workerId } = route?.params || {};
  const [worker,  setWorker]  = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('about'); // about | portfolio | reviews

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
      } catch { } finally { setLoading(false); }
    };
    if (workerId) fetchWorker();
  }, [workerId]);

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator color={GOLD} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (!worker) {
    return (
      <SafeAreaView style={s.safe}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={NAVY} />
        </TouchableOpacity>
        <View style={s.errorWrap}>
          <Text style={s.errorText}>Worker not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const stars = Array.from({ length: 5 }, (_, i) => i < Math.round(worker.avg_rating || 0));

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {/* Fixed header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={NAVY} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{worker.full_name}</Text>
        <TouchableOpacity>
          <Ionicons name="share-social-outline" size={22} color={NAVY} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Profile section */}
        <View style={s.profileSection}>
          <View style={s.avatarWrap}>
            {worker.avatar_url
              ? <Image source={{ uri: worker.avatar_url }} style={s.avatar} />
              : <View style={[s.avatar, s.avatarFallback]}>
                  <Text style={s.avatarInitial}>{worker.full_name?.[0]?.toUpperCase()}</Text>
                </View>
            }
            {worker.is_online && (
              <View style={s.onlineBadge}>
                <View style={s.onlineDot} />
                <Text style={s.onlineText}>Online</Text>
              </View>
            )}
          </View>

          <Text style={s.workerName}>{worker.full_name}</Text>
          <Text style={s.workerCategory}>{worker.category_name}</Text>

          {/* Badge — earned Checkmark only (Section 4B). Identity-check
              status is never shown here; every worker a customer can
              see has already passed it, so showing it would be noise. */}
          {worker.verified_badge && (
            <View style={s.badgesRow}>
              <View style={s.subBadge}>
                <VerifiedBadge color="blue" size={13} />
                {(worker.subscription_tier === 'pro' || worker.subscription_tier === 'basic') && (
                  <Text style={s.subBadgeText}>
                    {worker.subscription_tier === 'pro' ? 'Pro Worker' : 'Basic Worker'}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Stats row */}
          <View style={s.statsCard}>
            <View style={s.statItem}>
              <Text style={s.statValue}>{worker.avg_rating?.toFixed(1) || '–'}</Text>
              <View style={s.starsRow}>
                {stars.map((filled, i) => (
                  <Ionicons key={i} name={filled ? 'star' : 'star-outline'} size={10} color={GOLD} />
                ))}
              </View>
              <Text style={s.statLabel}>Rating</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statValue}>{worker.total_jobs || 0}</Text>
              <Text style={s.statLabel}>Jobs done</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statValue}>{worker.wiam_trust_score || 0}</Text>
              <Ionicons name="heart" size={12} color="#EF4444" style={{ marginBottom: 2 }} />
              <Text style={s.statLabel}>WiamTrust</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statValue}>{worker.city}</Text>
              <Text style={s.statLabel}>Location</Text>
            </View>
          </View>

          {/* Rate */}
          <View style={s.rateCard}>
            <View>
              <Text style={s.rateAmount}>
                {worker.currency || 'GHS'} {worker.hourly_rate || '–'}/hr
              </Text>
              <Text style={s.rateNote}>Starting rate · Final price agreed in chat</Text>
            </View>
            <View style={s.responseRow}>
              <Ionicons name="time-outline" size={13} color={MUTED} />
              <Text style={s.responseText}>
                Responds in ~{worker.avg_response_time || '30'} min
              </Text>
            </View>
          </View>
        </View>

        {/* Tab navigation */}
        <View style={s.tabs}>
          {['about', 'portfolio', 'reviews'].map(t => (
            <TouchableOpacity
              key={t}
              style={[s.tab, tab === t && s.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
                {t === 'reviews' && reviews.length > 0 ? ` (${reviews.length})` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        <View style={s.tabContent}>

          {/* About tab */}
          {tab === 'about' && (
            <View>
              {worker.bio ? (
                <>
                  <Text style={s.sectionLabel}>About</Text>
                  <Text style={s.bioText}>{worker.bio}</Text>
                </>
              ) : null}

              {worker.skills?.length > 0 && (
                <>
                  <Text style={s.sectionLabel}>Skills</Text>
                  <View style={s.skillsWrap}>
                    {worker.skills.map((skill, i) => (
                      <View key={i} style={s.skillChip}>
                        <Text style={s.skillText}>{skill}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              <Text style={s.sectionLabel}>Location</Text>
              <View style={s.locationRow}>
                <Ionicons name="location-outline" size={15} color={GOLD} />
                <Text style={s.locationText}>{worker.city}, {worker.country || 'Ghana'}</Text>
              </View>

              <Text style={s.sectionLabel}>Member since</Text>
              <Text style={s.memberText}>
                {worker.created_at
                  ? new Date(worker.created_at).toLocaleDateString('en-GB', { year: 'numeric', month: 'long' })
                  : '–'}
              </Text>
            </View>
          )}

          {/* Portfolio tab */}
          {tab === 'portfolio' && (
            <View>
              {worker.portfolio?.length > 0 ? (
                <View style={s.portfolioGrid}>
                  {worker.portfolio.map((item, i) => (
                    <View key={i} style={s.portfolioItem}>
                      <Image source={{ uri: item.image_url }} style={s.portfolioImage} resizeMode="cover" />
                      {item.caption ? (
                        <Text style={s.portfolioCaption} numberOfLines={2}>{item.caption}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : (
                <View style={s.emptyTab}>
                  <Ionicons name="images-outline" size={36} color="#DDD" />
                  <Text style={s.emptyTabText}>No portfolio photos yet</Text>
                </View>
              )}
            </View>
          )}

          {/* Reviews tab */}
          {tab === 'reviews' && (
            <View>
              {reviews.length > 0 ? (
                reviews.map((review, i) => (
                  <View key={i} style={s.reviewCard}>
                    <View style={s.reviewHeader}>
                      <View style={s.reviewAvatar}>
                        <Text style={s.reviewAvatarText}>
                          {review.customer_name?.[0]?.toUpperCase() || 'C'}
                        </Text>
                      </View>
                      <View style={s.reviewInfo}>
                        <Text style={s.reviewName}>{review.customer_name}</Text>
                        <View style={s.reviewStars}>
                          {Array.from({ length: 5 }, (_, si) => (
                            <Ionicons
                              key={si}
                              name={si < review.rating ? 'star' : 'star-outline'}
                              size={11}
                              color={GOLD}
                            />
                          ))}
                        </View>
                      </View>
                      <Text style={s.reviewDate}>
                        {new Date(review.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                    {review.comment ? (
                      <Text style={s.reviewComment}>{review.comment}</Text>
                    ) : null}
                  </View>
                ))
              ) : (
                <View style={s.emptyTab}>
                  <Ionicons name="star-outline" size={36} color="#DDD" />
                  <Text style={s.emptyTabText}>No reviews yet</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed bottom action buttons */}
      <View style={s.bottomActions}>
        <TouchableOpacity
          style={s.quoteBtn}
          onPress={() => navigation.navigate('QuoteRequest', { workerId: worker.id, workerName: worker.full_name })}
          activeOpacity={0.85}
        >
          <Ionicons name="document-text-outline" size={17} color={NAVY} />
          <Text style={s.quoteBtnText}>Get Quote</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.bookBtn}
          onPress={() => navigation.navigate('Booking', { workerId: worker.id, workerName: worker.full_name, hourlyRate: worker.hourly_rate })}
          activeOpacity={0.85}
        >
          <Text style={s.bookBtnText}>Book Now</Text>
          <Ionicons name="arrow-forward" size={17} color={NAVY} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: BORDER,
  },
  headerTitle: { color: NAVY, fontSize: 16, fontWeight: '600', flex: 1, textAlign: 'center' },
  backBtn:     { padding: 4 },
  errorWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText:   { color: MUTED, fontSize: 15 },

  profileSection: { paddingHorizontal: 20, paddingTop: 20, alignItems: 'center' },
  avatarWrap:     { position: 'relative', marginBottom: 12 },
  avatar:         { width: 90, height: 90, borderRadius: 22 },
  avatarFallback: { backgroundColor: GOLD_BG, alignItems: 'center', justifyContent: 'center' },
  avatarInitial:  { color: GOLD, fontSize: 32, fontWeight: '700' },
  onlineBadge: {
    position: 'absolute', bottom: -4, left: '50%',
    transform: [{ translateX: -28 }],
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F0FFF4', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 0.5, borderColor: '#BBF7D0',
  },
  onlineDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' },
  onlineText: { color: '#16A34A', fontSize: 10, fontWeight: '600' },

  workerName:     { color: NAVY, fontSize: 20, fontWeight: '700', marginBottom: 4, marginTop: 8 },
  workerCategory: { color: MUTED, fontSize: 14, marginBottom: 10 },
  badgesRow:      { flexDirection: 'row', gap: 8, marginBottom: 16 },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F0FFF4', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 0.5, borderColor: '#BBF7D0',
  },
  verifiedText: { color: '#16A34A', fontSize: 11, fontWeight: '600' },
  subBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: GOLD_BG, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 0.5, borderColor: GOLD_BD },
  subBadgeText: { color: GOLD, fontSize: 11, fontWeight: '700' },

  statsCard: {
    flexDirection: 'row', backgroundColor: '#F8F8FB',
    borderRadius: 14, padding: 14, width: '100%',
    marginBottom: 14, borderWidth: 0.5, borderColor: BORDER,
  },
  statItem:    { flex: 1, alignItems: 'center' },
  statDivider: { width: 0.5, backgroundColor: BORDER, marginVertical: 4 },
  statValue:   { color: NAVY, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  starsRow:    { flexDirection: 'row', gap: 1, marginBottom: 2 },
  statLabel:   { color: MUTED, fontSize: 10, textAlign: 'center' },

  rateCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F8F8FB', borderRadius: 13,
    padding: 14, width: '100%', marginBottom: 16,
    borderWidth: 0.5, borderColor: BORDER,
  },
  rateAmount:  { color: GOLD, fontSize: 18, fontWeight: '700', marginBottom: 2 },
  rateNote:    { color: MUTED, fontSize: 11 },
  responseRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  responseText:{ color: MUTED, fontSize: 12 },

  tabs: {
    flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: BORDER,
    marginTop: 4,
  },
  tab:          { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive:    { borderBottomWidth: 2, borderBottomColor: GOLD },
  tabText:      { color: MUTED, fontSize: 13, fontWeight: '500' },
  tabTextActive:{ color: NAVY, fontWeight: '700' },

  tabContent:    { padding: 20 },
  sectionLabel:  { color: MUTED, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 14 },
  bioText:       { color: NAVY, fontSize: 14, lineHeight: 22 },
  skillsWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillChip:     { backgroundColor: '#F0F0F8', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  skillText:     { color: NAVY, fontSize: 12 },
  locationRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationText:  { color: NAVY, fontSize: 14 },
  memberText:    { color: NAVY, fontSize: 14 },

  portfolioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  portfolioItem: { width: (width - 56) / 2 },
  portfolioImage:{ width: '100%', height: 140, borderRadius: 10 },
  portfolioCaption:{ color: MUTED, fontSize: 11, marginTop: 4 },

  reviewCard: {
    backgroundColor: '#F8F8FB', borderRadius: 12,
    padding: 14, marginBottom: 10,
    borderWidth: 0.5, borderColor: BORDER,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  reviewAvatar: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: GOLD_BG, alignItems: 'center', justifyContent: 'center',
  },
  reviewAvatarText: { color: GOLD, fontSize: 14, fontWeight: '700' },
  reviewInfo:   { flex: 1 },
  reviewName:   { color: NAVY, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  reviewStars:  { flexDirection: 'row', gap: 1 },
  reviewDate:   { color: MUTED, fontSize: 11 },
  reviewComment:{ color: NAVY, fontSize: 13, lineHeight: 20 },

  emptyTab:     { alignItems: 'center', paddingVertical: 32 },
  emptyTabText: { color: MUTED, fontSize: 14, marginTop: 10 },

  bottomActions: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 0.5, borderTopColor: BORDER,
    backgroundColor: BG,
  },
  quoteBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 13,
    borderWidth: 1.5, borderColor: NAVY,
  },
  quoteBtnText: { color: NAVY, fontSize: 14, fontWeight: '700' },
  bookBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 13,
    backgroundColor: GOLD,
  },
  bookBtnText: { color: NAVY, fontSize: 15, fontWeight: '700' },
});
