import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  FlatList, RefreshControl,
} from 'react-native';
import CachedImage from '../../components/common/CachedImage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import creatorApi from '../../api/creator';
import useAuthStore from '../../store/useAuthStore';
import {
  ChevronLeft, UserPlus, UserCheck, BookOpen, Eye, Star, Users, Calendar,
} from 'lucide-react-native';
import SkeletonLoader from '../../components/common/SkeletonLoader';
import PremiumBadge from '../../components/PremiumBadge';
import LetterAvatar from '../../components/common/LetterAvatar';
import resolveUrl from '../../utils/resolveUrl';

const CreatorProfileScreen = ({ route, navigation }) => {
  const { creatorId } = route.params;
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const myId = useAuthStore((s) => s.user?.id);

  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const fetchCreator = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const { default: apiClient } = await import('../../api/client');
      const res = await apiClient.get(`/creators/${creatorId}`);
      const data = res.data;
      setCreator(data);
      setIsFollowing(!!data.is_following);
    } catch {
      setCreator(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchCreator(); }, [creatorId]);

  const canFollow = isAuthenticated && creator && creator.id !== myId;

  const onToggleFollow = async () => {
    if (!canFollow) return;
    setFollowLoading(true);
    try {
      const res = await creatorApi.toggleFollow(creatorId);
      setIsFollowing(res.following);
      setCreator((prev) => prev ? { ...prev, follower_count: res.count } : prev);
    } catch {}
    setFollowLoading(false);
  };

  const initials = (creator?.display_name || 'C')[0].toUpperCase();
  const joined = creator?.date_joined
    ? new Date(creator.date_joined).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null;

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <SkeletonLoader.ListItem count={4} />
      </View>
    );
  }
  if (!creator) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.muted}>Creator not found.</Text>
        <TouchableOpacity style={styles.backBtnCenter} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchCreator(true)} tintColor={COLORS.secondary} />}
    >
      {/* Top Bar */}
      <View style={styles.topRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <ChevronLeft size={20} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>Creator Profile</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Avatar + Name */}
      <View style={styles.profileHeader}>
        {resolveUrl(creator.avatar_url) ? (
          <Image source={{ uri: resolveUrl(creator.avatar_url) }} style={styles.avatar} />
        ) : (
          <LetterAvatar name={creator.display_name || 'C'} size={90} fontSize={34} borderWidth={3} />
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
          <Text style={[styles.displayName, { marginTop: 0 }]}>{creator.display_name || creator.pen_name || 'Creator'}</Text>
          <PremiumBadge plan={creator.premium_plan} size={16} />
        </View>
        {creator.username && <Text style={styles.username}>@{creator.username}</Text>}
        {creator.bio && <Text style={styles.bio}>{creator.bio}</Text>}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <BookOpen size={16} color={COLORS.secondary} />
          <Text style={styles.statVal}>{creator.book_count || 0}</Text>
          <Text style={styles.statLabel}>Stories</Text>
        </View>
        <View style={styles.stat}>
          <Users size={16} color={COLORS.secondary} />
          <Text style={styles.statVal}>{creator.follower_count || 0}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </View>
        {joined && (
          <View style={styles.stat}>
            <Calendar size={16} color={COLORS.secondary} />
            <Text style={styles.statVal}>{joined}</Text>
            <Text style={styles.statLabel}>Joined</Text>
          </View>
        )}
      </View>

      {/* Follow Button */}
      {canFollow && (
        <TouchableOpacity
          style={[styles.followBtn, isFollowing ? styles.followBtnInactive : styles.followBtnActive]}
          onPress={onToggleFollow}
          disabled={followLoading}
        >
          {isFollowing ? <UserCheck size={16} color={COLORS.textMuted} /> : <UserPlus size={16} color="#000" />}
          <Text style={[styles.followText, { color: isFollowing ? COLORS.textMuted : '#000' }]}>
            {followLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Stories */}
      {(creator.books || []).length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stories ({creator.books.length})</Text>
          {creator.books.map((book) => (
            <TouchableOpacity
              key={book.id}
              style={styles.bookRow}
              onPress={() => navigation.navigate('BookDetail', { bookId: book.id })}
            >
              {book.cover_url ? (
                <CachedImage source={{ uri: resolveUrl(book.cover_url) }} style={styles.bookCover} />
              ) : (
                <View style={[styles.bookCover, styles.bookCoverPh]}>
                  <BookOpen size={18} color="rgba(212,168,67,0.4)" />
                </View>
              )}
              <View style={styles.bookInfo}>
                <Text style={styles.bookTitle} numberOfLines={1}>{book.title}</Text>
                <View style={styles.bookMeta}>
                  <Eye size={12} color={COLORS.textMuted} />
                  <Text style={styles.bookMetaText}>{book.views || 0}</Text>
                  <Star size={12} color={COLORS.secondary} />
                  <Text style={styles.bookMetaText}>{(book.avg_rating || 0).toFixed(1)}</Text>
                  <Text style={styles.bookMetaText}>· {book.chapter_count || 0} ch</Text>
                </View>
                {book.status && (
                  <View style={[styles.statusBadge, statusColors[book.status] || statusColors.ongoing]}>
                    <Text style={[styles.statusText, { color: (statusColors[book.status] || statusColors.ongoing).color }]}>
                      {(book.status || 'ongoing').charAt(0).toUpperCase() + (book.status || 'ongoing').slice(1)}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={styles.emptyWrap}>
          <BookOpen size={40} color={COLORS.textMuted} strokeWidth={1} />
          <Text style={styles.emptyText}>No stories published yet</Text>
        </View>
      )}

      <View style={{ height: 80 }} />
    </ScrollView>
  );
};

const statusColors = {
  ongoing: { backgroundColor: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  complete: { backgroundColor: 'rgba(34,197,94,0.15)', color: '#4ade80' },
  draft: { backgroundColor: 'rgba(156,163,175,0.15)', color: '#9ca3af' },
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 40 },
  loadingWrap: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  muted: { color: COLORS.textMuted, fontSize: 14 },
  backBtnCenter: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  backBtnText: { color: COLORS.secondary, fontWeight: '600' },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, marginBottom: SPACING.md },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },

  profileHeader: { alignItems: 'center', paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg },
  avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: 'rgba(212,168,67,0.4)' },
  avatarPh: { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(114,47,55,0.5)', borderWidth: 2, borderColor: 'rgba(212,168,67,0.4)', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: COLORS.secondary, fontSize: 32, fontWeight: '700' },
  displayName: { color: COLORS.text, fontFamily: FONTS.display, fontSize: 24, marginTop: 12, textAlign: 'center' },
  username: { color: COLORS.textMuted, fontSize: 13, marginTop: 4 },
  bio: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10, paddingHorizontal: 12 },

  statsRow: { flexDirection: 'row', justifyContent: 'space-evenly', marginBottom: SPACING.lg, paddingHorizontal: SPACING.lg },
  stat: { alignItems: 'center', gap: 4 },
  statVal: { color: COLORS.text, fontWeight: '700', fontSize: 16 },
  statLabel: { color: COLORS.textMuted, fontSize: 10, textTransform: 'uppercase' },

  followBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: SPACING.lg, paddingVertical: 12, borderRadius: 12, borderWidth: 1, marginBottom: SPACING.lg },
  followBtnActive: { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  followBtnInactive: { backgroundColor: 'transparent', borderColor: COLORS.textMuted },
  followText: { fontSize: 14, fontWeight: '700' },

  section: { paddingHorizontal: SPACING.lg, marginTop: SPACING.sm },
  sectionTitle: { color: COLORS.text, fontFamily: FONTS.display, fontSize: 20, marginBottom: SPACING.md },

  bookRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  bookCover: { width: 56, height: 82, borderRadius: 8, backgroundColor: COLORS.surface },
  bookCoverPh: { alignItems: 'center', justifyContent: 'center' },
  bookInfo: { flex: 1, minWidth: 0 },
  bookTitle: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  bookMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  bookMetaText: { color: COLORS.textMuted, fontSize: 11 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, marginTop: 6 },
  statusText: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  emptyWrap: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: COLORS.textMuted, marginTop: 10, fontSize: 14 },
});

export default CreatorProfileScreen;
