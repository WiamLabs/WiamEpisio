/**
 * Layout: WiamEpisio-My-List.html + Reminder-Empty.html
 * Tabs: Following | History | Reminder Set — always keep HTML chrome even when lists are empty.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  RefreshControl, Dimensions, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { CheckSquare, Bell, Flame, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../constants/theme';
import episodesApi from '../../api/episodes';
import watchApi from '../../api/watch';
import studioEpisioApi from '../../api/studioEpisio';
import authApi from '../../api/auth';
import creatorApi from '../../api/creator';
import useAuthStore from '../../store/useAuthStore';
import resolveUrl from '../../utils/resolveUrl';

const TABS = ['Following', 'History', 'Reminder Set'];
const COL_W = (Dimensions.get('window').width - 20 * 2 - 10 * 2) / 3;

const RANK_COLORS = { 0: '#F5A623', 1: '#22C55E', 2: '#3B82F6' };

function HistRow({ item, onPress, showHot }) {
  const uri = resolveUrl(item?.poster_url || item?.cover_url);
  const total = item?.total_episodes;
  const ep = item?.episode_number;
  return (
    <TouchableOpacity style={styles.histRow} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.histPoster}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={[COLORS.navySoft, '#0d0d24']}
            style={StyleSheet.absoluteFill}
          />
        )}
        {showHot ? <Text style={styles.histBadge}>HOT</Text> : null}
        <View style={[styles.histProgress, { width: `${Math.min(90, item?.progress_pct || 12)}%` }]} />
      </View>
      <View style={styles.histInfo}>
        <Text style={styles.histTitle} numberOfLines={2}>
          {item?.series_title || item?.title || 'Series'}
        </Text>
        <Text style={styles.histTags} numberOfLines={2}>
          {item?.genre || item?.tags || 'Drama'}
        </Text>
        <Text style={styles.histEps}>
          {ep ? `EP.${ep}` : 'EP.—'}
          {total ? ` / EP.${total}` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function TrendCell({ item, rank, onPress }) {
  const uri = resolveUrl(item?.poster_url || item?.cover_url);
  return (
    <TouchableOpacity style={styles.trendItem} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.trendPoster}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={[COLORS.navyCard, '#0d0d24']}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View style={[styles.rankBadge, { backgroundColor: RANK_COLORS[rank] || '#3a3a5a' }]}>
          <Text style={styles.rankText}>{rank + 1}</Text>
        </View>
        {item?.views ? (
          <View style={styles.flameViews}>
            <Flame size={9} color="#F5A623" fill="#F5A623" />
            <Text style={styles.flameText}>{item.views}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.trendTitle} numberOfLines={2}>
        {item?.title || 'Coming soon'}
      </Text>
      <Text style={styles.trendTag} numberOfLines={1}>
        {item?.genre || 'Drama'}
      </Text>
    </TouchableOpacity>
  );
}

const MyListScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [tab, setTab] = useState('History');
  const [history, setHistory] = useState([]);
  const [following, setFollowing] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [trending, setTrending] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const load = useCallback(async () => {
    try {
      const [cw, home, rem, fol] = await Promise.all([
        isAuthenticated
          ? episodesApi.continueWatching().catch(() => ({ items: [] }))
          : Promise.resolve({ items: [] }),
        watchApi.home().catch(() => null),
        isAuthenticated
          ? studioEpisioApi.listReminders().catch(() => ({ reminders: [] }))
          : Promise.resolve({ reminders: [] }),
        isAuthenticated
          ? authApi.getFollowing().catch(() => ({ following: [] }))
          : Promise.resolve({ following: [] }),
      ]);
      setHistory(cw?.items || cw?.continue_watching || []);
      setReminders(rem?.reminders || rem?.items || []);
      setFollowing(fol?.following || []);
      setTrending((home?.popular || home?.top_searched || []).slice(0, 6));
    } finally {
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openSeries = (id) => {
    if (!id) return;
    navigation.navigate('SeriesDetail', { seriesId: id });
  };

  const openItem = (item) => {
    if (item?.episode_id) {
      navigation.navigate('Player', {
        episodeId: item.episode_id,
        seriesId: item.content_id || item.series_id,
      });
      return;
    }
    openSeries(item?.content_id || item?.series_id || item?.id);
  };

  const renderEmptyReminders = () => (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <Bell size={36} color={COLORS.textFaint} />
      </View>
      <Text style={styles.emptyText}>{"You haven't set any reminders yet"}</Text>
      <TouchableOpacity
        style={styles.watchBtn}
        onPress={() => navigation.navigate('Home')}
      >
        <Text style={styles.watchBtnText}>Watch popular dramas</Text>
      </TouchableOpacity>
    </View>
  );

  const renderHistoryBody = () => {
    const rows = history.length
      ? history
      : [null, null, null]; /* keep HTML hist-row slots when empty */
    return (
      <>
        {rows.map((item, i) => (
          <HistRow
            key={item?.episode_id || item?.id || `h-${i}`}
            item={item || {
              title: i === 0 ? 'Start watching' : 'Your history appears here',
              genre: 'Drama',
              progress_pct: 8,
            }}
            showHot={i === 0 && !!item}
            onPress={() => {
              if (item) openItem(item);
              else if (!isAuthenticated) navigation.navigate('Login');
              else navigation.navigate('Home');
            }}
          />
        ))}

        <Text style={styles.sectionLabel}>Most Trending</Text>
        <View style={styles.trendGrid}>
          {(trending.length ? trending : Array.from({ length: 6 })).slice(0, 6).map((s, idx) => (
            <TrendCell
              key={s?.id || `t-${idx}`}
              item={s || { title: 'Coming soon', genre: 'Drama' }}
              rank={idx}
              onPress={() => (s?.id ? openSeries(s.id) : navigation.navigate('Home'))}
            />
          ))}
        </View>
      </>
    );
  };

  const unfollowCreator = async (creatorId) => {
    try {
      await creatorApi.toggleFollow(creatorId);
      setFollowing((prev) => prev.filter((c) => c.id !== creatorId));
    } catch (e) {
      Alert.alert('Following', typeof e === 'string' ? e : (e?.message || 'Could not unfollow'));
    }
  };

  const removeReminder = async (seriesId) => {
    try {
      await studioEpisioApi.unremind(seriesId);
      setReminders((prev) => prev.filter((r) => String(r.series_id || r.content_id || r.id) !== String(seriesId)));
    } catch (e) {
      Alert.alert('My List', e?.message || 'Could not remove');
    }
  };

  const renderFollowingBody = () => {
    if (!following.length) {
      return (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <Bell size={36} color={COLORS.textFaint} />
          </View>
          <Text style={styles.emptyText}>
            {isAuthenticated ? "You're not following anyone yet" : 'Sign in to see who you follow'}
          </Text>
          <TouchableOpacity
            style={styles.watchBtn}
            onPress={() => navigation.navigate(isAuthenticated ? 'Home' : 'Login')}
          >
            <Text style={styles.watchBtnText}>
              {isAuthenticated ? 'Discover series' : 'Sign In'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }
    return following.map((c, i) => (
      <View key={c.id || `f-${i}`} style={styles.histRow}>
        <TouchableOpacity
          style={{ flexDirection: 'row', gap: 12, flex: 1 }}
          onPress={() => {
            if (editMode) return;
            navigation.navigate('Search');
          }}
          activeOpacity={0.8}
        >
          <View style={styles.histPoster}>
            {c.avatar_url ? (
              <Image source={{ uri: resolveUrl(c.avatar_url) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <LinearGradient colors={[COLORS.navySoft, '#0d0d24']} style={StyleSheet.absoluteFill} />
            )}
          </View>
          <View style={styles.histInfo}>
            <Text style={styles.histTitle} numberOfLines={2}>
              {c.display_name || c.username || 'Creator'}
            </Text>
            <Text style={styles.histTags} numberOfLines={2}>
              @{c.username || 'creator'}
              {c.follower_count != null ? ` · ${c.follower_count} followers` : ''}
            </Text>
          </View>
        </TouchableOpacity>
        {editMode ? (
          <TouchableOpacity style={styles.removeBtn} onPress={() => unfollowCreator(c.id)}>
            <X size={16} color="#EF4444" />
          </TouchableOpacity>
        ) : null}
      </View>
    ));
  };

  const renderRemindersBody = () => {
    if (!reminders.length) return renderEmptyReminders();
    return reminders.map((s, i) => {
      const sid = s.series_id || s.content_id || s.id;
      return (
        <View key={sid || `r-${i}`} style={styles.remRow}>
          <View style={{ flex: 1 }}>
            <HistRow
              item={{
                ...s,
                title: s.title || s.series_title,
              }}
              onPress={() => {
                if (editMode) return;
                openSeries(sid);
              }}
            />
          </View>
          {editMode ? (
            <TouchableOpacity style={styles.removeBtn} onPress={() => removeReminder(sid)}>
              <X size={16} color="#EF4444" />
            </TouchableOpacity>
          ) : null}
        </View>
      );
    });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* HTML: .topfixed */}
      <View style={styles.topFixed}>
        <View style={styles.tabs}>
          {TABS.map((t) => {
            const active = tab === t;
            return (
              <TouchableOpacity key={t} onPress={() => setTab(t)} style={styles.tabBtn}>
                <Text style={[styles.tab, active && styles.tabActive]}>{t}</Text>
                {active ? <View style={styles.tabUnderline} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity
          hitSlop={10}
          onPress={() => {
            if (!isAuthenticated) {
              navigation.navigate('Login');
              return;
            }
            setEditMode((v) => !v);
          }}
        >
          <CheckSquare size={18} color={editMode ? COLORS.gold : COLORS.textFaint} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={
          (tab === 'Reminder Set' && !reminders.length)
          || (tab === 'Following' && !following.length)
            ? styles.scrollFill
            : { paddingBottom: 28 }
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={COLORS.gold}
          />
        }
      >
        {tab === 'History' ? renderHistoryBody() : null}
        {tab === 'Following' ? renderFollowingBody() : null}
        {tab === 'Reminder Set' ? renderRemindersBody() : null}

        {tab === 'History' ? (
          <Text style={styles.footer}>© 2026 WiamEpisio · Powered by WiamLabs</Text>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  topFixed: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabs: { flexDirection: 'row', gap: 20 },
  tabBtn: { alignItems: 'center' },
  tab: {
    fontSize: 14,
    fontFamily: FONTS.semi,
    color: COLORS.textFaint,
    paddingBottom: 8,
  },
  tabActive: { color: '#fff' },
  tabUnderline: {
    height: 2,
    width: '100%',
    backgroundColor: COLORS.gold,
    borderRadius: 2,
  },
  scroll: { flex: 1, paddingHorizontal: 20 },
  scrollFill: { flexGrow: 1, paddingBottom: 28 },

  histRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.navyLine,
  },
  remRow: { flexDirection: 'row', alignItems: 'center' },
  removeBtn: {
    width: 36, height: 36, borderRadius: 18, marginLeft: 4,
    backgroundColor: 'rgba(239,68,68,0.12)', alignItems: 'center', justifyContent: 'center',
  },
  histPoster: {
    width: 76,
    height: 104,
    borderRadius: 11,
    backgroundColor: COLORS.navySoft,
    overflow: 'hidden',
  },
  histBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    fontSize: 8.5,
    fontFamily: FONTS.bold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    color: '#fff',
    overflow: 'hidden',
  },
  histProgress: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 3,
    backgroundColor: COLORS.gold,
  },
  histInfo: { flex: 1, justifyContent: 'center' },
  histTitle: { fontSize: 14, fontFamily: FONTS.bold, color: '#fff', marginBottom: 4 },
  histTags: { fontSize: 11, color: COLORS.textFaint, fontFamily: FONTS.regular, lineHeight: 15, marginBottom: 8 },
  histEps: { fontSize: 12.5, color: '#B8B8CC', fontFamily: FONTS.regular },

  sectionLabel: {
    fontSize: 17,
    fontFamily: FONTS.bold,
    color: '#fff',
    marginTop: 20,
    marginBottom: 14,
  },
  trendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    columnGap: 10,
    paddingBottom: 20,
  },
  trendItem: { width: COL_W },
  trendPoster: {
    width: COL_W,
    aspectRatio: 2 / 3,
    borderRadius: 12,
    backgroundColor: COLORS.navyCard,
    overflow: 'hidden',
    marginBottom: 6,
  },
  rankBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 26,
    height: 26,
    borderTopLeftRadius: 8,
    borderBottomRightRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { fontSize: 13, fontFamily: FONTS.extraBold, color: '#fff' },
  flameViews: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  flameText: { fontSize: 9, fontFamily: FONTS.semi, color: '#fff' },
  trendTitle: { fontSize: 11.5, fontFamily: FONTS.semi, color: '#fff', lineHeight: 15 },
  trendTag: { marginTop: 2, fontSize: 10, color: COLORS.textFaint, fontFamily: FONTS.regular },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    minHeight: 360,
  },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 20,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyText: {
    fontSize: 13.5,
    color: COLORS.textFaint,
    fontFamily: FONTS.regular,
    textAlign: 'center',
    marginBottom: 22,
  },
  watchBtn: {
    paddingHorizontal: 26,
    paddingVertical: 13,
    borderRadius: 999,
    backgroundColor: COLORS.gold,
  },
  watchBtnText: { fontSize: 13.5, fontFamily: FONTS.bold, color: COLORS.navy },

  footer: {
    textAlign: 'center',
    fontSize: 10,
    color: '#3A3A56',
    paddingBottom: 20,
    fontFamily: FONTS.regular,
  },
});

export default MyListScreen;
