/**
 * StoryAnalyticsScreen — per-book engagement dashboard for creators.
 *
 * Backed by GET /api/v1/creator/stories/<id>/analytics. Renders:
 *   - Headline KPIs (views, favorites, ratings, chapters).
 *   - 30-day daily-view sparkline (lightweight, no charting library).
 *   - Engagement breakdown (favorites, ratings, comments, shares
 *     in the last 30 days from the AnalyticsEvent log).
 *   - Popularity score component bars (view / rating / favorite /
 *     freshness) so creators can see what is actually pushing their
 *     book up the home rails.
 *
 * Designed so it looks like part of WiamStudio (gold/wine palette) and
 * works whether the analytics table is empty or full.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import studioApi from '../../api/studio';
import formatNumber from '../../utils/formatNumber';
import {
  ArrowLeft, Eye, Heart, Star, MessageCircle, Share2, BookOpen,
  TrendingUp, Sparkles, House,
} from 'lucide-react-native';

const StoryAnalyticsScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { bookId, title } = route.params || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await studioApi.getStoryAnalytics(bookId);
      setData(res);
    } catch (e) {
      setError(typeof e === 'string' ? e : e?.message || 'Failed to load analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bookId]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = data?.totals || {};
  const popularity = data?.popularity;
  const daily = data?.daily_views || [];

  const maxDaily = useMemo(() => {
    return Math.max(1, ...daily.map((d) => d.views || 0));
  }, [daily]);

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.headBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={20} color={COLORS.white} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Main')} style={styles.backBtn}>
          <House size={18} color={COLORS.secondary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headTitle} numberOfLines={1}>
            {data?.book?.title || title || 'Analytics'}
          </Text>
          <Text style={styles.headSub}>Story analytics</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.secondary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={COLORS.secondary}
            />
          }
        >
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.kpiGrid}>
            <Kpi
              icon={<Eye size={16} color="#fde68a" />}
              label="All-time views"
              value={formatNumber(totals.views || 0)}
            />
            <Kpi
              icon={<TrendingUp size={16} color="#22d3ee" />}
              label="Views (30d)"
              value={formatNumber(totals.views_last_30d || 0)}
            />
            <Kpi
              icon={<Heart size={16} color="#f472b6" />}
              label="Favorites"
              value={formatNumber(totals.favorites || 0)}
            />
            <Kpi
              icon={<Star size={16} color="#facc15" />}
              label={`Avg rating · ${totals.ratings || 0}`}
              value={(totals.rating_avg || 0).toFixed(1)}
            />
            <Kpi
              icon={<MessageCircle size={16} color="#a78bfa" />}
              label="Comments"
              value={formatNumber(totals.comments || 0)}
            />
            <Kpi
              icon={<BookOpen size={16} color={COLORS.secondary} />}
              label="Chapters"
              value={String(totals.chapters || 0)}
            />
          </View>

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Sparkles size={14} color="#facc15" />
              <Text style={styles.cardTitle}>Daily views (last 30 days)</Text>
            </View>
            <View style={styles.spark}>
              {daily.map((d, idx) => {
                const h = Math.max(2, ((d.views || 0) / maxDaily) * 56);
                return (
                  <View
                    key={`bar-${d.date}-${idx}`}
                    style={[styles.bar, { height: h, backgroundColor: d.views ? COLORS.secondary : 'rgba(255,255,255,0.08)' }]}
                  />
                );
              })}
            </View>
            <Text style={styles.sparkLegend}>
              Last 30 days · {formatNumber(totals.views_last_30d || 0)} views recorded.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <TrendingUp size={14} color="#22d3ee" />
              <Text style={styles.cardTitle}>Engagement (last 30 days)</Text>
            </View>
            <Row icon={<Heart size={14} color="#f472b6" />} label="New favorites" value={totals.favorite_events_last_30d || 0} />
            <Row icon={<Star size={14} color="#facc15" />} label="New ratings" value={totals.rating_events_last_30d || 0} />
            <Row icon={<MessageCircle size={14} color="#a78bfa" />} label="New comments" value={totals.comment_events_last_30d || 0} />
            <Row icon={<Share2 size={14} color="#22d3ee" />} label="Shares" value={totals.shares_last_30d || 0} />
          </View>

          {popularity ? (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Sparkles size={14} color="#facc15" />
                <Text style={styles.cardTitle}>Popularity score</Text>
              </View>
              <Text style={styles.scoreValue}>{(popularity.score || 0).toFixed(2)}</Text>
              <Text style={styles.scoreCaption}>
                Used by the home page to rank your story across all rails.
              </Text>
              <ScoreBar label="Views" value={popularity.view_score || 0} color="#22d3ee" />
              <ScoreBar label="Rating" value={popularity.rating_score || 0} color="#facc15" />
              <ScoreBar label="Favorites" value={popularity.favorite_score || 0} color="#f472b6" />
              <ScoreBar label="Freshness" value={popularity.freshness_score || 0} color="#a78bfa" />
              {popularity.updated_at ? (
                <Text style={styles.scoreUpdated}>
                  Updated {popularity.updated_at.replace('T', ' ').slice(0, 16)} UTC
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Sparkles size={14} color="#facc15" />
                <Text style={styles.cardTitle}>Popularity score</Text>
              </View>
              <Text style={styles.scoreCaption}>
                Your popularity score will appear after the next ranking refresh
                (every 30 minutes). Keep publishing — fresh chapters give your
                story an automatic boost.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const Kpi = ({ icon, label, value }) => (
  <View style={styles.kpi}>
    <View style={styles.kpiHead}>{icon}</View>
    <Text style={styles.kpiValue}>{value}</Text>
    <Text style={styles.kpiLabel} numberOfLines={1}>{label}</Text>
  </View>
);

const Row = ({ icon, label, value }) => (
  <View style={styles.row}>
    <View style={styles.rowLeft}>
      {icon}
      <Text style={styles.rowLabel}>{label}</Text>
    </View>
    <Text style={styles.rowValue}>{formatNumber(value)}</Text>
  </View>
);

const ScoreBar = ({ label, value, color }) => {
  const pct = Math.max(2, Math.min(100, value));
  return (
    <View style={styles.scoreRow}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <View style={styles.scoreTrack}>
        <View style={[styles.scoreFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.scoreValueSm}>{value.toFixed(0)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginRight: SPACING.sm,
  },
  headTitle: {
    color: COLORS.white,
    fontSize: 16,
    fontFamily: FONTS.displaySemi,
  },
  headSub: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  scroll: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  errorBox: {
    backgroundColor: 'rgba(207,102,121,0.1)',
    borderColor: COLORS.error,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  errorText: { color: COLORS.error, fontSize: 12 },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  kpi: {
    width: '31.5%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(212,168,67,0.18)',
    borderWidth: 1,
    borderRadius: 14,
    padding: SPACING.sm,
    minHeight: 78,
  },
  kpiHead: { marginBottom: 6 },
  kpiValue: {
    color: COLORS.white,
    fontSize: 18,
    fontFamily: FONTS.displaySemi,
  },
  kpiLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  card: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: 'rgba(20,20,40,0.55)',
    borderColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderRadius: 14,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  spark: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 64,
    gap: 2,
    marginTop: 6,
  },
  bar: {
    flex: 1,
    minWidth: 4,
    borderRadius: 2,
  },
  sparkLegend: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowLabel: {
    color: COLORS.text,
    fontSize: 13,
  },
  rowValue: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  scoreValue: {
    color: COLORS.secondary,
    fontSize: 28,
    fontFamily: FONTS.displaySemi,
  },
  scoreCaption: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
    marginBottom: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  scoreLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    width: 70,
  },
  scoreTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  scoreFill: {
    height: 6,
    borderRadius: 3,
  },
  scoreValueSm: {
    width: 40,
    textAlign: 'right',
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '700',
  },
  scoreUpdated: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 8,
  },
});

export default StoryAnalyticsScreen;
