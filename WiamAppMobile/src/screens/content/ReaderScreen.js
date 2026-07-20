import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
  Modal, Platform, Alert, ActivityIndicator, TextInput, Animated,
  Dimensions, KeyboardAvoidingView, Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import booksApi from '../../api/books';
import walletApi from '../../api/wallet';
import readerApi from '../../api/reader';
import creatorApi from '../../api/creator';
import studioV2Api from '../../api/studioV2';
import useAuthStore from '../../store/useAuthStore';
import { 
  ChevronLeft, Settings, List, X, Lock, Coins, Smile,
  MessageSquare, Heart, Send, ChevronDown, ChevronUp, UserPlus,
  Trash2, Copy, Languages, CornerDownRight, Flag, MoreVertical,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import SkeletonLoader from '../../components/common/SkeletonLoader';
import { mediumTap, successNotification, selectionTick } from '../../utils/haptics';
import { cacheChapter, getCachedChapter } from '../../services/chapterCache';
import formatNumber from '../../utils/formatNumber';
import AdBanner from '../../components/ads/AdBanner';
import PremiumBadge from '../../components/PremiumBadge';
import { useInterstitialAd } from '../../components/ads/AdInterstitial';
import { useRewardedAd } from '../../components/ads/AdRewarded';
import { canUseFeature, getUserPlan } from '../../constants/premiumEntitlements';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const THEMES = {
  light: { bg: '#faf8f5', text: '#1a1a1a', muted: '#777', border: '#e5e3df', panel: '#f0ede8', accent: '#d4a843', wmColor: 'rgba(184,146,46,0.08)' },
  dark: { bg: '#0f0f0f', text: '#d4d0c8', muted: '#888', border: '#2a2a2a', panel: '#151515', accent: '#d4a843', wmColor: 'rgba(212,168,67,0.05)' },
  sepia: { bg: '#f4ecd8', text: '#3d3224', muted: '#8a7d6b', border: '#d4c9b0', panel: '#e8dfc8', accent: '#b8860b', wmColor: 'rgba(160,120,40,0.07)' },
  // Premium-only themes
  ocean: { bg: '#0b1628', text: '#c8dce8', muted: '#6b8fa8', border: '#1a3050', panel: '#0f1e38', accent: '#38bdf8', wmColor: 'rgba(56,189,248,0.05)', premium: true },
  forest: { bg: '#0c1a0e', text: '#c8e0c4', muted: '#6b9a60', border: '#1a3a1e', panel: '#0f2412', accent: '#4ade80', wmColor: 'rgba(74,222,128,0.05)', premium: true },
  midnight: { bg: '#0a0618', text: '#d0c8e8', muted: '#8878a8', border: '#1e1438', panel: '#100c24', accent: '#c084fc', wmColor: 'rgba(192,132,252,0.05)', premium: true },
  rose: { bg: '#1a0a10', text: '#e8c8d4', muted: '#a86880', border: '#381428', panel: '#240e1a', accent: '#f472b6', wmColor: 'rgba(244,114,182,0.05)', premium: true },
};

const FONT_SIZES = { small: 15, medium: 18, large: 22, xlarge: 26 };
const FONT_FAMILIES = {
  serif: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  sans: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  mono: Platform.OS === 'ios' ? 'Courier' : 'monospace',
};
const LINE_SPACINGS = { tight: 1.4, normal: 1.8, spacious: 2.2 };
const EMOJIS = ['❤️', '😂', '😭', '😡', '😮', '🔥'];
const TIP_AMOUNTS = [5, 10, 25, 50, 100];

/** Strip HTML tags and decode entities to plain text */
const stripHtml = (html) => {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/blockquote>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n———\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/** Split content into paragraphs for reaction support */
const splitParagraphs = (html) => {
  if (!html) return [];
  const blocks = html.split(/<\/(?:p|div|h[1-6]|blockquote|li)>/gi);
  const result = [];
  for (const block of blocks) {
    const clean = block.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    if (clean.length > 0) result.push(clean);
  }
  return result;
};

const ReaderScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const { bookId, chNum = 1 } = route.params;

  // Ads hooks
  const { showInterstitial } = useInterstitialAd(bookId);
  const { showRewardedAd, isReady: rewardedReady, dailyRemaining: rewardedRemaining } = useRewardedAd(bookId);

  // Core state
  const [loading, setLoading] = useState(true);
  const [chapter, setChapter] = useState(null);
  const [bookInfo, setBookInfo] = useState(null);
  const [chapterList, setChapterList] = useState([]);
  const [currentCh, setCurrentCh] = useState(chNum);
  const [lockedInfo, setLockedInfo] = useState(null);
  const [unlocking, setUnlocking] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [creditsBalance, setCreditsBalance] = useState(0);
  const isPremium = user?.premium_status === 'active' || user?.premium_status === 'trial';
  const premiumPlan = getUserPlan(user);

  // Reader settings
  const [theme, setTheme] = useState('light');
  const [fontSizeKey, setFontSizeKey] = useState('medium');
  const [fontFamilyKey, setFontFamilyKey] = useState('serif');
  const [lineSpacingKey, setLineSpacingKey] = useState('normal');
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);

  // Author's Note collapse state
  const [introExpanded, setIntroExpanded] = useState(false);

  // Follow creator
  const [isFollowing, setIsFollowing] = useState(false);
  const [followDismissed, setFollowDismissed] = useState(false);

  // Tip
  const [tipAmount, setTipAmount] = useState(10);
  const [tipping, setTipping] = useState(false);

  // Paragraph reactions
  const [reactions, setReactions] = useState({});
  const [userReactions, setUserReactions] = useState({});
  const [commentCounts, setCommentCounts] = useState({});
  const [emojiPickerIdx, setEmojiPickerIdx] = useState(null);

  // Comment thread
  const [showThread, setShowThread] = useState(false);
  const [threadParaIdx, setThreadParaIdx] = useState(null);
  const [threadComments, setThreadComments] = useState([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [quoteExpanded, setQuoteExpanded] = useState(false);
  const [visibleReplies, setVisibleReplies] = useState({});
  const [contextMenu, setContextMenu] = useState({ visible: false, comment: null, canDelete: false, topLevelId: null });

  // Scroll & chapter navigation
  const scrollRef = useRef(null);
  const [loadingNext, setLoadingNext] = useState(false);
  const [showNextConfirm, setShowNextConfirm] = useState(false);

  // Push 10 — next-in-series CTA on the last chapter
  const [nextInSeries, setNextInSeries] = useState(null);

  // Reading progress — paragraph-level tracking
  const [resumeParaIdx, setResumeParaIdx] = useState(-1);
  const [progressRestored, setProgressRestored] = useState(false);
  const topVisiblePara = useRef(0);
  const positionSaveTimer = useRef(null);
  const contentHeight = useRef(0);
  const scrollY = useRef(0);
  const paraLayoutsRef = useRef([]);

  // Derived
  const colors = THEMES[theme];
  const fontSize = FONT_SIZES[fontSizeKey] || 18;
  const fontFamily = FONT_FAMILIES[fontFamilyKey] || FONT_FAMILIES.serif;
  const lineHeight = fontSize * (LINE_SPACINGS[lineSpacingKey] || 1.8);

  // Auth guard
  useEffect(() => {
    if (isAuthenticated) return;
    const parent = navigation.getParent?.();
    if (navigation.getState?.().routeNames?.includes('Login')) {
      navigation.replace('Login');
      return;
    }
    if (parent?.getState?.().routeNames?.includes('Login')) {
      parent.navigate('Login');
      return;
    }
    navigation.goBack();
  }, [isAuthenticated, navigation]);

  // Fetch book info + chapter list once
  useEffect(() => {
    (async () => {
      try {
        const detail = await booksApi.getBookDetail(bookId);
        setBookInfo(detail);
        const chapters = detail?.chapters || detail?.book?.chapters || [];
        setChapterList(chapters);
        // Set follow status
        const creatorFollowing = detail?.creator?.is_following;
        if (creatorFollowing !== undefined) setIsFollowing(creatorFollowing);
      } catch {}
      // Fetch premium credits balance
      if (isPremium) {
        walletApi.getPremiumStatus().then((s) => setCreditsBalance(s?.credits_balance || 0)).catch(() => {});
      }
    })();
  }, [bookId]);

  const loadChapter = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setLockedInfo(null);
    setLoadError(null);
    try {
      const data = await booksApi.readChapter(bookId, currentCh);
      setChapter(data);
      cacheChapter(bookId, currentCh, data, { plan: premiumPlan }).catch(() => {});
    } catch (err) {
      if (err && err.locked) {
        setLockedInfo({ price: err.price, premiumLocked: err.premiumLocked });
      } else {
        const canUseOffline = canUseFeature(user, 'smart_chapter_cache');
        const cached = canUseOffline ? await getCachedChapter(bookId, currentCh) : null;
        if (cached) {
          setChapter(cached);
        } else {
          setLoadError(typeof err === 'string' ? err : err?.message || 'Could not load chapter. Please try again.');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [bookId, currentCh, isAuthenticated]);

  useEffect(() => { loadChapter(); }, [loadChapter]);

  // Scroll to top when chapter changes (restore handled separately after paragraphs render)
  useEffect(() => {
    if (!progressRestored) return;
    scrollRef.current?.scrollTo?.({ y: 0, animated: false });
  }, [currentCh]);

  // ── Push 3 — time-based view counter ──
  // Fire /books/<id>/record-view after the reader has spent 30 seconds on
  // a chapter. Backend dedupes per user/book/day and writes a book_view row
  // to w_analytics_events, which Push 4 reads to compute popularity.
  useEffect(() => {
    if (!bookId || !chapter || lockedInfo) return;
    const timer = setTimeout(() => {
      booksApi.recordView(bookId).catch(() => {});
    }, 30000);
    return () => clearTimeout(timer);
  }, [bookId, currentCh, chapter, lockedInfo]);

  // Load paragraph reactions + comment counts
  useEffect(() => {
    if (!chapter || lockedInfo) return;
    (async () => {
      try {
        const [rRes, cRes] = await Promise.all([
          readerApi.getReactions(bookId, currentCh).catch(() => ({ reactions: {}, user_reactions: {} })),
          readerApi.getCommentCounts(bookId, currentCh).catch(() => ({ counts: {} })),
        ]);
        setReactions(rRes.reactions || {});
        setUserReactions(rRes.user_reactions || {});
        setCommentCounts(cRes.counts || {});
      } catch {}
    })();
  }, [bookId, currentCh, chapter, lockedInfo]);

  // Screenshot protection
  useEffect(() => {
    let cleanup;
    (async () => {
      try {
        const ScreenCapture = await import('expo-screen-capture');
        await ScreenCapture.preventScreenCaptureAsync('reader');
        cleanup = () => ScreenCapture.allowScreenCaptureAsync('reader').catch(() => {});
      } catch {}
    })();
    return () => { if (cleanup) cleanup(); };
  }, []);

  // ── Restore reading progress: check AsyncStorage first, then backend ──
  useEffect(() => {
    if (!bookInfo || progressRestored) return;
    (async () => {
      try {
        // 1) Try AsyncStorage (instant local restore)
        const localKey = `wiam_progress_${bookId}`;
        const local = await AsyncStorage.getItem(localKey);
        let savedCh = 0, savedPara = 0;
        if (local) {
          const parsed = JSON.parse(local);
          savedCh = parsed.chapter || 0;
          savedPara = parsed.paragraph || 0;
        }
        // 2) Fallback to backend reading_progress
        const rp = bookInfo?.reading_progress;
        if (!savedCh && rp && rp.current_chapter) {
          savedCh = rp.current_chapter;
          savedPara = rp.current_paragraph || 0;
        }
        // 3) Apply: jump to saved chapter + paragraph
        if (savedCh > 0 && savedCh !== currentCh) {
          setResumeParaIdx(savedPara);
          setCurrentCh(savedCh);
        } else if (savedPara > 0) {
          setResumeParaIdx(savedPara);
        }
      } catch {}
      setProgressRestored(true);
    })();
  }, [bookInfo]);

  // ── Scroll to resume paragraph after paragraphs render ──
  useEffect(() => {
    if (resumeParaIdx <= 0 || loading || !(paragraphs || []).length) return;
    // Wait for layout to settle then scroll to the paragraph
    const timer = setTimeout(() => {
      const layouts = paraLayoutsRef.current;
      if (layouts[resumeParaIdx]) {
        const y = layouts[resumeParaIdx];
        scrollRef.current?.scrollTo?.({ y: Math.max(0, y - 80), animated: true });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [resumeParaIdx, loading, (paragraphs || []).length]);

  // ── Save reading position every 3 seconds to AsyncStorage + backend ──
  useEffect(() => {
    positionSaveTimer.current = setInterval(() => {
      if (contentHeight.current > 0 && scrollY.current > 0) {
        const pct = Math.round((scrollY.current / contentHeight.current) * 100);
        const paraIdx = topVisiblePara.current || 0;
        // Save to AsyncStorage (instant)
        AsyncStorage.setItem(`wiam_progress_${bookId}`, JSON.stringify({
          chapter: currentCh, paragraph: paraIdx, position: Math.min(pct, 100),
        })).catch(() => {});
        // Sync to backend
        readerApi.savePosition(bookId, currentCh, Math.min(pct, 100), paraIdx).catch(() => {});
      }
    }, 3000);
    return () => clearInterval(positionSaveTimer.current);
  }, [bookId, currentCh]);

  // ── Handlers ──
  const handleUnlock = async () => {
    if (!lockedInfo) return;
    setUnlocking(true);
    try {
      const result = await walletApi.unlockChapter(bookId, currentCh);
      if (result.ok) {
        successNotification();
        setLockedInfo(null);
        loadChapter();
      } else {
        Alert.alert('Unlock Failed', result.error || 'Could not unlock chapter.');
      }
    } catch (err) {
      const data = err.response?.data || {};
      if (data.need_coins) {
        Alert.alert('Not Enough Coins', `You need ${lockedInfo.price} coins. Buy more in the Wallet.`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Wallet', onPress: () => navigation.navigate('Wallet') },
        ]);
      } else {
        Alert.alert('Error', data.error || 'Could not unlock chapter.');
      }
    } finally {
      setUnlocking(false);
    }
  };

  const handleReact = async (paraIdx, emoji) => {
    selectionTick();
    // Optimistic update — show reaction immediately
    const prevReactions = { ...reactions };
    const prevUserReactions = { ...userReactions };
    const isToggleOff = userReactions[paraIdx] === emoji;
    setUserReactions((prev) => ({ ...prev, [paraIdx]: isToggleOff ? null : emoji }));
    setReactions((prev) => {
      const para = { ...(prev[paraIdx] || {}) };
      if (isToggleOff) {
        para[emoji] = Math.max(0, (para[emoji] || 1) - 1);
        if (para[emoji] === 0) delete para[emoji];
      } else {
        // Remove previous reaction if any
        const prevEmoji = userReactions[paraIdx];
        if (prevEmoji && para[prevEmoji]) {
          para[prevEmoji] = Math.max(0, para[prevEmoji] - 1);
          if (para[prevEmoji] === 0) delete para[prevEmoji];
        }
        para[emoji] = (para[emoji] || 0) + 1;
      }
      return { ...prev, [paraIdx]: para };
    });
    setEmojiPickerIdx(null);
    try {
      await readerApi.react(bookId, currentCh, paraIdx, emoji);
      // Sync with server
      const rRes = await readerApi.getReactions(bookId, currentCh).catch(() => null);
      if (rRes) {
        setReactions(rRes.reactions || {});
        setUserReactions(rRes.user_reactions || {});
      }
    } catch (err) {
      // Revert on failure
      setReactions(prevReactions);
      setUserReactions(prevUserReactions);
      Alert.alert('Oops', 'Could not save reaction. Please try again.');
    }
  };

  const openThread = async (paraIdx) => {
    setThreadParaIdx(paraIdx);
    setShowThread(true);
    setThreadLoading(true);
    setThreadComments([]);
    setReplyingTo(null);
    setQuoteExpanded(false);
    setVisibleReplies({});
    setCommentText('');
    try {
      const res = await readerApi.getComments(bookId, currentCh, paraIdx);
      setThreadComments(res.comments || []);
    } catch {}
    setThreadLoading(false);
  };

  const sendComment = async () => {
    if (!commentText.trim() || sendingComment) return;
    const text = commentText.trim();
    setSendingComment(true);
    Keyboard.dismiss();
    try {
      // If replying to a reply, use the top-level parent ID so all replies stay 1 level deep
      const topLevelId = replyingTo?._topLevelId || replyingTo?.id || null;
      const res = await readerApi.addComment(bookId, currentCh, threadParaIdx, text, topLevelId);
      const optimistic = {
        id: res?.comment?.id || Date.now(),
        text: res?.comment?.text || text,
        user_name: res?.comment?.user_name || user?.first_name || 'You',
        user_initial: res?.comment?.user_initial || (user?.first_name || 'Y')[0].toUpperCase(),
        user_id: res?.comment?.user_id || user?.id || user?.wiam_id,
        created_at: res?.comment?.created_at || 'Just now',
        like_count: 0,
        liked: false,
        replies: [],
      };
      if (topLevelId) {
        // Add reply under the top-level parent comment
        setThreadComments((prev) => prev.map((c) => {
          if (c.id === topLevelId) {
            const newReplies = [...(c.replies || []), optimistic];
            return { ...c, replies: newReplies };
          }
          return c;
        }));
        // Auto-show the new reply
        setVisibleReplies((prev) => {
          const cur = prev[topLevelId] || 3;
          const total = (threadComments.find((c) => c.id === topLevelId)?.replies?.length || 0) + 1;
          return { ...prev, [topLevelId]: Math.max(cur, total) };
        });
      } else {
        setThreadComments((prev) => [optimistic, ...prev]);
      }
      setCommentText('');
      setReplyingTo(null);
      mediumTap();
      setCommentCounts((prev) => ({
        ...prev,
        [threadParaIdx]: (prev[threadParaIdx] || 0) + 1,
      }));
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || err?.message || 'Could not post comment. Check your connection.');
    }
    setSendingComment(false);
  };

  const handleDeleteComment = (commentId, topLevelId = null) => {
    Alert.alert('Delete Comment', 'Are you sure? This will also delete all replies.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await readerApi.deleteComment(commentId);
            setContextMenu({ visible: false, comment: null, canDelete: false, topLevelId: null });
            if (topLevelId && topLevelId !== commentId) {
              // Deleting a reply — remove it from the parent's replies
              setThreadComments((prev) => prev.map((c) => {
                if (c.id === topLevelId) {
                  return { ...c, replies: (c.replies || []).filter((r) => r.id !== commentId) };
                }
                return c;
              }));
              setCommentCounts((prev) => ({
                ...prev,
                [threadParaIdx]: Math.max(0, (prev[threadParaIdx] || 1) - 1),
              }));
            } else {
              // Deleting a top-level comment — remove it AND all its replies
              const target = threadComments.find((c) => c.id === commentId);
              const replyCount = target?.replies?.length || 0;
              setThreadComments((prev) => prev.filter((c) => c.id !== commentId));
              setCommentCounts((prev) => ({
                ...prev,
                [threadParaIdx]: Math.max(0, (prev[threadParaIdx] || 1) - 1 - replyCount),
              }));
            }
            mediumTap();
            Alert.alert('Deleted', 'Comment has been deleted.');
          } catch {
            Alert.alert('Error', 'Could not delete comment.');
          }
        },
      },
    ]);
  };

  const handleCopyComment = async (text) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('Copied', 'Comment copied to clipboard.');
    } catch {
      Alert.alert('Error', 'Could not copy text.');
    }
  };

  const handleTranslateComment = async (text, commentId) => {
    try {
      if (!text || text.trim().length < 2) {
        Alert.alert('Translation', 'Nothing to translate.');
        return;
      }
      setContextMenu({ visible: false, comment: null, canDelete: false, topLevelId: null });
      // Use Google Translate free API
      const encoded = encodeURIComponent(text.trim());
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encoded}`;
      const res = await fetch(url);
      const json = await res.json();
      // Response format: [[['translated segment', 'original segment', ...], ...], ...]
      let result = '';
      if (Array.isArray(json) && Array.isArray(json[0])) {
        for (const segment of json[0]) {
          if (segment && segment[0]) result += segment[0];
        }
      }
      if (result && result.trim().toLowerCase() !== text.trim().toLowerCase()) {
        setThreadComments((prev) =>
          prev.map((c) => {
            if (c.id === commentId) return { ...c, translated: result };
            if (c.replies?.length) {
              return { ...c, replies: c.replies.map((r) => r.id === commentId ? { ...r, translated: result } : r) };
            }
            return c;
          })
        );
      } else {
        Alert.alert('Translation', 'Text is already in English or could not be translated.');
      }
    } catch {
      Alert.alert('Error', 'Could not translate. Check your connection.');
    }
  };

  const handleReport = (commentId) => {
    setContextMenu({ visible: false, comment: null, canDelete: false, topLevelId: null });
    const submitReport = async (category, label) => {
      try {
        await readerApi.reportComment(commentId, category, `Reported from reader app (${label})`);
        Alert.alert('Report submitted', 'Thank you. Our moderation team will review this comment.');
      } catch (e) {
        Alert.alert('Report failed', e?.response?.data?.error || 'Could not submit report right now.');
      }
    };

    Alert.alert(
      'Report comment',
      'Choose a reason:',
      [
        { text: 'Spam', onPress: () => submitReport('spam', 'spam') },
        { text: 'Harassment', onPress: () => submitReport('harassment', 'harassment') },
        { text: 'Hate', onPress: () => submitReport('hate', 'hate') },
        { text: 'NSFW', onPress: () => submitReport('nsfw', 'nsfw') },
        { text: 'Other', onPress: () => submitReport('other', 'other') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleLikeComment = async (commentId) => {
    try {
      const res = await readerApi.likeComment(commentId);
      setThreadComments((prev) =>
        prev.map((c) => {
          if (c.id === commentId) return { ...c, liked: res.liked, like_count: res.count };
          if (c.replies?.length) {
            return { ...c, replies: c.replies.map((r) => r.id === commentId ? { ...r, liked: res.liked, like_count: res.count } : r) };
          }
          return c;
        })
      );
    } catch {}
  };

  const handleFollow = async () => {
    const creatorId = bookInfo?.creator?.id;
    if (!creatorId) return;
    try {
      const res = await creatorApi.toggleFollow(creatorId);
      if (res.following) {
        setIsFollowing(true);
        setFollowDismissed(true);
        successNotification();
      }
    } catch {}
  };

  const handleTip = async () => {
    if (tipping) return;
    setTipping(true);
    try {
      const res = await booksApi.tipCreator(bookId, tipAmount);
      Alert.alert('Tip Sent!', `You sent ${tipAmount} coins. Thank you!`);
      successNotification();
    } catch (err) {
      if (err.needCoins) {
        Alert.alert('Not Enough Coins', 'Buy more coins in the Wallet.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Wallet', onPress: () => navigation.navigate('Wallet') },
        ]);
      } else {
        Alert.alert('Error', err.message || 'Could not send tip.');
      }
    }
    setTipping(false);
  };

  // Track scroll position + compute top visible paragraph for progress save
  const handleScroll = (e) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    scrollY.current = contentOffset.y;
    contentHeight.current = contentSize.height - layoutMeasurement.height;
    // Compute top visible paragraph index
    const layouts = paraLayoutsRef.current;
    let topPara = 0;
    for (let i = 0; i < (layouts || []).length; i++) {
      if (layouts[i] != null && layouts[i] <= contentOffset.y + 100) {
        topPara = i;
      } else if (layouts[i] != null && layouts[i] > contentOffset.y + 100) {
        break;
      }
    }
    topVisiblePara.current = topPara;
    const distToBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    if (distToBottom < 80 && canNext && !showNextConfirm) {
      setShowNextConfirm(true);
    }
  };

  const goToNextChapter = () => {
    setShowNextConfirm(false);
    setResumeParaIdx(-1);
    paraLayoutsRef.current = [];
    setLoadingNext(true);
    // Show interstitial ad between chapters (respects frequency caps)
    showInterstitial(currentCh + 1);
    setTimeout(() => {
      setCurrentCh((c) => c + 1);
      setLoadingNext(false);
    }, 400);
  };

  // Derived values
  const totalChapters = chapter?.total_chapters || (chapterList || []).length || 0;
  const canPrev = currentCh > 1;
  const canNext = currentCh < totalChapters;
  const isLastChapter = totalChapters > 0 && currentCh >= totalChapters;

  // Push 10 — when reader hits the final chapter, fetch the next book in series.
  useEffect(() => {
    if (!isLastChapter || !bookId) {
      setNextInSeries(null);
      return;
    }
    let cancelled = false;
    studioV2Api.getNextInSeries(bookId)
      .then((res) => {
        if (cancelled) return;
        setNextInSeries(res?.next ? { ...res.next, _series: res.series } : null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isLastChapter, bookId]);

  const paragraphs = useMemo(() => {
    if (!chapter?.content) return [];
    return splitParagraphs(chapter.content);
  }, [chapter?.content]);

  const unitLabel = useMemo(() => {
    const fromChapter = chapter?.unit_label || chapter?.content_unit_label;
    const fromBook = bookInfo?.content_unit_label;
    const fromList = chapterList?.[0]?.unit_label || chapterList?.[0]?.content_unit_label;
    return String(fromChapter || fromBook || fromList || 'chapter').toLowerCase();
  }, [chapter?.unit_label, chapter?.content_unit_label, bookInfo?.content_unit_label, chapterList]);
  const unitCap = unitLabel.charAt(0).toUpperCase() + unitLabel.slice(1);

  const bookTitle = bookInfo?.title || bookInfo?.book?.title || chapter?.book_title || '';
  const introText = bookInfo?.introduction || bookInfo?.book?.introduction || '';
  const creatorName = bookInfo?.creator?.display_name || bookInfo?.creator?.username || '';
  const creatorId = bookInfo?.creator?.id;
  const isOwnBook = user && creatorId && (user.id === creatorId || (user.wiam_id && user.wiam_id === bookInfo?.creator?.wiam_id));

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.bg }]}>
        <SkeletonLoader.ListItem count={3} />
      </View>
    );
  }

  if (loadError && !chapter && !lockedInfo) {
  return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.bg }]}>
        <Text style={{ color: colors.muted, fontSize: 16, textAlign: 'center', marginBottom: 16, paddingHorizontal: 24 }}>{loadError}</Text>
        <TouchableOpacity style={{ backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }} onPress={loadChapter}>
          <Text style={{ color: '#000', fontWeight: '700', fontSize: 15 }}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 16 }} onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* ── Top bar: only "CHAPTER X" ── */}
      <View style={[styles.topbar, { backgroundColor: colors.panel, borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.topBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={20} color={colors.muted} />
        </TouchableOpacity>
        <Text numberOfLines={1} style={[styles.topTitle, { color: colors.text }]}>
          CHAPTER {currentCh}
        </Text>
        <View style={styles.topRight}>
          <TouchableOpacity style={styles.iconOnly} onPress={() => setShowToc(true)}>
            <List size={20} color={colors.muted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconOnly}
            onPress={() => setShowSettings((v) => !v)}
          >
            <Settings size={20} color={showSettings ? colors.accent : colors.muted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Settings dropdown — full panel ── */}
      {showSettings && (
        <View style={[styles.settingsPanel, { backgroundColor: colors.panel, borderColor: colors.border, top: insets.top + 52 }]}>
          {/* Theme */}
          <Text style={[styles.settingLabel, { color: colors.muted }]}>THEME</Text>
          <View style={styles.themeRow}>
            {Object.keys(THEMES).filter((t) => !THEMES[t].premium).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.themeBtn, { backgroundColor: THEMES[t].bg, borderColor: theme === t ? colors.accent : colors.border }]}
                onPress={() => { selectionTick(); setTheme(t); }}
              >
                {theme === t && <View style={[styles.themeDot, { backgroundColor: colors.accent }]} />}
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.settingLabel, { color: colors.muted, marginTop: 10 }]}>PREMIUM THEMES</Text>
          <View style={styles.themeRow}>
            {Object.keys(THEMES).filter((t) => THEMES[t].premium).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.themeBtn, {
                  backgroundColor: THEMES[t].bg,
                  borderColor: theme === t ? THEMES[t].accent : colors.border,
                  opacity: canUseFeature(user, 'custom_reader_themes') ? 1 : 0.4,
                }]}
                onPress={() => {
                  if (!canUseFeature(user, 'custom_reader_themes')) {
                    Alert.alert(
                      'Unlimited Feature',
                      'Custom themes are available on WiamPremium Unlimited.',
                      [
                        { text: 'View Plans', onPress: () => navigation.navigate('PremiumScreen') },
                        { text: 'Cancel', style: 'cancel' },
                      ]
                    );
                    return;
                  }
                  selectionTick(); setTheme(t);
                }}
              >
                {theme === t && <View style={[styles.themeDot, { backgroundColor: THEMES[t].accent }]} />}
                {!canUseFeature(user, 'custom_reader_themes') && <Lock size={10} color={THEMES[t].accent} style={{ position: 'absolute' }} />}
              </TouchableOpacity>
            ))}
          </View>

          {/* Font Size: 4 sizes */}
          <Text style={[styles.settingLabel, { color: colors.muted, marginTop: 14 }]}>FONT SIZE</Text>
          <View style={styles.optionRow}>
            {Object.entries(FONT_SIZES).map(([key, sz]) => (
              <TouchableOpacity
                key={key}
                style={[styles.optBtn, { borderColor: fontSizeKey === key ? colors.accent : colors.border, backgroundColor: fontSizeKey === key ? 'rgba(212,168,67,0.12)' : 'transparent' }]}
                onPress={() => { selectionTick(); setFontSizeKey(key); }}
              >
                <Text style={{ color: fontSizeKey === key ? colors.accent : colors.text, fontSize: sz > 20 ? 16 : sz, fontWeight: fontSizeKey === key ? '700' : '400' }}>A</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Font Family */}
          <Text style={[styles.settingLabel, { color: colors.muted, marginTop: 14 }]}>FONT</Text>
          <View style={styles.optionRow}>
            {Object.entries(FONT_FAMILIES).map(([key, ff]) => (
              <TouchableOpacity
                key={key}
                style={[styles.optBtnWide, { borderColor: fontFamilyKey === key ? colors.accent : colors.border, backgroundColor: fontFamilyKey === key ? 'rgba(212,168,67,0.12)' : 'transparent' }]}
                onPress={() => { selectionTick(); setFontFamilyKey(key); }}
              >
                <Text style={{ color: fontFamilyKey === key ? colors.accent : colors.text, fontSize: 12, fontWeight: fontFamilyKey === key ? '700' : '400', fontFamily: ff }}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Line Spacing */}
          <Text style={[styles.settingLabel, { color: colors.muted, marginTop: 14 }]}>LINE SPACING</Text>
          <View style={styles.optionRow}>
            {Object.keys(LINE_SPACINGS).map((key) => (
              <TouchableOpacity
                key={key}
                style={[styles.optBtnWide, { borderColor: lineSpacingKey === key ? colors.accent : colors.border, backgroundColor: lineSpacingKey === key ? 'rgba(212,168,67,0.12)' : 'transparent' }]}
                onPress={() => { selectionTick(); setLineSpacingKey(key); }}
              >
                <Text style={{ color: lineSpacingKey === key ? colors.accent : colors.text, fontSize: 11, fontWeight: lineSpacingKey === key ? '700' : '400' }}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* ── Fixed watermark overlay (does NOT scroll) ── */}
      <View style={styles.watermarkFixed} pointerEvents="none">
        {Array.from({ length: 8 }).map((_, row) =>
          Array.from({ length: 4 }).map((_, col) => (
            <Text
              key={`wm-${row}-${col}`}
              style={[
                styles.watermarkText,
                {
                  top: 40 + row * (SCREEN_H / 6),
                  left: -30 + col * (SCREEN_W / 2.5) + (row % 2 === 0 ? 0 : 50),
                  color: 'rgba(212,168,67,0.06)',
                },
              ]}
            >
              WiamApp
            </Text>
          ))
        )}
      </View>

      {/* ── Main scroll content ── */}
      <ScrollView 
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.readWrap, { paddingTop: insets.top + 70 }]}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        selectable={false}
      >
        {/* Author's Note — only chapter 1 and if introduction exists */}
        {currentCh === 1 && introText ? (
          <View style={[styles.authorsNote, { borderLeftColor: colors.accent }]}>
            <TouchableOpacity
              style={styles.authorsNoteHeader}
              onPress={() => setIntroExpanded((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={[styles.authorsNoteLabel, { color: colors.accent }]}>
                {'\u276E\u276F'} Author's Note
        </Text>
              {introExpanded
                ? <ChevronUp size={14} color={colors.accent} />
                : <ChevronDown size={14} color={colors.accent} />
              }
            </TouchableOpacity>
            {introExpanded && (
              <View style={styles.authorsNoteBody}>
                <Text style={[styles.authorsNoteText, { color: colors.muted }]}>
                  {stripHtml(introText)}
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {/* Chapter title — below Author's Note */}
        {chapter?.title ? (
          <Text style={[styles.chapterTitle, { color: colors.text, borderBottomColor: colors.border }]}>
            {chapter.title}
          </Text>
        ) : null}

        {lockedInfo ? (
          <View style={[styles.lockOverlay, { backgroundColor: colors.panel, borderColor: colors.border }]}>
            <Lock size={40} color={colors.accent} />
            <Text style={[styles.lockTitle, { color: colors.text }]}>Chapter Locked</Text>
            <Text style={[styles.lockDesc, { color: colors.muted }]}>
              {lockedInfo.premiumLocked
                ? 'This chapter requires a premium subscription.'
                : `Unlock this chapter for ${lockedInfo.price} coins.`}
            </Text>
            {lockedInfo.premiumLocked && (
              <TouchableOpacity
                style={[styles.rewardedBtn, { borderColor: '#c084fc', marginTop: 4 }]}
                onPress={() => navigation.navigate('PremiumScreen')}
              >
                <Text style={[styles.rewardedBtnText, { color: '#c084fc' }]}>
                  View WiamPremium Plans
                </Text>
              </TouchableOpacity>
            )}
            {!lockedInfo.premiumLocked && (
              <TouchableOpacity
                style={[styles.unlockBtn, { backgroundColor: colors.accent }]}
                onPress={handleUnlock}
                disabled={unlocking}
              >
                {unlocking ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Coins size={16} color="#fff" />
                    <Text style={styles.unlockBtnText}>Unlock for {lockedInfo.price} Coins</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {/* Rewarded ad option: watch ad to unlock for free */}
            {!lockedInfo.premiumLocked && rewardedReady && rewardedRemaining > 0 && (
              <TouchableOpacity
                style={[styles.rewardedBtn, { borderColor: colors.accent }]}
                onPress={() => showRewardedAd(async () => {
                  try {
                    await walletApi.rewardAdUnlock(bookId, currentCh);
                  } catch {}
                  successNotification();
                  setLockedInfo(null);
                  loadChapter();
                })}
              >
                <Text style={[styles.rewardedBtnText, { color: colors.accent }]}>
                  ▶ Watch Ad to Unlock Free ({rewardedRemaining}/day)
                </Text>
              </TouchableOpacity>
            )}
            {/* Premium credit unlock option */}
            {isPremium && creditsBalance > 0 && !lockedInfo.premiumLocked && (
              <TouchableOpacity
                style={[styles.rewardedBtn, { borderColor: '#a855f7', marginTop: 8 }]}
                onPress={async () => {
                  setUnlocking(true);
                  try {
                    const res = await walletApi.unlockWithCredit(bookId, currentCh);
                    if (res.ok) {
                      setCreditsBalance(res.credits_balance);
                      successNotification();
                      setLockedInfo(null);
                      loadChapter();
                    }
                  } catch (e) {
                    Alert.alert('Error', e?.response?.data?.error || 'Could not unlock with credit');
                  } finally { setUnlocking(false); }
                }}
                disabled={unlocking}
              >
                <Text style={[styles.rewardedBtnText, { color: '#a855f7' }]}>
                  Use 1 Premium Credit ({creditsBalance} left)
          </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.walletLink} onPress={() => navigation.navigate('Wallet')}>
              <Text style={[styles.walletLinkText, { color: colors.accent }]}>Go to Wallet</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.walletLink, { marginTop: 4 }]} onPress={() => navigation.navigate('PremiumScreen')}>
              <Text style={[styles.walletLinkText, { color: '#c084fc' }]}>Remove Ads — Try Premium</Text>
            </TouchableOpacity>
        </View>
        ) : (
          <View>
            {/* Chapter body paragraphs */}
            {paragraphs.map((para, idx) => {
              const paraReactions = reactions[idx] || {};
              const myReaction = userReactions[idx] || null;
              const cCount = commentCounts[idx] || 0;
              const hasReactions = Object.keys(paraReactions).length > 0;
              const isResumeLine = idx === resumeParaIdx;

              const paraGap = lineSpacingKey === 'tight' ? 2 : lineSpacingKey === 'spacious' ? 14 : 6;

              return (
                <View
                  key={`p-${idx}`}
                  style={[styles.paraBlock, { marginBottom: paraGap }]}
                  onLayout={(e) => {
                    paraLayoutsRef.current[idx] = e.nativeEvent.layout.y;
                  }}
                >
                  {/* Gold resume marker */}
                  {isResumeLine && (
                    <View style={styles.resumeMarker}>
                      <View style={styles.resumeLine} />
                      <Text style={styles.resumeLabel}>You stopped here</Text>
                      <View style={styles.resumeLine} />
                    </View>
                  )}

                  {idx === 0 && (para || '').length > 0 ? (
                    <Text selectable={false} style={[styles.body, { color: colors.text, fontSize, lineHeight, fontFamily }]}>
                      <Text style={[styles.dropCap, { color: colors.accent, fontSize: fontSize * 1.5 }]}>{para[0]}</Text>
                      {para.slice(1)}
                    </Text>
                  ) : (
                    <Text selectable={false} style={[styles.body, { color: colors.text, fontSize, lineHeight, fontFamily, textIndent: 24 }]}>
                      {para}
                    </Text>
                  )}

                  {/* Paragraph controls — emoji btn | reaction badges | comment btn */}
                  <View style={styles.paraControls}>
          <TouchableOpacity 
                      style={[styles.paraCtrlBtn, { backgroundColor: emojiPickerIdx === idx ? 'rgba(212,168,67,0.12)' : 'transparent' }]}
                      onPress={() => setEmojiPickerIdx(emojiPickerIdx === idx ? null : idx)}
          >
                      <Smile size={14} color={emojiPickerIdx === idx ? colors.accent : colors.muted} />
          </TouchableOpacity>
                    {hasReactions && Object.entries(paraReactions).map(([emoji, count]) => (
                      <TouchableOpacity
                        key={`${idx}-${emoji}`}
                        style={[styles.emojiBadge, myReaction === emoji && styles.emojiBadgeActive]}
                        onPress={() => handleReact(idx, emoji)}
                      >
                        <Text style={styles.emojiBadgeIcon}>{emoji}</Text>
                        <Text style={[styles.emojiBadgeCount, { color: colors.muted }]}>{count}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={[styles.paraCtrlBtn, { position: 'relative' }]}
                      onPress={() => openThread(idx)}
                    >
                      <MessageSquare size={14} color={colors.muted} />
                      {cCount > 0 && (
                        <View style={styles.ctrlCount}>
                          <Text style={styles.ctrlCountText}>{cCount}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                  {/* Emoji picker — appears below controls when active */}
                  {emojiPickerIdx === idx && (
                    <View style={[styles.emojiPicker, { backgroundColor: colors.panel, borderColor: colors.border }]}>
                      {EMOJIS.map((em) => (
                        <TouchableOpacity
                          key={em}
                          style={[styles.emojiOpt, myReaction === em && { backgroundColor: 'rgba(212,168,67,0.2)' }]}
                          onPress={() => handleReact(idx, em)}
                        >
                          <Text style={{ fontSize: 18 }}>{em}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
            {(paragraphs || []).length === 0 && chapter?.content ? (
              <Text selectable={false} style={[styles.body, { color: colors.text, fontSize, lineHeight, fontFamily }]}>
                {stripHtml(chapter.content)}
              </Text>
            ) : null}

            {/* ── Tip Creator Panel ── */}
            {!isOwnBook && (
              <View style={[styles.tipPanel, { backgroundColor: colors.panel, borderColor: colors.border }]}>
                <View style={styles.tipIconWrap}>
                  <Heart size={22} color="#ec4899" fill="#ec4899" />
                </View>
                <Text style={[styles.tipTitle, { color: colors.text }]}>
                  Enjoying this chapter?
                </Text>
                <Text style={[styles.tipLabel, { color: colors.muted }]}>
                  Send a coin tip to show your appreciation
                </Text>
                <View style={styles.tipRow}>
                  {TIP_AMOUNTS.map((amt) => (
          <TouchableOpacity 
                      key={amt}
                      style={[styles.tipAmtBtn, { borderColor: tipAmount === amt ? '#ec4899' : colors.border, backgroundColor: tipAmount === amt ? 'rgba(236,72,153,0.12)' : 'transparent' }]}
                      onPress={() => setTipAmount(amt)}
          >
                      <Coins size={12} color={tipAmount === amt ? '#ec4899' : colors.muted} />
                      <Text style={{ color: tipAmount === amt ? '#ec4899' : colors.muted, fontSize: 13, fontWeight: tipAmount === amt ? '700' : '400' }}>{amt}</Text>
          </TouchableOpacity>
                  ))}
        </View>
                <TouchableOpacity style={styles.tipBtn} onPress={handleTip} disabled={tipping}>
                  {tipping ? (
                    <ActivityIndicator size={16} color="#fff" />
                  ) : (
                    <>
                      <Heart size={14} color="#fff" fill="#fff" />
                      <Text style={styles.tipBtnText}>Send {tipAmount} Coins</Text>
                    </>
                  )}
                </TouchableOpacity>
                {creatorName ? (
                  <Text style={[styles.tipCreatorName, { color: colors.muted }]}>
                    Supporting <Text style={{ color: colors.accent, fontWeight: '700' }}>{creatorName}</Text>
                  </Text>
                ) : null}
              </View>
            )}

            {/* ── Follow / Ad Panel (dynamic transition) ── */}
            {!isOwnBook && creatorName && (
              <>
                {/* Show follow panel if NOT following and NOT dismissed */}
                {!isFollowing && !followDismissed ? (
                  <View style={[styles.followPanel, { backgroundColor: colors.panel, borderColor: colors.border }]}>
                    <View style={styles.followGlow} />
                    <View style={[styles.followAvatarLg, { borderColor: colors.accent }]}>
                      <Text style={{ color: colors.accent, fontSize: 26, fontWeight: '700' }}>
                        {creatorName[0]?.toUpperCase() || 'W'}
                      </Text>
      </View>
                    <Text style={[styles.followName, { color: colors.text }]}>{creatorName}</Text>
                    {bookInfo?.creator?.follower_count != null && (
                      <Text style={[styles.followStats, { color: colors.muted }]}>
                        {formatNumber(bookInfo.creator.follower_count)} followers
                      </Text>
                    )}
                    <Text style={[styles.followDesc, { color: colors.muted }]}>
                      Follow to get notified when new chapters drop
                    </Text>
                    {bookInfo?.creator?.recent_books?.length > 0 && (
                      <View style={styles.followRecentRow}>
                        <Text style={[styles.followRecentLabel, { color: colors.muted }]}>Recent stories:</Text>
                        {bookInfo.creator.recent_books.slice(0, 3).map((rb, i) => (
                          <Text key={i} style={[styles.followRecentItem, { color: colors.text }]} numberOfLines={1}>
                            {rb.title || rb}
                          </Text>
                        ))}
                      </View>
                    )}
                    <TouchableOpacity style={styles.followBtn} onPress={handleFollow}>
                      <UserPlus size={15} color="#000" />
                      <Text style={styles.followBtnText}>Follow {creatorName}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setFollowDismissed(true)} style={{ marginTop: 10 }}>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>Not now</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  /* Once followed (or already following) → show Ad (non-premium only) */
                  !isPremium && (
                    <View style={[styles.adPlaceholder, { borderColor: colors.border, backgroundColor: 'rgba(128,128,128,0.04)', marginTop: 28 }]}>
                      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '600' }}>ADVERTISEMENT</Text>
                      <Text style={{ color: colors.muted, fontSize: 10, marginTop: 4 }}>Ad will appear here</Text>
                    </View>
                  )
                )}
              </>
            )}
          </View>
        )}

        {/* ── End-of-chapter navigation zone ── */}
        {!lockedInfo && (
          <View style={[styles.endZone, { borderTopColor: colors.border }]}>
            <Text style={[styles.endChapterLabel, { color: colors.muted }]}>
              {unitCap} {currentCh} of {totalChapters || '?'}
            </Text>

            {canNext ? (
              <>
                {/* Next Chapter Button — user must press to continue */}
                {loadingNext ? (
                  <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 20 }} />
                ) : (
                <TouchableOpacity 
                    style={[styles.nextChBtn, { backgroundColor: colors.accent }]}
                    onPress={() => {
                      mediumTap();
                      goToNextChapter();
                    }}
                  >
                    <Text style={styles.nextChBtnText}>{`Continue to ${unitCap} ${currentCh + 1}`}</Text>
                    <ChevronDown size={18} color="#000" />
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={styles.endStoryWrap}>
                <Text style={{ fontSize: 28, textAlign: 'center' }}>{'\u2728'}</Text>
                <Text style={[styles.endStoryText, { color: colors.text }]}>
                  {`You've reached the latest ${unitLabel}`}
                </Text>
                <Text style={[styles.endStoryDesc, { color: colors.muted }]}>
                  {`Follow the creator to be notified when new ${unitLabel}s are published`}
                </Text>

                {/* Push 10 — Next book in series */}
                {nextInSeries ? (
                  <TouchableOpacity
                    style={[styles.nextBookCard, { backgroundColor: colors.panel, borderColor: colors.border }]}
                    activeOpacity={0.85}
                    onPress={() => {
                      mediumTap();
                      navigation.replace('BookDetail', { bookId: nextInSeries.id });
                    }}
                  >
                    <View style={[styles.nextBookBadge, { borderColor: colors.accent }]}>
                      <Text style={[styles.nextBookBadgeText, { color: colors.accent }]}>NEXT IN SERIES</Text>
                    </View>
                    {nextInSeries._series?.title ? (
                      <Text style={[styles.nextSeriesTitle, { color: colors.muted }]} numberOfLines={1}>
                        {nextInSeries._series.title}
                      </Text>
                    ) : null}
                    <Text style={[styles.nextBookTitle, { color: colors.text }]} numberOfLines={2}>
                      {nextInSeries.title}
                    </Text>
                    {nextInSeries.description ? (
                      <Text style={[styles.nextBookDesc, { color: colors.muted }]} numberOfLines={3}>
                        {nextInSeries.description}
                      </Text>
                    ) : null}
                    <View style={[styles.nextBookCta, { backgroundColor: colors.accent }]}>
                      <Text style={styles.nextBookCtaText}>Continue the journey →</Text>
                    </View>
                  </TouchableOpacity>
                ) : null}
            </View>
            )}

          </View>
        )}
      </ScrollView>

      {/* ── TOC Modal ── */}
      <Modal visible={showToc} transparent animationType="fade" onRequestClose={() => setShowToc(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.tocPanel, { backgroundColor: colors.panel, paddingTop: insets.top }]}>
            <View style={[styles.tocHead, { borderBottomColor: colors.border }]}>
              <Text style={[styles.tocTitle, { color: colors.text }]}>{`${unitCap}s`}</Text>
              <TouchableOpacity onPress={() => setShowToc(false)}>
                <X size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {(chapterList || []).length > 0 ? (chapterList || []).map((ch, idx) => {
                const num = ch.number || ch.chapter_number || idx + 1;
                const title = ch.title || ch.chapter_title || `${unitCap} ${num}`;
                const active = num === currentCh;
                return (
                  <TouchableOpacity
                    key={`toc-${num}`}
                    style={[styles.tocItem, { borderBottomColor: colors.border }, active && { backgroundColor: colors.bg }]}
                    onPress={() => { selectionTick(); setCurrentCh(num); setShowToc(false); }}
                  >
                    <Text style={[styles.tocNum, { color: active ? colors.accent : colors.muted }]}>{num}</Text>
                    <Text numberOfLines={1} style={[styles.tocItemText, { color: active ? colors.text : colors.muted, fontWeight: active ? '600' : '400' }]}>
                      {title}
                    </Text>
                    {ch.is_locked && ch.chapter_price ? <Lock size={14} color={colors.accent} /> : null}
              </TouchableOpacity>
                );
              }) : (
                Array.from({ length: totalChapters || 0 }, (_, i) => i + 1).map((num) => (
                  <TouchableOpacity
                    key={`toc-${num}`}
                    style={[styles.tocItem, { borderBottomColor: colors.border }, num === currentCh && { backgroundColor: colors.bg }]}
                    onPress={() => { selectionTick(); setCurrentCh(num); setShowToc(false); }}
                  >
                    <Text style={[styles.tocNum, { color: num === currentCh ? colors.accent : colors.muted }]}>{num}</Text>
                    <Text style={[styles.tocItemText, { color: num === currentCh ? colors.text : colors.muted }]}>
                      {`${unitCap} ${num}`}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            </View>
          </View>
      </Modal>

      {/* ── Comment Thread Modal ── */}
      <Modal visible={showThread} transparent animationType="slide" onRequestClose={() => setShowThread(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={[styles.threadOverlay, { backgroundColor: colors.bg }]}>
            <View style={[styles.threadHeader, { borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
              <Text style={[styles.threadTitle, { color: colors.text }]}>
                Paragraph {threadParaIdx !== null ? threadParaIdx + 1 : ''} Discussion
              </Text>
              <TouchableOpacity onPress={() => setShowThread(false)}>
                <X size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            {threadParaIdx !== null && paragraphs[threadParaIdx] && (
              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => setQuoteExpanded((v) => !v)}
                style={[styles.threadQuote, { borderLeftColor: colors.accent, backgroundColor: 'rgba(212,168,67,0.04)' }]}
              >
                <View style={styles.threadQuoteRow}>
                  {quoteExpanded
                    ? <ChevronUp size={14} color={colors.accent} />
                    : <ChevronDown size={14} color={colors.accent} />
                  }
                </View>
                <Text
                  style={[styles.threadQuoteText, { color: colors.muted }]}
                  numberOfLines={quoteExpanded ? undefined : 3}
                >
                  "{paragraphs[threadParaIdx]}"
                </Text>
                <View style={styles.threadQuoteRow}>
                  {quoteExpanded
                    ? <ChevronUp size={14} color={colors.accent} />
                    : <ChevronDown size={14} color={colors.accent} />
                  }
                </View>
              </TouchableOpacity>
            )}

            {threadLoading ? (
              <View style={{ padding: 20 }}><SkeletonLoader.ListItem count={3} /></View>
            ) : (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }} keyboardShouldPersistTaps="handled">
                {(threadComments || []).length === 0 ? (
                  <View style={styles.threadEmpty}>
                    <MessageSquare size={32} color={colors.muted} />
                    <Text style={[styles.threadEmptyText, { color: colors.muted }]}>No comments yet. Be the first!</Text>
                  </View>
                ) : threadComments.map((c) => {
                  const canDelete = !!c.can_delete;
                  const replies = c.replies || [];
                  const maxVisible = visibleReplies[c.id] || 3;
                  const shownReplies = replies.slice(0, maxVisible);
                  const hiddenCount = replies.length - maxVisible;
                  return (
                    <View key={c.id} style={[styles.commentItem, { borderBottomColor: colors.border }, c.premium_plan && { borderLeftWidth: 2, borderLeftColor: c.premium_plan === 'plus' ? '#60a5fa' : c.premium_plan === 'unlimited' ? '#d4a843' : '#d4a843', paddingLeft: 8, backgroundColor: 'rgba(212,168,67,0.03)' }]}>
                      <View style={styles.commentHeader}>
                        <View style={[styles.commentAvatar, { backgroundColor: c.premium_plan ? 'rgba(212,168,67,0.2)' : 'rgba(212,168,67,0.12)' }]}>
                          <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 12 }}>{c.user_initial}</Text>
                        </View>
                        <Text style={[styles.commentName, { color: colors.text }]}>{c.user_name}</Text>
                        {c.premium_plan && <PremiumBadge plan={c.premium_plan} size={11} />}
                        <Text style={[styles.commentTime, { color: colors.muted }]}>{c.created_at}</Text>
              <TouchableOpacity 
                          style={styles.moreBtn}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          onPress={() => { mediumTap(); setContextMenu({ visible: true, comment: c, canDelete, topLevelId: null }); }}
              >
                          <MoreVertical size={16} color={colors.muted} />
              </TouchableOpacity>
            </View>
                      <Text style={[styles.commentText, { color: colors.text }]}>{c.text}</Text>
                      {c.translated && (
                        <View style={[styles.translatedWrap, { borderColor: colors.border }]}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: '700' }}>TRANSLATED</Text>
                            <TouchableOpacity
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              onPress={() => setThreadComments((prev) => prev.map((tc) => tc.id === c.id ? { ...tc, translated: null } : tc))}
                            >
                              <X size={14} color={colors.muted} />
                            </TouchableOpacity>
          </View>
                          <Text style={[styles.commentText, { color: colors.text, marginLeft: 0 }]}>{c.translated}</Text>
        </View>
                      )}
                      <View style={styles.commentActions}>
                        <TouchableOpacity onPress={() => handleLikeComment(c.id)} style={styles.commentActionBtn}>
                          <Heart size={13} color={c.liked ? '#f472b6' : colors.muted} fill={c.liked ? '#f472b6' : 'transparent'} />
                          <Text style={{ color: c.liked ? '#f472b6' : colors.muted, fontSize: 11, marginLeft: 3 }}>{c.like_count || 0}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setReplyingTo(c); setCommentText(''); }} style={styles.commentActionBtn}>
                          <CornerDownRight size={12} color={colors.accent} />
                          <Text style={{ color: colors.accent, fontSize: 11, marginLeft: 3 }}>Reply</Text>
                        </TouchableOpacity>
                      </View>
                      {/* Replies */}
                      {shownReplies.map((r) => {
                        const rCanDelete = !!r.can_delete;
                        return (
                          <View key={r.id} style={[styles.replyItem, { borderLeftColor: colors.accent }]}>
                            <View style={styles.commentHeader}>
                              <View style={[styles.commentAvatar, { backgroundColor: 'rgba(212,168,67,0.08)', width: 22, height: 22 }]}>
                                <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 10 }}>{r.user_initial}</Text>
                              </View>
                              <Text style={[styles.commentName, { color: colors.text, fontSize: 12 }]}>{r.user_name}</Text>
                              {r.premium_plan && <PremiumBadge plan={r.premium_plan} size={10} />}
                              <Text style={[styles.commentTime, { color: colors.muted }]}>{r.created_at}</Text>
                              <TouchableOpacity
                                style={styles.moreBtn}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                onPress={() => { mediumTap(); setContextMenu({ visible: true, comment: r, canDelete: rCanDelete, topLevelId: c.id }); }}
                              >
                                <MoreVertical size={14} color={colors.muted} />
                              </TouchableOpacity>
                            </View>
                            <Text style={[styles.commentText, { color: colors.text, fontSize: 13 }]}>{r.text}</Text>
                            {r.translated && (
                              <View style={[styles.translatedWrap, { borderColor: colors.border, marginLeft: 0 }]}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                  <Text style={{ color: colors.muted, fontSize: 10, fontWeight: '700' }}>TRANSLATED</Text>
                                  <TouchableOpacity
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    onPress={() => setThreadComments((prev) => prev.map((tc) => tc.id === c.id ? { ...tc, replies: tc.replies.map((rr) => rr.id === r.id ? { ...rr, translated: null } : rr) } : tc))}
                                  >
                                    <X size={12} color={colors.muted} />
                                  </TouchableOpacity>
                                </View>
                                <Text style={{ color: colors.text, fontSize: 13, lineHeight: 18 }}>{r.translated}</Text>
                              </View>
                            )}
                            <View style={[styles.commentActions, { marginLeft: 30 }]}>
                              <TouchableOpacity onPress={() => handleLikeComment(r.id)} style={styles.commentActionBtn}>
                                <Heart size={11} color={r.liked ? '#f472b6' : colors.muted} fill={r.liked ? '#f472b6' : 'transparent'} />
                                <Text style={{ color: r.liked ? '#f472b6' : colors.muted, fontSize: 10, marginLeft: 3 }}>{r.like_count || 0}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => { setReplyingTo({ ...r, _topLevelId: c.id }); setCommentText(''); }} style={styles.commentActionBtn}>
                                <CornerDownRight size={11} color={colors.accent} />
                                <Text style={{ color: colors.accent, fontSize: 10, marginLeft: 3 }}>Reply</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                      {hiddenCount > 0 && (
                        <TouchableOpacity
                          onPress={() => setVisibleReplies((prev) => ({ ...prev, [c.id]: maxVisible + 3 }))}
                          style={styles.loadMoreBtn}
                        >
                          <CornerDownRight size={12} color={colors.accent} />
                          <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600', marginLeft: 4 }}>
                            Show {Math.min(hiddenCount, 3)} more {hiddenCount === 1 ? 'reply' : 'replies'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}

            {/* Reply indicator */}
            {replyingTo && (
              <View style={[styles.replyIndicator, { backgroundColor: colors.panel, borderTopColor: colors.border }]}>
                <CornerDownRight size={12} color={colors.accent} />
                <Text style={{ color: colors.muted, fontSize: 12, flex: 1, marginLeft: 6 }} numberOfLines={1}>
                  Replying to <Text style={{ color: colors.text, fontWeight: '600' }}>{replyingTo.user_name}</Text>
                </Text>
                <TouchableOpacity onPress={() => setReplyingTo(null)}>
                  <X size={16} color={colors.muted} />
              </TouchableOpacity>
            </View>
            )}

            <View style={[styles.threadInput, { borderTopColor: replyingTo ? 'transparent' : colors.border, paddingBottom: insets.bottom + 8 }]}>
              <TextInput
                style={[styles.threadTextInput, { color: colors.text, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.04)' }]}
                placeholder={replyingTo ? `Reply to ${replyingTo.user_name}...` : 'Write a comment...'}
                placeholderTextColor={colors.muted}
                value={commentText}
                onChangeText={setCommentText}
                maxLength={1000}
                multiline
              />
                <TouchableOpacity 
                style={[styles.threadSendBtn, { backgroundColor: commentText.trim() ? colors.accent : colors.border }]}
                onPress={sendComment}
                disabled={sendingComment || !commentText.trim()}
              >
                {sendingComment ? (
                  <ActivityIndicator size={14} color="#000" />
                ) : (
                  <Send size={16} color={commentText.trim() ? '#000' : colors.muted} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Context Menu (inside thread modal) ── */}
          {contextMenu.visible && (
            <TouchableOpacity
              activeOpacity={1}
              style={styles.ctxOverlay}
              onPress={() => setContextMenu({ visible: false, comment: null, canDelete: false, topLevelId: null })}
            >
              <View onStartShouldSetResponder={() => true} style={[styles.ctxSheet, { backgroundColor: colors.panel, borderColor: colors.border }]}>
                {contextMenu.comment && (
                  <Text style={[styles.ctxPreview, { color: colors.muted }]} numberOfLines={2}>
                    "{contextMenu.comment.text}"
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.ctxOption}
                  onPress={() => {
                    setContextMenu({ visible: false, comment: null, canDelete: false, topLevelId: null });
                    const c = contextMenu.comment;
                    const tlId = contextMenu.topLevelId;
                    setReplyingTo(tlId ? { ...c, _topLevelId: tlId } : c);
                    setCommentText('');
                  }}
                >
                  <CornerDownRight size={18} color={colors.accent} />
                  <Text style={[styles.ctxOptionText, { color: colors.text }]}>Reply</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ctxOption}
                  onPress={() => {
                    setContextMenu({ visible: false, comment: null, canDelete: false, topLevelId: null });
                    handleCopyComment(contextMenu.comment?.text);
                  }}
                >
                  <Copy size={18} color={colors.muted} />
                  <Text style={[styles.ctxOptionText, { color: colors.text }]}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ctxOption}
                  onPress={() => handleTranslateComment(contextMenu.comment?.text, contextMenu.comment?.id)}
                >
                  <Languages size={18} color={colors.muted} />
                  <Text style={[styles.ctxOptionText, { color: colors.text }]}>Translate</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ctxOption}
                  onPress={() => handleReport(contextMenu.comment?.id)}
                >
                  <Flag size={18} color="#f59e0b" />
                  <Text style={[styles.ctxOptionText, { color: colors.text }]}>Report</Text>
                </TouchableOpacity>
                {contextMenu.canDelete && (
                  <TouchableOpacity
                    style={[styles.ctxOption, { borderTopWidth: 1, borderTopColor: colors.border }]}
                    onPress={() => handleDeleteComment(contextMenu.comment?.id, contextMenu.topLevelId)}
                  >
                    <Trash2 size={18} color="#ef4444" />
                    <Text style={[styles.ctxOptionText, { color: '#ef4444' }]}>Delete</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.ctxCancel, { borderTopColor: colors.border }]}
                  onPress={() => setContextMenu({ visible: false, comment: null, canDelete: false, topLevelId: null })}
                >
                  <Text style={[styles.ctxCancelText, { color: colors.muted }]}>Cancel</Text>
                </TouchableOpacity>
          </View>
            </TouchableOpacity>
      )}

        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Top bar
  topbar: {
    position: 'absolute', left: 0, right: 0, zIndex: 100,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, paddingHorizontal: SPACING.md, paddingBottom: 8,
  },
  topBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 44 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  topRight: { flexDirection: 'row', gap: 10, width: 68, justifyContent: 'flex-end' },
  iconOnly: { padding: 4 },

  // Fixed watermark (does NOT scroll with content)
  watermarkFixed: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 2, overflow: 'hidden', pointerEvents: 'none',
  },
  watermarkText: {
    position: 'absolute', fontSize: 18, fontWeight: '800', letterSpacing: 6,
    transform: [{ rotate: '-30deg' }], opacity: 1,
  },

  // Scroll & content
  scroll: { flex: 1, zIndex: 3 },
  readWrap: { maxWidth: 700, alignSelf: 'center', width: '100%', paddingHorizontal: 24, paddingBottom: 96 },

  // Author's Note
  authorsNote: {
    borderLeftWidth: 3, marginBottom: 20,
    backgroundColor: 'rgba(212,168,67,0.04)', borderRadius: 0,
    borderTopRightRadius: 10, borderBottomRightRadius: 10, overflow: 'hidden',
  },
  authorsNoteHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 14,
  },
  authorsNoteLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  authorsNoteBody: { paddingHorizontal: 14, paddingBottom: 14 },
  authorsNoteText: { fontStyle: 'italic', lineHeight: 22, fontSize: 14 },

  // Chapter title
  chapterTitle: { textAlign: 'center', fontSize: 24, fontWeight: '700', marginBottom: 24, paddingBottom: 18, borderBottomWidth: 1 },

  // Body text
  body: {},
  dropCap: { fontWeight: '700' },
  paraBlock: { marginBottom: 6 },
  paraControls: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2, marginBottom: 2 },
  paraCtrlBtn: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  ctrlCount: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: '#d4a843', borderRadius: 8,
    minWidth: 14, height: 14, alignItems: 'center', justifyContent: 'center',
  },
  ctrlCountText: { fontSize: 8, fontWeight: '700', color: '#000' },
  emojiBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 10,
    backgroundColor: 'rgba(212,168,67,0.06)', borderWidth: 1, borderColor: 'rgba(212,168,67,0.12)',
  },
  emojiBadgeActive: { backgroundColor: 'rgba(212,168,67,0.15)', borderColor: 'rgba(212,168,67,0.35)' },
  emojiBadgeIcon: { fontSize: 11 },
  emojiBadgeCount: { fontSize: 9, fontWeight: '600' },
  emojiPicker: {
    flexDirection: 'row', gap: 2, paddingHorizontal: 8, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, marginBottom: 8, alignSelf: 'flex-start',
  },
  emojiOpt: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  // Resume marker (gold line)
  resumeMarker: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12,
  },
  resumeLine: { flex: 1, height: 1.5, backgroundColor: '#d4a843' },
  resumeLabel: { fontSize: 10, fontWeight: '700', color: '#d4a843', letterSpacing: 0.5, textTransform: 'uppercase' },

  // Settings panel
  settingsPanel: {
    position: 'absolute', right: 12, zIndex: 150,
    width: 240, borderRadius: 14, borderWidth: 1, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  settingLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  themeRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  themeBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  themeDot: { width: 8, height: 8, borderRadius: 4 },
  optionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  optBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, borderRadius: 8, borderWidth: 1,
  },
  optBtnWide: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 7, borderRadius: 8, borderWidth: 1,
  },

  // Tip panel (redesigned)
  tipPanel: {
    marginTop: 32, padding: 20, borderRadius: 16, borderWidth: 1,
    alignItems: 'center',
  },
  tipIconWrap: { marginBottom: 10 },
  tipTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  tipLabel: { fontSize: 12, marginBottom: 14, textAlign: 'center' },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 14 },
  tipAmtBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
  },
  tipBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#ec4899', paddingHorizontal: 22, paddingVertical: 11, borderRadius: 12,
  },
  tipBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  tipCreatorName: { fontSize: 11, marginTop: 8, textAlign: 'center' },

  // Follow panel (redesigned - beautiful)
  followPanel: {
    marginTop: 28, padding: 28, borderRadius: 18, borderWidth: 1,
    alignItems: 'center', overflow: 'hidden',
  },
  followGlow: {
    position: 'absolute', top: -40, width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(212,168,67,0.08)',
  },
  followAvatarLg: {
    width: 68, height: 68, borderRadius: 34, borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    backgroundColor: 'rgba(212,168,67,0.08)',
  },
  followName: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  followStats: { fontSize: 12, marginBottom: 6 },
  followDesc: { fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 14 },
  followRecentRow: { width: '100%', marginBottom: 14 },
  followRecentLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  followRecentItem: { fontSize: 13, marginBottom: 3, paddingLeft: 8 },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#d4a843', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12,
  },
  followBtnText: { color: '#000', fontSize: 14, fontWeight: '700' },

  // End-of-chapter zone
  endZone: { marginTop: 40, paddingTop: 28, borderTopWidth: 1, alignItems: 'center' },
  endChapterLabel: { fontSize: 13, fontWeight: '600', marginBottom: 16 },
  adPlaceholder: {
    width: '100%', height: 100, borderRadius: 12, borderWidth: 1.5,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  nextChBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14,
  },
  nextChBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
  endStoryWrap: { alignItems: 'center', paddingVertical: 20 },
  endStoryText: { fontSize: 17, fontWeight: '700', marginTop: 8, marginBottom: 6 },
  endStoryDesc: { fontSize: 13, textAlign: 'center', lineHeight: 19 },

  // Next book in series CTA (Push 10)
  nextBookCard: {
    marginTop: 28, padding: 20, borderRadius: 16, borderWidth: 1,
    width: '100%', alignItems: 'center',
  },
  nextBookBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    borderWidth: 1, marginBottom: 10,
  },
  nextBookBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  nextSeriesTitle: { fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  nextBookTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  nextBookDesc: { fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 14 },
  nextBookCta: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
  },
  nextBookCtaText: { color: '#000', fontSize: 13, fontWeight: '700' },
  prevChBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 16,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
  },

  // TOC
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  tocPanel: { width: '82%', height: '100%' },
  tocHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  tocTitle: { fontSize: 18, fontWeight: '700' },
  tocItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  tocNum: { width: 28, fontWeight: '700', fontSize: 13 },
  tocItemText: { flex: 1, fontSize: 14 },

  // Lock
  lockOverlay: {
    alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24,
    borderRadius: 16, borderWidth: 1, marginVertical: 24,
  },
  lockTitle: { fontSize: 22, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  lockDesc: { fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  unlockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10,
  },
  unlockBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  walletLink: { marginTop: 14, paddingVertical: 6 },
  walletLinkText: { fontSize: 13, fontWeight: '600' },
  rewardedBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 12, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1.5, backgroundColor: 'transparent',
  },
  rewardedBtnText: { fontSize: 13, fontWeight: '700' },

  // Thread
  threadOverlay: { flex: 1 },
  threadHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  threadTitle: { fontSize: 16, fontWeight: '700' },
  threadQuote: { borderLeftWidth: 3, padding: 12, margin: 12, borderRadius: 6 },
  threadQuoteRow: { alignItems: 'center', paddingVertical: 2 },
  threadQuoteText: { fontSize: 13, fontStyle: 'italic', lineHeight: 18 },
  threadEmpty: { alignItems: 'center', paddingTop: 40 },
  threadEmptyText: { marginTop: 12, fontSize: 14 },
  commentItem: { paddingVertical: 10, borderBottomWidth: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  commentAvatar: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  commentName: { fontSize: 13, fontWeight: '600' },
  commentTime: { fontSize: 11 },
  moreBtn: { marginLeft: 'auto', padding: 2 },
  commentText: { fontSize: 14, lineHeight: 20, marginLeft: 34 },
  commentActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginLeft: 34, marginTop: 6 },
  translatedWrap: { marginLeft: 34, marginTop: 6, padding: 8, borderWidth: 1, borderRadius: 8, backgroundColor: 'rgba(212,168,67,0.04)' },
  commentActionBtn: { flexDirection: 'row', alignItems: 'center' },
  replyItem: { marginLeft: 34, paddingLeft: 10, borderLeftWidth: 2, marginTop: 8 },
  loadMoreBtn: { flexDirection: 'row', alignItems: 'center', marginLeft: 34, marginTop: 8, paddingVertical: 6 },
  replyIndicator: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1 },
  ctxOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 999 },
  ctxSheet: {
    borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, borderBottomWidth: 0,
    paddingTop: 8, paddingBottom: 20,
  },
  ctxPreview: { fontSize: 12, fontStyle: 'italic', paddingHorizontal: 20, paddingVertical: 10, lineHeight: 17 },
  ctxOption: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  ctxOptionText: { fontSize: 15, fontWeight: '500' },
  ctxCancel: { alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, marginTop: 4 },
  ctxCancelText: { fontSize: 15, fontWeight: '600' },
  threadInput: {
    flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, alignItems: 'flex-end',
  },
  threadTextInput: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderRadius: 20, fontSize: 14, maxHeight: 100,
  },
  threadSendBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
});

export default ReaderScreen;
