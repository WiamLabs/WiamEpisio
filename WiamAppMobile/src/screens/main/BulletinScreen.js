import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  RefreshControl,
  Dimensions
} from 'react-native';
import CachedImage from '../../components/common/CachedImage';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import AppBackground from '../../components/AppBackground';
import { ChevronLeft, MessageSquare, Heart, Share2, Ellipsis, UserPlus, Pin, BookOpen } from 'lucide-react-native';
import bulletinApi from '../../api/bulletin';
import BrandedFooter from '../../components/BrandedFooter';
import SkeletonLoader from '../../components/common/SkeletonLoader';

const { width } = Dimensions.get('window');

const REACTION_EMOJIS = ['❤️', '🔥', '👏', '😍', '😂', '😢'];

const timeAgo = (iso) => {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
};

const BulletinScreen = ({ navigation }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchPosts = useCallback(async (pg = 1, refresh = false) => {
    try {
      const res = await bulletinApi.getFeed(pg);
      const fetched = res.posts || [];
      if (refresh || pg === 1) {
        setPosts(fetched);
      } else {
        setPosts((prev) => [...prev, ...fetched]);
      }
      setHasMore(fetched.length >= (res.per_page || 30));
      setPage(pg);
    } catch {
      if (pg === 1) setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchPosts(1); }, [fetchPosts]);

  const onRefresh = () => { setRefreshing(true); fetchPosts(1, true); };
  const onEndReached = () => { if (hasMore && !loading) fetchPosts(page + 1); };

  const handleReact = async (postId, emoji) => {
    try {
      const res = await bulletinApi.toggleReaction(postId, emoji);
      const added = res.action === 'added';
      setPosts((prev) => prev.map((p) => {
        if (p.id !== postId) return p;
        const prev_emojis = p.user_emojis || [];
        const userEmojis = added
          ? [...prev_emojis, emoji]
          : prev_emojis.filter((e) => e !== emoji);
        // Optimistically update reaction counts
        const prevReactions = { ...(p.reactions || {}) };
        prevReactions[emoji] = Math.max(0, (prevReactions[emoji] || 0) + (added ? 1 : -1));
        return { ...p, reactions: prevReactions, user_emojis: userEmojis };
      }));
    } catch {}
  };

  const renderPost = ({ item }) => (
    <View style={styles.postCard}>
      {item.is_pinned && (
        <View style={styles.pinnedRow}><Pin size={12} color={COLORS.secondary} /><Text style={styles.pinnedText}>Pinned</Text></View>
      )}
      <View style={styles.postHeader}>
        <TouchableOpacity style={styles.creatorInfo} onPress={() => item.creator?.id > 0 && navigation.navigate('CreatorProfile', { creatorId: item.creator.id })}>
          {item.creator?.avatar_url
            ? <Image source={{ uri: item.creator.avatar_url }} style={styles.avatar} />
            : <View style={[styles.avatar, styles.avatarPh]}><Text style={{ color: COLORS.secondary, fontWeight: '700', fontSize: 16 }}>{(item.creator?.display_name || 'W')[0]}</Text></View>
          }
          <View style={styles.creatorText}>
            <View style={styles.nameRow}>
              <Text style={styles.creatorName}>{item.creator?.display_name || 'WiamApp'}</Text>
              {item.creator?.is_verified && (
                <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓</Text></View>
              )}
            </View>
            <Text style={styles.username}>@{item.creator?.username || 'wiamapp'} • {timeAgo(item.created_at)}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {!!item.text && <Text style={styles.postContent}>{item.text}</Text>}

      {item.book && (
        <TouchableOpacity style={styles.bookShare} onPress={() => navigation.navigate('BookDetail', { bookId: item.book.id })}>
          {item.book.cover_url
            ? <CachedImage source={{ uri: item.book.cover_url }} style={styles.bookCover} />
            : <View style={[styles.bookCover, { backgroundColor: 'rgba(212,168,67,0.1)', alignItems: 'center', justifyContent: 'center' }]}><BookOpen size={20} color={COLORS.secondary} /></View>
          }
          <View style={{ flex: 1 }}>
            <Text style={styles.bookTitle} numberOfLines={2}>{item.book.title}</Text>
            <Text style={styles.bookAuthor}>by @{item.book.author || 'unknown'}</Text>
          </View>
        </TouchableOpacity>
      )}

      <View style={styles.postActions}>
        {REACTION_EMOJIS.map((emoji) => {
          const count = (item.reactions || {})[emoji] || 0;
          const active = (item.user_emojis || []).includes(emoji);
          return (
            <TouchableOpacity key={emoji} style={[styles.emojiBtn, active && styles.emojiBtnActive]} onPress={() => handleReact(item.id, emoji)}>
              <Text style={{ fontSize: 16 }}>{emoji}</Text>
              {count > 0 && <Text style={[styles.emojiCount, active && { color: COLORS.secondary }]}>{count}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <AppBackground>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bulletin Feed</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.container}>
        {loading && !refreshing ? (
          <View style={{ marginTop: 16 }}><SkeletonLoader.ListItem count={5} /></View>
        ) : (
          <FlatList
            data={posts}
            renderItem={renderPost}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={styles.listContent}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.3}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.secondary} />
            }
            ListFooterComponent={posts.length > 0 ? <BrandedFooter compact /> : null}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MessageSquare size={64} color={COLORS.textMuted} strokeWidth={1} />
                <Text style={styles.emptyTitle}>No updates yet</Text>
                <Text style={styles.emptySubtitle}>Follow your favorite creators to see their posts here.</Text>
              </View>
            }
          />
        )}
      </View>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingTop: 50, paddingBottom: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: 'rgba(8, 8, 26, 0.8)',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  backButton: { padding: SPACING.sm },
  listContent: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  loader: { marginTop: 100 },
  postCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md,
    marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  pinnedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  pinnedText: { color: COLORS.secondary, fontSize: 11, fontWeight: '600' },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.md },
  creatorInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  avatarPh: { backgroundColor: 'rgba(212,168,67,0.1)', alignItems: 'center', justifyContent: 'center' },
  creatorText: { justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  creatorName: { color: COLORS.text, fontSize: 15, fontWeight: 'bold' },
  verifiedBadge: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center', marginLeft: 4 },
  verifiedText: { color: COLORS.black, fontSize: 8, fontWeight: 'bold' },
  username: { color: COLORS.textMuted, fontSize: 12 },
  postContent: { color: COLORS.text, fontSize: 15, lineHeight: 22, marginBottom: SPACING.md },
  bookShare: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10,
    backgroundColor: 'rgba(212,168,67,0.06)', borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.15)', marginBottom: SPACING.md,
  },
  bookCover: { width: 48, height: 68, borderRadius: 6 },
  bookTitle: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  bookAuthor: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  postActions: {
    flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingTop: SPACING.sm, gap: 6,
  },
  emojiBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 16, borderWidth: 1, borderColor: COLORS.border,
  },
  emojiBtnActive: { borderColor: COLORS.secondary, backgroundColor: 'rgba(212,168,67,0.1)' },
  emojiCount: { fontSize: 12, color: COLORS.textMuted },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: 'bold', marginTop: SPACING.lg },
  emptySubtitle: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', marginTop: SPACING.sm, paddingHorizontal: SPACING.xl },
});

export default BulletinScreen;
