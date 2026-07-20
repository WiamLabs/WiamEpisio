/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 (Text Edition park).
 * Do not wire into active navigation. Pending possible future Text Edition.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Share, FlatList, Modal, Alert, TextInput } from 'react-native';
import CachedImage from '../../components/common/CachedImage';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import booksApi from '../../api/books';
import studioV2Api from '../../api/studioV2';
import useAuthStore from '../../store/useAuthStore';
import { ChevronLeft, Share2, Play, Bookmark, ListOrdered, Heart, Star, Lock, ListPlus, Plus, ThumbsUp, Send, Trash2, MessageSquare, Layers } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SkeletonLoader from '../../components/common/SkeletonLoader';
import { mediumTap, successNotification } from '../../utils/haptics';
import formatNumber from '../../utils/formatNumber';
import CONFIG from '../../constants/config';
import { cachedFetch } from '../../utils/apiCache';
import AdBanner from '../../components/ads/AdBanner';
import resolveUrl from '../../utils/resolveUrl';

const BookDetailScreen = ({ route, navigation }) => {
  const { bookId } = route.params;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);
  const insets = useSafeAreaInsets();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(true);
  const [inLibrary, setInLibrary] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [tipping, setTipping] = useState(false);
  const [tipAmount, setTipAmount] = useState(10);
  const [showListPicker, setShowListPicker] = useState(false);
  const [myLists, setMyLists] = useState([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  // Push 10 ΓÇö series progression context
  const [seriesContext, setSeriesContext] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await cachedFetch(
          `book_detail_${bookId}`,
          () => booksApi.getBookDetail(bookId),
          (fresh) => { setBook(fresh); setInLibrary(!!fresh?.in_library); },
          5 * 60 * 1000,
        );
        setBook(data);
        setInLibrary(!!data?.in_library);
      } catch (err) {
        if (__DEV__) console.warn('BookDetail fetch error:', err);
        setBook(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [bookId]);

  const chapterCount = book?.chapters?.length || 0;
  const unitLabel = String(book?.content_unit_label || book?.chapters?.[0]?.unit_label || 'chapter').toLowerCase();
  const unitCap = unitLabel.charAt(0).toUpperCase() + unitLabel.slice(1);
  const similar = useMemo(() => book?.similar_books || [], [book]);

  useEffect(() => {
    if (book?.reviews) setReviews(book.reviews);
  }, [book]);

  // Push 10 ΓÇö fetch series context (silent if no series)
  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    studioV2Api.getBookSeriesContext(bookId)
      .then((res) => {
        if (cancelled) return;
        if (res && res.series) setSeriesContext(res);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [bookId]);
  const canTip = !!(isAuthenticated && book?.creator?.id && book?.creator?.id !== userId);

  const onShare = async () => {
    if (!book) return;
    await Share.share({
      message: `Check out "${book.title}" on WiamApp`,
      url: `https://wiamapp.com/book/${book.id}`,
    });
  };

  const goToLogin = () => {
    const parent = navigation.getParent?.();
    if (navigation.getState?.().routeNames?.includes('Login')) {
      navigation.navigate('Login');
      return;
    }
    if (parent?.getState?.().routeNames?.includes('Login')) {
      parent.navigate('Login');
    }
  };

  const onToggleLibrary = async () => {
    if (!isAuthenticated) {
      goToLogin();
      return;
    }
    try {
      const res = await booksApi.toggleLibrary(bookId);
      setInLibrary(!!res?.in_library);
      mediumTap();
    } catch (e) {
      Alert.alert('Library', String(e || 'Failed to update library'));
    }
  };

  const onSendTip = async () => {
    if (!isAuthenticated) {
      goToLogin();
      return;
    }
    try {
      setTipping(true);
      await booksApi.tipCreator(bookId, tipAmount);
      setShowTip(false);
      successNotification();
      Alert.alert('Tip Sent', `You tipped ${tipAmount} coins.`);
    } catch (e) {
      if (e?.needCoins) {
        setShowTip(false);
        navigation.navigate('Wallet');
        return;
      }
      Alert.alert('Tip Failed', e?.message || 'Could not send tip');
    } finally {
      setTipping(false);
    }
  };

  const openListPicker = async () => {
    if (!isAuthenticated) { goToLogin(); return; }
    setShowListPicker(true);
    setListsLoading(true);
    try {
      const res = await booksApi.getReadingLists();
      setMyLists(res.lists || []);
    } catch (e) {
      console.error('Error fetching lists', e);
    } finally {
      setListsLoading(false);
    }
  };

  const addToList = async (listId) => {
    try {
      await booksApi.addToReadingList(listId, bookId);
      successNotification();
      setShowListPicker(false);
      Alert.alert('Added', 'Book added to list!');
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Failed to add';
      if (msg.includes('already')) {
        Alert.alert('Already Added', 'This book is already in that list.');
      } else {
        Alert.alert('Error', msg);
      }
    }
  };

  const submitReview = async () => {
    if (!isAuthenticated) { goToLogin(); return; }
    if (reviewText.trim().length < 10) {
      Alert.alert('Too Short', 'Review must be at least 10 characters');
      return;
    }
    setSubmittingReview(true);
    try {
      await booksApi.createReview(bookId, reviewText.trim());
      successNotification();
      setReviewText('');
      setShowReviewForm(false);
      const res = await booksApi.getReviews(bookId);
      setReviews(res.reviews || []);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const onToggleReviewLike = async (reviewId) => {
    if (!isAuthenticated) { goToLogin(); return; }
    try {
      const res = await booksApi.toggleReviewLike(reviewId);
      setReviews((prev) => prev.map((r) =>
        r.id === reviewId ? { ...r, liked: res.liked, like_count: res.like_count } : r
      ));
    } catch (e) { /* silent */ }
  };

  const onDeleteReview = async (reviewId) => {
    Alert.alert('Delete Review', 'Remove your review?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await booksApi.deleteReview(bookId, reviewId);
          setReviews((prev) => prev.filter((r) => r.id !== reviewId));
        } catch (e) {
          Alert.alert('Error', 'Failed to delete review');
        }
      }},
    ]);
  };

  const quickCreateAndAdd = async () => {
    try {
      const res = await booksApi.createReadingList('My List');
      if (res.list) {
        await addToList(res.list.id);
        setMyLists((prev) => [res.list, ...prev]);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to create list');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <SkeletonLoader.ListItem count={4} />
      </View>
    );
  }
  if (!book) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.muted}>Book not found.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', flex: 1 }]}>
        <ActivityIndicator size="large" color={COLORS.secondary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <ChevronLeft size={20} color={COLORS.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onShare} style={styles.iconBtn}>
          <Share2 size={18} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.coverHero}>
        <CachedImage source={{ uri: resolveUrl(book.cover_url) }} style={styles.cover} />
      </View>

      <View style={styles.titleArea}>
        <Text style={styles.title}>{book.title}</Text>
        <Text style={styles.author}>by @{book.author || 'unknown'}</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((s) => (
            <Star key={s} size={15} color={COLORS.secondary} fill={(book.avg_rating || 0) >= s ? COLORS.secondary : 'transparent'} />
          ))}
          <Text style={styles.ratingText}>
            {(book.avg_rating || 0).toFixed ? book.avg_rating.toFixed(1) : book.avg_rating || '0.0'}/5 ({book.rating_count || 0})
          </Text>
        </View>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}><Text style={styles.statVal}>{formatNumber(book.views || 0)}</Text><Text style={styles.statKey}>Reads</Text></View>
        <View style={styles.stat}><Text style={styles.statVal}>{chapterCount}</Text><Text style={styles.statKey}>{`${unitCap}s`}</Text></View>
        <View style={styles.stat}><Text style={styles.statVal}>{book.reading_time_min || 15}</Text><Text style={styles.statKey}>Min Read</Text></View>
      </View>

      <TouchableOpacity
        style={styles.readBtn}
        onPress={() => (isAuthenticated ? navigation.navigate('Reader', { bookId, chNum: book.reading_progress?.current_chapter || 1 }) : goToLogin())}
      >
        <LinearGradient colors={[COLORS.secondary, '#b8860b']} style={styles.readGrad}>
          <Play size={18} color={COLORS.black} fill={COLORS.black} />
          <Text style={styles.readText}>
            {isAuthenticated
              ? book.reading_progress?.current_chapter > 1
                ? `Continue ${unitCap} ${book.reading_progress.current_chapter}`
                : 'Start Reading'
              : 'Login to Read'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.secBtns}>
        <TouchableOpacity style={styles.secBtn} onPress={() => setShowChapters(true)}>
          <ListOrdered size={16} color={COLORS.text} />
          <Text style={styles.secBtnText}>{`${chapterCount} ${unitCap.slice(0, 2)}.`}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secBtn} onPress={onToggleLibrary}>
          <Bookmark size={16} color={inLibrary ? COLORS.secondary : COLORS.text} fill={inLibrary ? COLORS.secondary : 'transparent'} />
          <Text style={[styles.secBtnText, inLibrary && { color: COLORS.secondary }]}>{inLibrary ? 'In Library' : 'Library'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secBtn}
          onPress={() => {
            if (!isAuthenticated) {
              goToLogin();
              return;
            }
            if (!canTip) {
              Alert.alert('Tip', 'You cannot tip yourself.');
              return;
            }
            setShowTip(true);
          }}
        >
          <Heart size={16} color="#ec4899" fill="#ec4899" />
          <Text style={[styles.secBtnText, { color: '#ec4899' }]}>Tip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secBtn} onPress={openListPicker}>
          <ListPlus size={16} color={COLORS.text} />
          <Text style={styles.secBtnText}>List</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Synopsis</Text>
        <Text style={[styles.synopsis, collapsed && styles.synopsisCollapsed]}>{book.description || 'No description available.'}</Text>
        {(book.description || '').length > 260 ? (
          <TouchableOpacity onPress={() => setCollapsed((v) => !v)}>
            <Text style={styles.more}>{collapsed ? 'Read more' : 'Show less'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Push 10 ΓÇö Series banner */}
      {seriesContext?.series ? (
        <TouchableOpacity
          style={styles.seriesBanner}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('SeriesDetail', { seriesId: seriesContext.series.id })}
        >
          <View style={styles.seriesBannerIcon}>
            <Layers size={16} color={COLORS.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.seriesBannerLabel}>SERIES</Text>
            <Text style={styles.seriesBannerTitle} numberOfLines={1}>
              {seriesContext.series.title}
            </Text>
            <Text style={styles.seriesBannerMeta}>
              {seriesContext.position
                ? `Book ${seriesContext.position} of ${seriesContext.total}`
                : `${seriesContext.total || (seriesContext.books?.length || 0)} books`}
            </Text>
          </View>
          <Text style={styles.seriesBannerCta}>View ΓåÆ</Text>
        </TouchableOpacity>
      ) : null}

      {book.introduction ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Author&apos;s Note</Text>
          <View style={styles.noteBox}>
            <Text style={styles.noteText}>{book.introduction}</Text>
          </View>
        </View>
      ) : null}

      {similar.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>You Might Also Like</Text>
          <FlatList
            horizontal
            data={similar}
            keyExtractor={(it) => `sm-${it.id}`}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.simCard} onPress={() => navigation.push('BookDetail', { bookId: item.id })}>
                <CachedImage source={{ uri: resolveUrl(item.cover_url) }} style={styles.simCover} />
                <Text style={styles.simTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.simAuthor} numberOfLines={1}>@{item.author || 'unknown'}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      ) : null}

      {/* Reviews Section */}
      <View style={styles.section}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.sectionTitle}>Reviews</Text>
          <TouchableOpacity onPress={() => { if (!isAuthenticated) { goToLogin(); return; } setShowReviewForm(!showReviewForm); }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MessageSquare size={14} color={COLORS.secondary} />
              <Text style={{ color: COLORS.secondary, fontSize: 13, fontWeight: '600' }}>Write</Text>
            </View>
          </TouchableOpacity>
        </View>

        {showReviewForm && (
          <View style={styles.reviewForm}>
            <TextInput
              style={styles.reviewInput}
              value={reviewText}
              onChangeText={setReviewText}
              placeholder="Share your thoughts about this story..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              maxLength={2000}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>{reviewText.length}/2000</Text>
              <TouchableOpacity style={styles.submitReviewBtn} onPress={submitReview} disabled={submittingReview}>
                <Send size={14} color="#000" />
                <Text style={styles.submitReviewText}>{submittingReview ? 'Sending...' : 'Submit'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {reviews.length === 0 && !showReviewForm && (
          <Text style={{ color: COLORS.textMuted, fontSize: 13, marginTop: 4 }}>No reviews yet. Be the first!</Text>
        )}

        {reviews.map((rev) => (
          <View key={rev.id} style={styles.reviewCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              {rev.user?.avatar_url ? (
                <Image source={{ uri: rev.user.avatar_url }} style={styles.reviewAvatar} />
              ) : (
                <View style={[styles.reviewAvatar, { backgroundColor: 'rgba(212,168,67,0.15)', alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: COLORS.secondary, fontWeight: '700', fontSize: 11 }}>
                    {(rev.user?.display_name || '?')[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: COLORS.text, fontWeight: '600', fontSize: 13 }}>{rev.user?.display_name || 'Reader'}</Text>
                <Text style={{ color: COLORS.textMuted, fontSize: 10 }}>
                  {rev.created_at ? new Date(rev.created_at).toLocaleDateString() : ''}
                </Text>
              </View>
              {rev.user?.id === userId && (
                <TouchableOpacity onPress={() => onDeleteReview(rev.id)} hitSlop={8}>
                  <Trash2 size={14} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
            <Text style={{ color: COLORS.textSecondary, fontSize: 13, lineHeight: 20 }}>{rev.text}</Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}
              onPress={() => onToggleReviewLike(rev.id)}
            >
              <ThumbsUp size={13} color={rev.liked ? COLORS.secondary : COLORS.textMuted} fill={rev.liked ? COLORS.secondary : 'transparent'} />
              <Text style={{ color: rev.liked ? COLORS.secondary : COLORS.textMuted, fontSize: 12 }}>{rev.like_count || 0}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <AdBanner placement="book_detail" bookId={bookId} navigation={navigation} />

      <Modal visible={showChapters} transparent animationType="fade" onRequestClose={() => setShowChapters(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { marginTop: insets.top + 8 }]}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>{`${unitCap}s (${chapterCount})`}</Text>
              <TouchableOpacity onPress={() => setShowChapters(false)}><Text style={styles.closeX}>x</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              {(book.chapters || []).map((ch, idx) => {
                const num = ch.number || idx + 1;
                const title = ch.title || `${unitCap} ${num}`;
                return (
                  <TouchableOpacity
                    key={`ch-${num}`}
                    style={styles.chapterRow}
                    onPress={() => {
                      setShowChapters(false);
                      if (!isAuthenticated) {
                        goToLogin();
                        return;
                      }
                      navigation.navigate('Reader', { bookId, chNum: num });
                    }}
                  >
                    <View style={styles.chNum}><Text style={styles.chNumTxt}>{num}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.chTitle} numberOfLines={1}>{title}</Text>
                      <Text style={styles.chMeta}>{ch.word_count ? `${ch.word_count} words` : unitCap}</Text>
                    </View>
                    {ch.is_locked ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Lock size={14} color={COLORS.secondary} />
                        {ch.chapter_price ? <Text style={{ fontSize: 11, color: COLORS.secondary, fontWeight: '600' }}>{ch.chapter_price}c</Text> : null}
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showListPicker} transparent animationType="fade" onRequestClose={() => setShowListPicker(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { marginTop: insets.top + 60 }]}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Add to Reading List</Text>
              <TouchableOpacity onPress={() => setShowListPicker(false)}><Text style={styles.closeX}>├ù</Text></TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.newListRow} onPress={quickCreateAndAdd}>
              <Plus size={16} color={COLORS.secondary} />
              <Text style={styles.newListText}>Create New List & Add</Text>
            </TouchableOpacity>
            <ScrollView style={{ maxHeight: 320 }}>
              {myLists.map((rl) => (
                <TouchableOpacity key={rl.id} style={styles.chapterRow} onPress={() => addToList(rl.id)}>
                  <View style={styles.chNum}><ListPlus size={14} color={COLORS.textMuted} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.chTitle}>{rl.name}</Text>
                    <Text style={styles.chMeta}>{rl.item_count || 0} books</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {!listsLoading && myLists.length === 0 && (
                <Text style={{ color: COLORS.textMuted, textAlign: 'center', padding: 20 }}>No lists yet. Create one above!</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showTip} transparent animationType="fade" onRequestClose={() => setShowTip(false)}>
        <View style={styles.modalBg}>
          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>Tip the Creator</Text>
            <Text style={styles.tipSub}>Show your love for {book.creator?.display_name || 'the creator'}</Text>
            <View style={styles.tipRow}>
              {[5, 10, 25, 50].map((amt) => (
                <TouchableOpacity key={amt} style={[styles.tipChip, tipAmount === amt && styles.tipChipActive]} onPress={() => setTipAmount(amt)}>
                  <Text style={[styles.tipChipText, tipAmount === amt && styles.tipChipTextActive]}>{amt} coins</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.tipSend} onPress={onSendTip} disabled={tipping}>
              <Text style={styles.tipSendText}>{tipping ? 'Sending...' : 'Send Tip'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowTip(false)}><Text style={styles.tipCancel}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 92 },
  loadingWrap: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  muted: { color: COLORS.textMuted },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingTop: 0 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  coverHero: { alignItems: 'center', marginTop: SPACING.sm },
  cover: { width: 180, height: 270, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(212,168,67,0.15)' },
  titleArea: { alignItems: 'center', marginTop: SPACING.md, paddingHorizontal: SPACING.lg },
  title: { color: COLORS.text, fontFamily: FONTS.display, fontSize: 30, textAlign: 'center' },
  author: { color: COLORS.textSecondary, marginTop: 4, marginBottom: 8 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { color: COLORS.textMuted, fontSize: 12, marginLeft: 6 },
  stats: { flexDirection: 'row', justifyContent: 'space-around', marginTop: SPACING.lg, paddingHorizontal: SPACING.lg },
  stat: { alignItems: 'center' },
  statVal: { color: COLORS.text, fontWeight: '700', fontSize: 18 },
  statKey: { color: COLORS.textMuted, fontSize: 10, textTransform: 'uppercase', marginTop: 2 },
  readBtn: { marginHorizontal: SPACING.lg, marginTop: SPACING.lg, borderRadius: 14, overflow: 'hidden' },
  readGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  readText: { color: COLORS.black, fontWeight: '700', fontSize: 16 },
  secBtns: { flexDirection: 'row', gap: 10, marginHorizontal: SPACING.lg, marginTop: 10 },
  secBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  secBtnText: { color: COLORS.text, fontSize: 12, fontWeight: '600' },
  section: { marginTop: SPACING.xl, paddingHorizontal: SPACING.lg },
  sectionTitle: { color: COLORS.text, fontFamily: FONTS.display, fontSize: 20, marginBottom: SPACING.sm },
  synopsis: { color: COLORS.textSecondary, lineHeight: 23, fontSize: 14 },
  synopsisCollapsed: { maxHeight: 120, overflow: 'hidden' },
  more: { color: COLORS.secondary, marginTop: 8, fontWeight: '600' },
  noteBox: { borderWidth: 1, borderColor: 'rgba(212,168,67,0.15)', borderRadius: 12, backgroundColor: 'rgba(212,168,67,0.06)', padding: SPACING.md },
  noteText: { color: COLORS.textSecondary, fontStyle: 'italic', lineHeight: 22 },
  simCard: { width: 110, marginRight: 12 },
  simCover: { width: 110, height: 165, borderRadius: 10, backgroundColor: COLORS.surface },
  simTitle: { color: COLORS.text, marginTop: 6, fontSize: 12 },
  simAuthor: { color: COLORS.textMuted, fontSize: 10, marginTop: 2 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', padding: 12 },
  modalCard: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { color: COLORS.text, fontWeight: '700' },
  closeX: { color: COLORS.textMuted, fontSize: 20, lineHeight: 20 },
  chapterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  chNum: { width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  chNumTxt: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700' },
  chTitle: { color: COLORS.text, fontSize: 13 },
  chMeta: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  tipCard: { marginTop: '55%', backgroundColor: '#141428', borderColor: 'rgba(236,72,153,0.25)', borderWidth: 1, borderRadius: 16, padding: 16 },
  tipTitle: { color: '#f472b6', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  tipSub: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 6, marginBottom: 12 },
  tipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  tipChip: { borderWidth: 2, borderColor: 'rgba(236,72,153,0.25)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  tipChipActive: { borderColor: '#ec4899' },
  tipChipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' },
  tipChipTextActive: { color: '#f472b6' },
  tipSend: { marginTop: 14, borderRadius: 12, paddingVertical: 12, backgroundColor: '#ec4899' },
  tipSendText: { color: '#fff', textAlign: 'center', fontWeight: '700' },
  tipCancel: { color: COLORS.textMuted, textAlign: 'center', marginTop: 10 },
  reviewForm: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  reviewInput: {
    color: COLORS.text,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.secondary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  submitReviewText: { color: '#000', fontWeight: '700', fontSize: 13 },
  reviewCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  reviewAvatar: { width: 28, height: 28, borderRadius: 14 },
  newListRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: 'rgba(212,168,67,0.06)' },
  newListText: { color: COLORS.secondary, fontWeight: '600', fontSize: 13 },

  // Series banner (Push 10)
  seriesBanner: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: SPACING.md, marginVertical: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(212,168,67,0.08)',
    borderWidth: 1, borderColor: 'rgba(212,168,67,0.25)',
    gap: SPACING.sm,
  },
  seriesBannerIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(212,168,67,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  seriesBannerLabel: { color: COLORS.accent, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  seriesBannerTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700', marginTop: 2 },
  seriesBannerMeta: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  seriesBannerCta: { color: COLORS.accent, fontSize: 12, fontWeight: '700' },
});

export default BookDetailScreen;