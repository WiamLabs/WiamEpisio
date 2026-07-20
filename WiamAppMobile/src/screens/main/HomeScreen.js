/**
 * HomeScreen — Home V2 sections renderer.
 *
 * Iterates the ``sections[]`` array returned by ``/api/v1/home`` and
 * dispatches each section to the right layout component:
 *
 *   layout: 'continue'  → ContinueRail
 *   layout: 'spotlight' → SpotlightRail
 *   layout: 'pulse'     → MosaicRail (1 BIG + 2 small stacked, repeating)
 *   layout: 'mosaic'    → MosaicRail
 *   layout: 'stream'    → StreamRail
 *
 * The backend (`webapp/services/home_sections_v2.py`) handles eligibility
 * (drops empty sections), pinning (Continue Reading, For You, Spotlight,
 * Top Rated, From Creators You Follow always lead), and daily rotation
 * (4-6 supporting sections picked deterministically per user per day from
 * a 17-section pool). The client just renders what it gets.
 *
 * Backwards compat: if the response is missing ``sections[]`` (older
 * backend or temporary failure), we fall back to the legacy keys
 * (``spotlight``, ``pulse``, ``stream``, ``latest``, ``top_rated``,
 * ``premium_picks``, ``continue_reading``) so a stale Render deploy or a
 * bad request never gives the user an empty home.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Sparkles, Trophy, Clock3, Crown, Star, Users, Zap, Gem,
  Coffee, BookOpen, CheckCircle, Heart, RefreshCw, Award,
  Bookmark, Flame,
} from 'lucide-react-native';

import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import booksApi from '../../api/books';
import trackingApi from '../../api/tracking';
import authApi from '../../api/auth';
import useAuthStore from '../../store/useAuthStore';
import { cachedFetch } from '../../utils/apiCache';

import BrandedFooter from '../../components/BrandedFooter';
import AdBanner from '../../components/ads/AdBanner';
import SkeletonLoader from '../../components/common/SkeletonLoader';

import SpotlightRail from '../../components/home/SpotlightRail';
import StreamRail from '../../components/home/StreamRail';
import MosaicRail from '../../components/home/MosaicRail';
import ContinueRail from '../../components/home/ContinueRail';

// Lucide icon name → component lookup. Backend sends icon names as
// strings in each section descriptor; we resolve to a real component
// here. Anything not in the map falls through to <Sparkles> so a typo
// or backend addition never crashes the renderer.
const ICON_BY_NAME = {
  Clock3, Sparkles, Star, Trophy, Users, Zap, Crown, Gem,
  Coffee, BookOpen, CheckCircle, Heart, RefreshCw, Award,
  Bookmark, Flame,
};

const ICON_COLORS = {
  Clock3: COLORS.secondary,
  Sparkles: '#facc15',
  Star: '#facc15',
  Trophy: COLORS.secondary,
  Users: '#a5b4fc',
  Zap: '#f97316',
  Crown: '#c084fc',
  Gem: '#22d3ee',
  Coffee: '#fb923c',
  BookOpen: '#60a5fa',
  CheckCircle: '#22c55e',
  Heart: '#f472b6',
  RefreshCw: '#34d399',
  Award: '#fbbf24',
  Bookmark: '#f59e0b',
  Flame: '#f97316',
};

const renderIcon = (name) => {
  const Icon = ICON_BY_NAME[name] || Sparkles;
  const color = ICON_COLORS[name] || COLORS.secondary;
  return <Icon size={16} color={color} />;
};

const HomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const hour = new Date().getHours();

  const [sections, setSections] = useState([]);
  const [genres, setGenres] = useState([]);
  const [isPremium, setIsPremium] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      authApi
        .me()
        .then((meRes) => {
          if (cancelled || !meRes) return;
          const freshUser = meRes.user || meRes;
          const token = useAuthStore.getState().token;
          useAuthStore.getState().setAuth(freshUser, token);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
        trackingApi.flushImpressions();
      };
    }, [])
  );

  // Build a sections[] array out of the legacy keys when the backend
  // didn't return a fresh sections[] field. Order matches the pre-V2
  // hard-coded layout so an old build / partial deploy still feels right.
  const sectionsFromLegacy = (res) => {
    const out = [];
    if ((res.continue_reading || []).length) {
      out.push({
        key: 'continue_reading', title: 'Pick up where you left off',
        subtitle: null, icon: 'Clock3', layout: 'continue',
        books: res.continue_reading,
      });
    }
    if ((res.spotlight || res.featured || []).length) {
      out.push({
        key: 'spotlight', title: 'Spotlight',
        subtitle: 'Stories everyone is talking about',
        icon: 'Star', layout: 'spotlight',
        books: res.spotlight || res.featured,
      });
    }
    if ((res.pulse || res.trending || []).length) {
      out.push({
        key: 'pulse', title: 'Pulse right now',
        subtitle: 'Stories with momentum',
        icon: 'Zap', layout: 'pulse',
        books: res.pulse || res.trending,
      });
    }
    if ((res.latest || []).length) {
      out.push({
        key: 'latest', title: 'Fresh off the press',
        subtitle: 'Just published', icon: 'Sparkles', layout: 'stream',
        books: res.latest,
      });
    }
    if ((res.stream || res.popular || []).length) {
      out.push({
        key: 'stream', title: 'Keep the stream going',
        subtitle: 'Fresh recommendations',
        icon: 'Sparkles', layout: 'stream',
        books: res.stream || res.popular,
      });
    }
    if ((res.top_rated || []).length) {
      out.push({
        key: 'top_rated', title: 'Top rated',
        subtitle: 'Reader favourites', icon: 'Trophy', layout: 'stream',
        books: res.top_rated,
      });
    }
    if ((res.premium_picks || []).length) {
      out.push({
        key: 'premium_picks', title: 'Premium picks',
        subtitle: 'Stories with exclusive chapters',
        icon: 'Crown', layout: 'stream',
        books: res.premium_picks,
      });
    }
    return out;
  };

  const networkFetch = async () => {
    const res = await booksApi.getHomeFeed();
    const apiSections = Array.isArray(res.sections) && res.sections.length
      ? res.sections
      : sectionsFromLegacy(res);
    return {
      sections: apiSections,
      genres: res.genres || [],
      isPremium: res.is_premium || false,
    };
  };

  const applyData = (d) => {
    setSections(d.sections || []);
    setGenres(d.genres || []);
    if (d.isPremium !== undefined) setIsPremium(d.isPremium);
  };

  const fetchData = useCallback(async (forceRefresh = false) => {
    setFetchError(null);
    if (!forceRefresh) setLoading(true);
    /** Per-user cache — shared key showed wrong rails / missing continue-reading after login. */
    const homeCacheKey =
      user?.id != null ? `home_screen_v3:u${String(user.id)}` : 'home_screen_v3_guest';
    try {
      const data = await cachedFetch(
        homeCacheKey,
        networkFetch,
        (freshData) => applyData(freshData),
        forceRefresh ? 0 : 10 * 60 * 1000,
      );
      applyData(data);
    } catch (error) {
      const message = typeof error === 'string' ? error : error?.message || 'Failed to load books';
      setFetchError(message);
      if (__DEV__) {
        console.warn('HomeScreen fetch:', message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true);
  }, [fetchData]);

  const greeting = useMemo(() => {
    const name = user?.display_name || 'Reader';
    if (hour >= 5 && hour < 12) return { title: `Good morning, ${name}`, sub: 'Fresh stories are waiting for you.' };
    if (hour >= 12 && hour < 17) return { title: `Good afternoon, ${name}`, sub: 'Take a break with a story.' };
    if (hour >= 17 && hour < 21) return { title: `Good evening, ${name}`, sub: "Unwind. Let's read." };
    return { title: `Welcome back, ${name}`, sub: 'A quiet night. A good book.' };
  }, [hour, user?.display_name]);

  const handlePressBook = useCallback(
    (book) => {
      if (!book || !book.id) return;
      navigation.navigate('BookDetail', { bookId: book.id });
    },
    [navigation]
  );

  const renderSection = (section) => {
    const books = section.books || [];
    if (!books.length) return null;
    const icon = renderIcon(section.icon);

    switch (section.layout) {
      case 'continue':
        return (
          <ContinueRail
            key={section.key}
            title={section.title}
            books={books}
            navigation={navigation}
          />
        );
      case 'spotlight':
        return (
          <SpotlightRail
            key={section.key}
            books={books}
            onPressBook={handlePressBook}
            sectionKey={section.key}
          />
        );
      case 'pulse':
      case 'mosaic':
        return (
          <MosaicRail
            key={section.key}
            title={section.title}
            subtitle={section.subtitle}
            icon={icon}
            books={books}
            onPressBook={handlePressBook}
            sectionKey={section.key}
          />
        );
      case 'stream':
      default:
        return (
          <StreamRail
            key={section.key}
            title={section.title}
            subtitle={section.subtitle}
            icon={icon}
            books={books}
            onPressBook={handlePressBook}
            sectionKey={section.key}
            size={section.key === 'top_rated' ? 'md' : 'sm'}
          />
        );
    }
  };

  if (loading) {
    return <SkeletonLoader.Home />;
  }

  return (
    <View style={styles.page}>
      <View style={[styles.topNav, { paddingTop: insets.top + SPACING.sm }]}>
        <Image source={require('../../assets/images/WiamLogo.png')} style={styles.logoIcon} />
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={styles.premiumBadge}
          onPress={() => navigation.navigate('PremiumScreen')}
        >
          <Crown size={13} color="#000" />
          <Text style={styles.premiumBadgeText}>Try WiamPremium</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.secondary}
            colors={[COLORS.secondary]}
            progressBackgroundColor={COLORS.surface}
          />
        }
      >
        <View style={styles.homeGreeting}>
          <Text style={styles.greetingTitle}>{greeting.title}</Text>
          <Text style={styles.greetingSub}>{greeting.sub}</Text>
        </View>

        {fetchError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Could not load books</Text>
            <Text style={styles.errorDetail} selectable>
              {fetchError}
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => fetchData(true)}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {sections.map(renderSection)}

        <AdBanner placement="home" navigation={navigation} />

        <View style={styles.section}>
          <View style={styles.secHead}>
            <View style={styles.secTitleWrap}>
              <Text style={styles.sectionTitle}>Explore genres</Text>
            </View>
          </View>
          <View style={styles.genreWrap}>
            {(genres || []).slice(0, 24).map((g) => (
              <TouchableOpacity
                key={`genre-${g.id || g.name}`}
                style={styles.genrePill}
                onPress={() => navigation.navigate('Browse', { genre: g.name })}
              >
                <Text style={styles.genrePillText}>{g.name}</Text>
              </TouchableOpacity>
            ))}
            {!(genres || []).length ? (
              <Text style={styles.emptyRow}>No genres to show yet.</Text>
            ) : null}
          </View>
        </View>

        {!sections.length && !fetchError ? (
          <View style={styles.section}>
            <Text style={styles.emptyRow}>Stories are on their way…</Text>
          </View>
        ) : null}

        <View style={styles.footerPush}>
          <BrandedFooter compact />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  homeGreeting: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  greetingTitle: {
    fontSize: 26,
    fontFamily: FONTS.display,
    color: COLORS.white,
  },
  greetingSub: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  errorBanner: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: 'rgba(207, 102, 121, 0.15)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  errorTitle: {
    color: COLORS.error,
    fontWeight: '700',
    fontSize: 16,
    marginBottom: SPACING.xs,
  },
  errorDetail: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: SPACING.sm,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.secondary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  retryButtonText: {
    color: '#000',
    fontWeight: '700',
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  logoIcon: {
    width: 36,
    height: 36,
    resizeMode: 'contain',
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  premiumBadgeText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: SPACING.xl * 2,
  },
  section: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  secHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  secTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontFamily: FONTS.display,
  },
  genreWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  genrePill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  genrePillText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyRow: {
    color: COLORS.textMuted,
    fontSize: 12,
    paddingVertical: SPACING.sm,
  },
  footerPush: {
    marginTop: SPACING.xl,
  },
});

export default HomeScreen;
