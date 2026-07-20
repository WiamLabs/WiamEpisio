/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 (Text Edition park).
 * Do not wire into active navigation. Pending possible future Text Edition.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, SPACING } from '../../constants/theme';
import booksApi from '../../api/books';
import {
  ChevronLeft, BookOpen, Flame, Heart, Star, MessageSquare,
  List, Clock, Award, Lock,
} from 'lucide-react-native';

const ICON_MAP = {
  'book-open': BookOpen,
  'book': BookOpen,
  'library': BookOpen,
  'message-square': MessageSquare,
  'star': Star,
  'flame': Flame,
  'heart': Heart,
  'list': List,
};

const ReaderStatsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [badges, setBadges] = useState([]);
  const [allBadges, setAllBadges] = useState([]);
  const [newlyEarned, setNewlyEarned] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, badgesRes] = await Promise.all([
        booksApi.getReaderStats(),
        booksApi.getReaderBadges(),
      ]);
      setStats(statsRes.stats || {});
      setBadges(statsRes.badges || []);
      setNewlyEarned(statsRes.newly_earned || []);
      setAllBadges(badgesRes.badges || []);

      if (statsRes.newly_earned?.length > 0) {
        const names = statsRes.newly_earned.join(', ');
        Alert.alert('New Badge Earned!', `Congratulations! You earned: ${names}`);
      }
    } catch (e) {
      console.error('Failed to load reader stats', e);
    } finally {
      setLoading(false);
    }
  };

  const StatBox = ({ label, value, icon: Icon, color }) => (
    <View style={styles.statBox}>
      <Icon size={20} color={color || COLORS.secondary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Stats & Badges</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.secondary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Stats & Badges</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Stats Grid */}
        <Text style={styles.sectionTitle}>Reading Stats</Text>
        <View style={styles.statsGrid}>
          <StatBox label="Books Started" value={stats?.books_started || 0} icon={BookOpen} color="#3b82f6" />
          <StatBox label="Chapters Read" value={stats?.chapters_read || 0} icon={BookOpen} color="#8b5cf6" />
          <StatBox label="Current Streak" value={`${stats?.current_streak || 0}d`} icon={Flame} color="#ef4444" />
          <StatBox label="Minutes Read" value={stats?.total_minutes_read || 0} icon={Clock} color="#06b6d4" />
          <StatBox label="Favorites" value={stats?.favorites_count || 0} icon={Heart} color="#ec4899" />
          <StatBox label="Reviews" value={stats?.reviews_written || 0} icon={MessageSquare} color="#f59e0b" />
          <StatBox label="Ratings" value={stats?.ratings_given || 0} icon={Star} color="#f97316" />
          <StatBox label="Lists" value={stats?.lists_count || 0} icon={List} color="#06b6d4" />
        </View>

        {/* Badges */}
        <Text style={[styles.sectionTitle, { marginTop: SPACING.xl }]}>Badges</Text>
        <Text style={styles.sectionSub}>
          {badges.length} of {allBadges.length} earned
        </Text>

        <View style={styles.badgesGrid}>
          {allBadges.map((b) => {
            const earned = b.earned;
            const IconComp = ICON_MAP[b.icon] || Award;
            const isNew = newlyEarned.includes(b.key);
            return (
              <View
                key={b.key}
                style={[
                  styles.badgeCard,
                  !earned && styles.badgeCardLocked,
                  isNew && styles.badgeCardNew,
                ]}
              >
                <View style={[styles.badgeIcon, { backgroundColor: earned ? `${b.color}20` : 'rgba(255,255,255,0.04)' }]}>
                  {earned ? (
                    <IconComp size={22} color={b.color} />
                  ) : (
                    <Lock size={18} color={COLORS.textMuted} />
                  )}
                </View>
                <Text style={[styles.badgeName, !earned && styles.badgeNameLocked]}>{b.name}</Text>
                <Text style={[styles.badgeDesc, !earned && styles.badgeDescLocked]}>{b.description}</Text>
                {earned && b.earned_at && (
                  <Text style={styles.badgeDate}>
                    {new Date(b.earned_at).toLocaleDateString()}
                  </Text>
                )}
                {isNew && <View style={styles.newDot} />}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: COLORS.text, fontFamily: FONTS.display, fontSize: 20 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: SPACING.lg, paddingBottom: 60 },
  sectionTitle: { color: COLORS.text, fontFamily: FONTS.display, fontSize: 22, marginBottom: 4 },
  sectionSub: { color: COLORS.textMuted, fontSize: 13, marginBottom: SPACING.md },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: SPACING.sm,
  },
  statBox: {
    width: '47%', backgroundColor: COLORS.surface, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border, padding: 14, alignItems: 'center', gap: 6,
  },
  statValue: { color: COLORS.text, fontSize: 24, fontWeight: '700' },
  statLabel: { color: COLORS.textMuted, fontSize: 11, textTransform: 'uppercase' },
  badgesGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  badgeCard: {
    width: '47%', backgroundColor: COLORS.surface, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border, padding: 14, alignItems: 'center',
    position: 'relative',
  },
  badgeCardLocked: { opacity: 0.5 },
  badgeCardNew: { borderColor: 'rgba(212,168,67,0.5)', borderWidth: 2 },
  badgeIcon: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  badgeName: { color: COLORS.text, fontWeight: '700', fontSize: 13, textAlign: 'center' },
  badgeNameLocked: { color: COLORS.textMuted },
  badgeDesc: { color: COLORS.textSecondary, fontSize: 11, textAlign: 'center', marginTop: 2 },
  badgeDescLocked: { color: COLORS.textMuted },
  badgeDate: { color: COLORS.textMuted, fontSize: 10, marginTop: 4 },
  newDot: {
    position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#ef4444',
  },
});

export default ReaderStatsScreen;