import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { COLORS, SPACING, RADIUS, FONTS } from '../../constants/theme';
import AppBackground from '../../components/AppBackground';
import eliteApi from '../../api/elite';
import { ChevronLeft, Trophy, Star, Eye, BookOpen, Users, Crown, Flame, Award } from 'lucide-react-native';
import SkeletonLoader from '../../components/common/SkeletonLoader';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - SPACING.lg * 2;

const formatNumber = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const WiamEliteScreen = ({ navigation }) => {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await eliteApi.getLeaderboard();
      setStories(res.elite_stories || []);
    } catch (err) {
      console.warn('Elite fetch error:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const renderRankBadge = (index) => {
    const medals = ['#FFD700', '#C0C0C0', '#CD7F32'];
    if (index < 3) {
      return (
        <View style={[styles.rankBadge, { backgroundColor: medals[index] + '30', borderColor: medals[index] }]}>
          <Trophy size={14} color={medals[index]} />
          <Text style={[styles.rankText, { color: medals[index] }]}>#{index + 1}</Text>
        </View>
      );
    }
    return (
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>#{index + 1}</Text>
      </View>
    );
  };

  const renderStoryCard = (story, index) => (
    <TouchableOpacity
      key={story.id}
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => navigation.navigate('BookDetail', { bookId: story.id })}
    >
      <LinearGradient
        colors={index === 0
          ? ['rgba(212, 168, 67, 0.15)', 'rgba(212, 168, 67, 0.03)']
          : ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.01)']}
        style={styles.cardGradient}
      >
        <View style={styles.cardTop}>
          {renderRankBadge(index)}
          {story.elite_streak_days > 0 && (
            <View style={styles.streakBadge}>
              <Flame size={12} color="#ff6b35" />
              <Text style={styles.streakText}>{story.elite_streak_days}d streak</Text>
            </View>
          )}
        </View>

        <View style={styles.cardBody}>
          {story.cover_image ? (
            <Image source={{ uri: story.cover_image }} style={styles.cover} />
          ) : (
            <View style={[styles.cover, styles.coverPlaceholder]}>
              <BookOpen size={28} color={COLORS.textMuted} />
            </View>
          )}

          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle} numberOfLines={2}>{story.title}</Text>
            <Text style={styles.cardAuthor} numberOfLines={1}>
              by {story.author || story.creator?.name || 'Unknown'}
            </Text>
            {story.genre ? <Text style={styles.cardGenre}>{story.genre}</Text> : null}

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Eye size={13} color={COLORS.secondary} />
                <Text style={styles.statText}>{formatNumber(story.total_reads)}</Text>
              </View>
              <View style={styles.stat}>
                <Star size={13} color={COLORS.secondary} />
                <Text style={styles.statText}>{story.avg_rating?.toFixed(1) || '0'}</Text>
              </View>
              <View style={styles.stat}>
                <Users size={13} color={COLORS.secondary} />
                <Text style={styles.statText}>{formatNumber(story.unique_readers)}</Text>
              </View>
              <View style={styles.stat}>
                <BookOpen size={13} color={COLORS.secondary} />
                <Text style={styles.statText}>{story.chapter_count} ch</Text>
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <AppBackground>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Crown size={20} color={COLORS.secondary} />
          <Text style={styles.headerTitle}>WiamElite</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Hero Banner */}
      <LinearGradient
        colors={['rgba(212, 168, 67, 0.12)', 'transparent']}
        style={styles.heroBanner}
      >
        <Award size={36} color={COLORS.secondary} />
        <Text style={styles.heroTitle}>Hall of Fame</Text>
        <Text style={styles.heroSubtitle}>
          The highest honor on WiamApp. Only the most extraordinary stories earn Elite status.
        </Text>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{stories.length}</Text>
            <Text style={styles.heroStatLabel}>Elite Stories</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>17</Text>
            <Text style={styles.heroStatLabel}>Criteria</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>6mo</Text>
            <Text style={styles.heroStatLabel}>Sustained</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.secondary} />}
      >
        {loading ? (
          <SkeletonLoader.ListItem count={5} />
        ) : stories.length === 0 ? (
          <View style={styles.emptyState}>
            <Trophy size={64} color={COLORS.textMuted} strokeWidth={1} />
            <Text style={styles.emptyTitle}>No Elite Stories Yet</Text>
            <Text style={styles.emptySubtitle}>
              When stories meet all 17 thresholds for 6 consecutive months, they'll appear here as legends.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Leaderboard</Text>
            {stories.map((story, i) => renderStoryCard(story, i))}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: 50,
    paddingBottom: SPACING.sm,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  headerTitle: {
    fontSize: 20, fontWeight: '700', color: COLORS.secondary,
    fontFamily: FONTS.display,
  },
  heroBanner: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 168, 67, 0.15)',
  },
  heroTitle: {
    fontSize: 22, fontWeight: '700', color: COLORS.text,
    fontFamily: FONTS.display, marginTop: SPACING.sm,
  },
  heroSubtitle: {
    fontSize: 13, color: COLORS.textSecondary, textAlign: 'center',
    marginTop: SPACING.xs, lineHeight: 18,
  },
  heroStats: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: SPACING.md, gap: SPACING.md,
  },
  heroStat: { alignItems: 'center' },
  heroStatValue: { fontSize: 18, fontWeight: '700', color: COLORS.secondary },
  heroStatLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  heroDivider: { width: 1, height: 28, backgroundColor: COLORS.border },

  container: { flex: 1 },
  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },

  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: COLORS.text,
    marginBottom: SPACING.md,
  },

  card: {
    marginBottom: SPACING.md,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardGradient: {
    padding: SPACING.md,
  },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: SPACING.sm,
  },
  rankBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: COLORS.border,
  },
  rankText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  streakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255, 107, 53, 0.12)',
  },
  streakText: { fontSize: 11, color: '#ff6b35', fontWeight: '600' },

  cardBody: { flexDirection: 'row', gap: SPACING.md },
  cover: {
    width: 80, height: 110, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
  },
  coverPlaceholder: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, lineHeight: 21 },
  cardAuthor: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  cardGenre: {
    fontSize: 11, color: COLORS.secondary, fontWeight: '600',
    marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm,
    flexWrap: 'wrap',
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, color: COLORS.textMuted },

  emptyState: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyTitle: {
    fontSize: 18, fontWeight: '700', color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: 13, color: COLORS.textMuted, textAlign: 'center',
    marginTop: SPACING.xs, paddingHorizontal: SPACING.xl, lineHeight: 18,
  },
});

export default WiamEliteScreen;
