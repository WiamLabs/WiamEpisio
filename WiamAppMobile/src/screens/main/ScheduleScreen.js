/**
 * ScheduleScreen — Reader-facing upcoming releases with live countdowns.
 *
 * Shows scheduled chapter releases from creators the user follows (first)
 * and other public releases. Each card has a live countdown timer that
 * ticks every second.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Calendar,
  Clock,
  ChevronLeft,
  Bell,
  BookOpen,
  UserCheck,
  ChevronRight,
} from 'lucide-react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import CachedImage from '../../components/common/CachedImage';
import LetterAvatar from '../../components/common/LetterAvatar';
import BrandedFooter from '../../components/BrandedFooter';
import authApi from '../../api/auth';

/* ─── helpers ─── */
const pad = (n) => String(n).padStart(2, '0');

const getTimeRemaining = (targetISO) => {
  const diff = new Date(targetISO).getTime() - Date.now();
  if (diff <= 0) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0, label: 'Released!' };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  let label = '';
  if (days > 0) label = `${days}d ${pad(hours)}h ${pad(minutes)}m`;
  else if (hours > 0) label = `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  else label = `${pad(minutes)}m ${pad(seconds)}s`;
  return { total: diff, days, hours, minutes, seconds, label };
};

/* ─── CountdownRing (animated circular progress) ─── */
const CountdownUnit = ({ value, label, color }) => (
  <View style={s.cdUnit}>
    <View style={[s.cdBox, { borderColor: color }]}>
      <Text style={[s.cdVal, { color }]}>{pad(value)}</Text>
    </View>
    <Text style={s.cdLabel}>{label}</Text>
  </View>
);

/* ─── Single release card ─── */
const ReleaseCard = ({ item, onPress }) => {
  const [remaining, setRemaining] = useState(() => getTimeRemaining(item.scheduled_at));
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(getTimeRemaining(item.scheduled_at));
    }, 1000);
    return () => clearInterval(id);
  }, [item.scheduled_at]);

  // Pulse when < 1 hour
  useEffect(() => {
    if (remaining.total > 0 && remaining.total < 3600000) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [remaining.total < 3600000]);

  const isImminent = remaining.total > 0 && remaining.total < 3600000;
  const isReleased = remaining.total <= 0;
  const accentColor = isReleased ? '#4ade80' : isImminent ? '#f59e0b' : COLORS.secondary;

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <TouchableOpacity
        style={[s.card, isImminent && s.cardImminent, isReleased && s.cardReleased]}
        activeOpacity={0.8}
        onPress={onPress}
      >
        {/* Header: creator info + followed badge */}
        <View style={s.cardHeader}>
          <View style={s.creatorRow}>
            {item.creator_avatar ? (
              <CachedImage source={{ uri: item.creator_avatar }} style={s.creatorAvatar} />
            ) : (
              <LetterAvatar name={item.creator_name || 'C'} size={28} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.creatorName} numberOfLines={1}>{item.creator_name}</Text>
              {item.creator_username && (
                <Text style={s.creatorHandle}>@{item.creator_username}</Text>
              )}
            </View>
            {item.is_followed && (
              <View style={s.followedBadge}>
                <UserCheck size={10} color={COLORS.secondary} />
                <Text style={s.followedText}>Following</Text>
              </View>
            )}
          </View>
        </View>

        {/* Book + chapter info */}
        <View style={s.cardBody}>
          {item.book_cover ? (
            <CachedImage source={{ uri: item.book_cover }} style={s.bookCover} />
          ) : (
            <View style={[s.bookCover, s.coverPlaceholder]}>
              <BookOpen size={20} color="rgba(212,168,67,0.3)" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.bookTitle} numberOfLines={2}>{item.book_title}</Text>
            <Text style={s.chapterInfo}>
              Chapter {item.chapter_number} · {item.chapter_title}
            </Text>
            <View style={s.scheduleRow}>
              <Calendar size={12} color={COLORS.textMuted} />
              <Text style={s.scheduleDate}>
                {new Date(item.scheduled_at).toLocaleDateString(undefined, {
                  weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </Text>
            </View>
          </View>
        </View>

        {/* Countdown */}
        {isReleased ? (
          <View style={s.releasedBanner}>
            <Text style={s.releasedText}>Released!</Text>
            <ChevronRight size={14} color="#4ade80" />
          </View>
        ) : (
          <View style={s.countdownRow}>
            <CountdownUnit value={remaining.days} label="Days" color={accentColor} />
            <Text style={[s.cdSep, { color: accentColor }]}>:</Text>
            <CountdownUnit value={remaining.hours} label="Hrs" color={accentColor} />
            <Text style={[s.cdSep, { color: accentColor }]}>:</Text>
            <CountdownUnit value={remaining.minutes} label="Min" color={accentColor} />
            <Text style={[s.cdSep, { color: accentColor }]}>:</Text>
            <CountdownUnit value={remaining.seconds} label="Sec" color={accentColor} />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

/* ─── Main Screen ─── */
const ScheduleScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await authApi.getUpcomingSchedule();
      setItems(res?.upcoming || []);
    } catch (err) {
      console.warn('Schedule load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handlePress = (item) => {
    if (getTimeRemaining(item.scheduled_at).total <= 0) {
      navigation.navigate('BookDetail', { bookId: item.book_id });
    } else {
      navigation.navigate('BookDetail', { bookId: item.book_id });
    }
  };

  return (
    <View style={[s.page, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Calendar size={18} color={COLORS.secondary} />
          <Text style={s.headerTitle}>Release Schedule</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={COLORS.secondary}
          />
        }
      >
        {/* Hero section */}
        <View style={s.hero}>
          <View style={s.heroIconWrap}>
            <Clock size={28} color={COLORS.secondary} />
          </View>
          <Text style={s.heroTitle}>Upcoming Releases</Text>
          <Text style={s.heroSub}>
            Stay ahead of the story — see when your favorite creators drop new chapters.
          </Text>
        </View>

        {loading ? (
          <View style={s.loadWrap}>
            <ActivityIndicator size="large" color={COLORS.secondary} />
            <Text style={s.loadText}>Fetching schedule…</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={s.emptyWrap}>
            <Calendar size={48} color={COLORS.textMuted} />
            <Text style={s.emptyTitle}>No upcoming releases</Text>
            <Text style={s.emptySub}>
              When creators schedule new chapters, they'll appear here with a live countdown.
              Follow more creators to see their upcoming releases!
            </Text>
            <TouchableOpacity style={s.goldBtn} onPress={() => navigation.navigate('Browse')}>
              <Text style={s.goldBtnText}>Discover Creators</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Stats banner */}
            <View style={s.statsBanner}>
              <View style={s.statItem}>
                <Text style={s.statVal}>{items.length}</Text>
                <Text style={s.statLabel}>Upcoming</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statVal}>{items.filter(i => i.is_followed).length}</Text>
                <Text style={s.statLabel}>From Followed</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statVal}>
                  {items.length > 0
                    ? (() => {
                        const r = getTimeRemaining(items[0].scheduled_at);
                        return r.total <= 0 ? 'Now' : r.days > 0 ? `${r.days}d` : `${r.hours}h`;
                      })()
                    : '—'}
                </Text>
                <Text style={s.statLabel}>Next Drop</Text>
              </View>
            </View>

            {/* Followed creators releases */}
            {items.some(i => i.is_followed) && (
              <>
                <View style={s.sectionHead}>
                  <Bell size={14} color={COLORS.secondary} />
                  <Text style={s.sectionTitle}>From Creators You Follow</Text>
                </View>
                {items.filter(i => i.is_followed).map((item, idx) => (
                  <ReleaseCard key={`fol-${item.chapter_id || idx}`} item={item} onPress={() => handlePress(item)} />
                ))}
              </>
            )}

            {/* Other releases */}
            {items.some(i => !i.is_followed) && (
              <>
                <View style={s.sectionHead}>
                  <BookOpen size={14} color={COLORS.textMuted} />
                  <Text style={s.sectionTitle}>Other Upcoming Releases</Text>
                </View>
                {items.filter(i => !i.is_followed).map((item, idx) => (
                  <ReleaseCard key={`oth-${item.chapter_id || idx}`} item={item} onPress={() => handlePress(item)} />
                ))}
              </>
            )}
          </>
        )}

        <View style={{ paddingTop: 24 }}>
          <BrandedFooter compact />
        </View>
      </ScrollView>
    </View>
  );
};

/* ─── Styles ─── */
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  scroll: { padding: SPACING.md, paddingBottom: 40 },

  /* Hero */
  hero: { alignItems: 'center', paddingVertical: 24 },
  heroIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(212,168,67,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 6, fontFamily: FONTS.display },
  heroSub: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', maxWidth: 300, lineHeight: 19 },

  /* Loading */
  loadWrap: { alignItems: 'center', paddingVertical: 60 },
  loadText: { color: COLORS.textMuted, fontSize: 13, marginTop: 12 },

  /* Empty */
  emptyWrap: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 16 },
  emptySub: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', maxWidth: 280, marginTop: 8, lineHeight: 19 },
  goldBtn: {
    marginTop: 20, paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 24, backgroundColor: COLORS.secondary,
  },
  goldBtnText: { fontSize: 14, fontWeight: '700', color: '#000' },

  /* Stats banner */
  statsBanner: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: 'rgba(212,168,67,0.06)',
    borderWidth: 1, borderColor: 'rgba(212,168,67,0.15)',
    borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: 20,
  },
  statItem: { alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '800', color: COLORS.secondary },
  statLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, backgroundColor: 'rgba(212,168,67,0.15)' },

  /* Section headers */
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },

  /* Release card */
  card: {
    backgroundColor: 'rgba(20,20,40,0.85)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: 14,
  },
  cardImminent: {
    borderColor: 'rgba(245,158,11,0.3)',
    backgroundColor: 'rgba(245,158,11,0.04)',
  },
  cardReleased: {
    borderColor: 'rgba(74,222,128,0.3)',
    backgroundColor: 'rgba(74,222,128,0.04)',
  },
  cardHeader: { marginBottom: 10 },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  creatorAvatar: { width: 28, height: 28, borderRadius: 14 },
  creatorName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  creatorHandle: { fontSize: 10, color: COLORS.textMuted },
  followedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(212,168,67,0.12)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  followedText: { fontSize: 9, fontWeight: '700', color: COLORS.secondary },

  cardBody: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  bookCover: { width: 50, height: 70, borderRadius: 6 },
  coverPlaceholder: {
    backgroundColor: 'rgba(212,168,67,0.08)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  bookTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 3 },
  chapterInfo: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  scheduleDate: { fontSize: 11, color: COLORS.textMuted },

  /* Countdown */
  countdownRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)',
  },
  cdUnit: { alignItems: 'center' },
  cdBox: {
    width: 48, height: 48, borderRadius: 10,
    backgroundColor: 'rgba(212,168,67,0.08)',
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  cdVal: { fontSize: 18, fontWeight: '800' },
  cdLabel: { fontSize: 8, color: COLORS.textMuted, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  cdSep: { fontSize: 20, fontWeight: '800', marginTop: -10 },

  /* Released banner */
  releasedBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(74,222,128,0.15)',
  },
  releasedText: { fontSize: 14, fontWeight: '800', color: '#4ade80' },
});

export default ScheduleScreen;
