/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 (Text Edition park).
 * Do not wire into active navigation. Pending possible future Text Edition.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Linking,
} from 'react-native';
import CachedImage from '../../components/common/CachedImage';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import AppBackground from '../../components/AppBackground';
import SkeletonLoader from '../../components/common/SkeletonLoader';
import creatorApi from '../../api/creator';
import useAuthStore from '../../store/useAuthStore';
import {
  BookPlus,
  Coins,
  Users,
  ChevronRight,
  Plus,
  Eye,
  Star,
  BookOpen,
  PenLine,
  ImagePlus,
  Megaphone,
  Crown,
  CheckCircle2,
  Circle,
} from 'lucide-react-native';
import BrandedFooter from '../../components/BrandedFooter';
import AdBanner from '../../components/ads/AdBanner';
import { useFocusEffect } from '@react-navigation/native';
import StudioBackHomeRow from '../../components/studio/StudioBackHomeRow';

const StudioDashboardScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ views: 0, followers: 0, earnings: 0, stories: 0, rating: 0 });
  const [stories, setStories] = useState([]);

  useFocusEffect(
    useCallback(() => {
      const u = useAuthStore.getState().user;
      if (!u?.is_creator) {
        navigation.navigate('Main');
      }
    }, [navigation])
  );

  const fetchData = async () => {
    try {
      const [dashRes, storiesRes] = await Promise.all([
        creatorApi.getDashboard().catch(() => ({})),
        creatorApi.getMyStories().catch(() => ({ stories: [] })),
      ]);
      setStats({
        views: dashRes.total_views || 0,
        followers: dashRes.followers_count || 0,
        earnings: dashRes.total_earnings || 0,
        stories: dashRes.stories_count || 0,
        rating: dashRes.avg_rating || 0,
      });
      setStories(storiesRes.stories || []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchData(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const fmt = (n) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
  };

  const statusColor = (s) => {
    if (s === 'published' || s === 'complete') return '#2ecc71';
    if (s === 'draft') return COLORS.textMuted;
    if (s === 'ongoing') return '#5dade2';
    return '#f39c12';
  };

  if (loading) {
    return (
      <AppBackground>
        <View style={styles.loadingWrap}>
          <SkeletonLoader.ListItem count={5} />
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.secondary} />}
      >
        <StudioBackHomeRow navigation={navigation} title="Editor" />
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>WiamStudio</Text>
            <Text style={styles.subtitle}>Your creative workspace</Text>
          </View>
          <TouchableOpacity style={styles.createBtn} onPress={() => navigation.navigate('NewStory')}>
            <Plus color={COLORS.black} size={20} strokeWidth={3} />
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(96,165,250,0.12)' }]}>
              <Eye color="#60a5fa" size={18} />
            </View>
            <Text style={styles.statValue}>{fmt(stats.views)}</Text>
            <Text style={styles.statLabel}>Views</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(212,168,67,0.12)' }]}>
              <Users color={COLORS.secondary} size={18} />
            </View>
            <Text style={styles.statValue}>{fmt(stats.followers)}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <TouchableOpacity style={styles.statCard} activeOpacity={0.7} onPress={() => navigation.navigate('Earnings')}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(76,175,80,0.12)' }]}>
              <Coins color="#4caf50" size={18} />
            </View>
            <Text style={styles.statValue}>₵{stats.earnings.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Earnings</Text>
          </TouchableOpacity>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(251,146,60,0.12)' }]}>
              <Star color="#fb923c" size={18} />
            </View>
            <Text style={styles.statValue}>{stats.rating > 0 ? stats.rating.toFixed(1) : '—'}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>

        {/* Create New Story CTA */}
        <TouchableOpacity style={styles.createStoryBtn} onPress={() => navigation.navigate('NewStory')}>
          <PenLine color={COLORS.black} size={20} />
          <Text style={styles.createStoryText}>Create New Story</Text>
        </TouchableOpacity>

        {/* My Stories */}
        <View style={styles.section}>
          <View style={styles.secHead}>
            <Text style={styles.sectionTitle}>MY STORIES</Text>
            <Text style={styles.seeAll}>{stories.length} {stories.length === 1 ? 'story' : 'stories'}</Text>
          </View>

          {stories.length === 0 && (
            <View style={styles.emptyState}>
              <BookOpen color={COLORS.textMuted} size={44} />
              <Text style={styles.emptyTitle}>No stories yet</Text>
              <Text style={styles.emptyText}>
                Start writing your first story and share it with readers around the world.
              </Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('NewStory')}>
                <Plus color={COLORS.black} size={18} />
                <Text style={styles.emptyBtnText}>Write Your First Story</Text>
              </TouchableOpacity>
            </View>
          )}

          {stories.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={styles.storyCard}
              onPress={() => navigation.navigate('StoryManager', { bookId: s.id })}
              activeOpacity={0.7}
            >
              {/* Cover */}
              {s.cover_url ? (
                <CachedImage source={{ uri: s.cover_url }} style={styles.storyCover} />
              ) : (
                <View style={[styles.storyCover, styles.coverPlaceholder]}>
                  <ImagePlus color={COLORS.textMuted} size={20} />
                </View>
              )}
              {/* Info */}
              <View style={styles.storyInfo}>
                <Text style={styles.storyTitle} numberOfLines={1}>{s.title}</Text>
                {s.genre ? <Text style={styles.storyGenre}>{s.genre}</Text> : null}
                <View style={styles.storyMetaRow}>
                  <Text style={styles.storyMeta}>{s.chapter_count || 0} ch</Text>
                  <View style={styles.metaDot} />
                  <Text style={styles.storyMeta}>{fmt(s.views || 0)} views</Text>
                  {s.word_count ? (
                    <>
                      <View style={styles.metaDot} />
                      <Text style={styles.storyMeta}>{fmt(s.word_count)} words</Text>
                    </>
                  ) : null}
                </View>
              </View>
              {/* Status + Arrow */}
              <View style={styles.storyRight}>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(s.status) + '18' }]}>
                  <Text style={[styles.statusText, { color: statusColor(s.status) }]}>
                    {(s.status || 'draft').toUpperCase()}
                  </Text>
                </View>
                <ChevronRight color={COLORS.textMuted} size={18} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Creator Tools */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CREATOR TOOLS</Text>
          <TouchableOpacity style={styles.toolRow} onPress={() => navigation.navigate('NewStory')}>
            <View style={[styles.toolIcon, { backgroundColor: 'rgba(212,168,67,0.12)' }]}>
              <BookPlus color={COLORS.secondary} size={20} />
            </View>
            <Text style={styles.toolLabel}>New Story</Text>
            <ChevronRight color={COLORS.textMuted} size={18} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolRow} onPress={() => navigation.navigate('Earnings')}>
            <View style={[styles.toolIcon, { backgroundColor: 'rgba(76,175,80,0.12)' }]}>
              <Coins color="#4caf50" size={20} />
            </View>
            <Text style={styles.toolLabel}>Earnings & Payouts</Text>
            <ChevronRight color={COLORS.textMuted} size={18} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolRow} onPress={() => navigation.navigate('Bulletin')}>
            <View style={[styles.toolIcon, { backgroundColor: 'rgba(96,165,250,0.12)' }]}>
              <Megaphone color="#60a5fa" size={20} />
            </View>
            <Text style={styles.toolLabel}>Bulletin Posts</Text>
            <ChevronRight color={COLORS.textMuted} size={18} />
          </TouchableOpacity>
        </View>

        {/* Creator Subscription Eligibility */}
        <View style={styles.eligibilityCard}>
          <View style={styles.eligibilityHeader}>
            <Text style={styles.eligibilityTitle}>Creator Subscriptions</Text>
            <View style={[styles.eligBadge,
              stats.followers >= 150 && stats.stories >= 1 && stats.views >= 500 && styles.eligBadgeActive
            ]}>
              <Text style={[styles.eligBadgeText,
                stats.followers >= 150 && stats.stories >= 1 && stats.views >= 500 && styles.eligBadgeTextActive
              ]}>
                {stats.followers >= 150 && stats.stories >= 1 && stats.views >= 500 ? 'ELIGIBLE' : 'IN PROGRESS'}
              </Text>
            </View>
          </View>
          <Text style={styles.eligibilityText}>
            Meet these milestones to offer subscription tiers and earn recurring revenue from your readers.
          </Text>

          {/* Criteria checklist */}
          {[
            { label: '150+ followers', met: stats.followers >= 150, progress: `${stats.followers}/150` },
            { label: '1 published book', met: stats.stories >= 1, progress: `${stats.stories}/1` },
            { label: '500+ total views', met: stats.views >= 500, progress: `${stats.views}/500` },
            { label: '30-day account age', met: true, progress: '' },
          ].map((req, i) => (
            <View key={i} style={styles.eligRow}>
              {req.met
                ? <CheckCircle2 size={16} color="#2ecc71" />
                : <Circle size={16} color={COLORS.textMuted} />}
              <Text style={[styles.eligRowLabel, req.met && { color: '#2ecc71' }]}>{req.label}</Text>
              {req.progress ? <Text style={styles.eligRowProgress}>{req.progress}</Text> : null}
            </View>
          ))}

          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min(100, Math.round(
              ((Math.min(stats.followers, 150) / 150 + Math.min(stats.stories, 1) + Math.min(stats.views, 500) / 500 + 1) / 4) * 100
            ))}%` }]} />
          </View>
          <Text style={styles.eligRevenueNote}>70% creator / 30% platform revenue split</Text>
        </View>

        <AdBanner placement="studio" navigation={navigation} />

        <BrandedFooter compact />
        <View style={styles.spacer} />
      </ScrollView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.lg },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: SPACING.xl, marginBottom: SPACING.lg,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.secondary, fontFamily: FONTS.display },
  subtitle: { fontSize: 14, color: COLORS.textMuted, marginTop: 3 },
  createBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.lg,
  },
  statCard: {
    width: '23%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: RADIUS.md,
    paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  statIcon: {
    width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  statValue: { fontSize: 16, fontWeight: 'bold', color: COLORS.white },
  statLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  createStoryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.secondary, paddingVertical: 14, borderRadius: RADIUS.md, marginBottom: SPACING.xl,
  },
  createStoryText: { color: COLORS.black, fontSize: 16, fontWeight: 'bold' },
  section: { marginBottom: SPACING.xl },
  secHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  sectionTitle: {
    fontSize: 13, fontWeight: 'bold', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.2,
  },
  seeAll: { fontSize: 12, color: COLORS.textMuted },
  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.white, marginTop: 14 },
  emptyText: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 19, maxWidth: 260 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.secondary, paddingVertical: 12, paddingHorizontal: 20,
    borderRadius: RADIUS.md, marginTop: 18,
  },
  emptyBtnText: { color: COLORS.black, fontSize: 14, fontWeight: '700' },
  storyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: RADIUS.md,
    padding: 10, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  storyCover: {
    width: 56, height: 84, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)',
  },
  coverPlaceholder: {
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderStyle: 'dashed',
  },
  storyInfo: { flex: 1, minWidth: 0 },
  storyTitle: { fontSize: 15, fontWeight: '600', color: COLORS.white },
  storyGenre: { fontSize: 11, color: COLORS.secondary, fontWeight: '600', marginTop: 3 },
  storyMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  storyMeta: { fontSize: 11, color: COLORS.textMuted },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 6 },
  storyRight: { alignItems: 'flex-end', gap: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  toolRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.03)', padding: SPACING.md,
    borderRadius: RADIUS.md, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  toolIcon: {
    width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  toolLabel: { flex: 1, fontSize: 15, color: COLORS.white, fontWeight: '500' },
  eligibilityCard: {
    backgroundColor: 'rgba(114,47,55,0.12)', borderRadius: RADIUS.lg,
    padding: SPACING.lg, borderWidth: 1, borderColor: 'rgba(114,47,55,0.25)', marginBottom: SPACING.lg,
  },
  eligibilityHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
  eligibilityTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.white },
  eligBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 5,
  },
  eligBadgeActive: { backgroundColor: 'rgba(46,204,113,0.15)' },
  eligBadgeText: { fontSize: 10, fontWeight: 'bold', color: COLORS.textMuted },
  eligBadgeTextActive: { color: '#2ecc71' },
  eligibilityText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19, marginBottom: 12 },
  progressBar: {
    height: 5, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, marginBottom: 10,
  },
  progressFill: { height: '100%', backgroundColor: COLORS.secondary, borderRadius: 3 },
  eligReqs: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  eligReqItem: { fontSize: 11, color: COLORS.textMuted },
  eligLink: { color: COLORS.secondary, fontWeight: '600', fontSize: 13 },
  eligRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8,
  },
  eligRowLabel: { fontSize: 13, color: COLORS.textMuted, flex: 1 },
  eligRowProgress: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  eligRevenueNote: { fontSize: 11, color: COLORS.secondary, fontWeight: '600', marginTop: 6 },
  spacer: { height: 100 },
});

export default StudioDashboardScreen;
