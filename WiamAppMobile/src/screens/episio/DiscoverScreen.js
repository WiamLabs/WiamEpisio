/**
 * Discover tab = For You feed (WiamEpisio-For-You-Feed.html).
 * Vertical cards; tap opens series / trailer — not a blank empty shell.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, RefreshControl, Dimensions, Share, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, Search, Bookmark, Share2, Maximize2 } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import watchApi from '../../api/watch';
import studioEpisioApi from '../../api/studioEpisio';
import useAuthStore from '../../store/useAuthStore';
import resolveUrl from '../../utils/resolveUrl';

const { width: W, height: SCREEN_H } = Dimensions.get('window');
const FRAME_H = Math.min(SCREEN_H * 0.48, W * (16 / 9) * 0.95);

const DiscoverScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const saveToList = async (seriesId) => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    try {
      await studioEpisioApi.remind(seriesId);
      Alert.alert('My List', 'Saved — reminder set.');
    } catch (e) {
      Alert.alert('My List', e?.message || 'Could not save');
    }
  };

  const load = useCallback(async () => {
    try {
      const home = await watchApi.home();
      const merged = [
        ...(home.featured_trailers?.home_featured || []),
        ...(home.popular || []),
        ...(home.fresh || []),
        ...(home.shelves?.origin || []),
      ];
      const seen = new Set();
      const unique = [];
      for (const s of merged) {
        if (!s?.id || seen.has(s.id)) continue;
        seen.add(s.id);
        unique.push(s);
      }
      setItems(unique);
    } catch {
      setItems([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const renderItem = ({ item, index }) => {
    const uri = resolveUrl(item.trailer_poster_url || item.poster_url || item.cover_url);
    return (
      <View style={styles.block}>
        <TouchableOpacity
          style={[styles.videoFrame, { height: FRAME_H }]}
          activeOpacity={0.95}
          onPress={() => navigation.navigate('TrailerPlayer', {
            seriesId: item.id,
            title: item.title,
          })}
        >
          {uri ? (
            <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <LinearGradient colors={['#2a1a12', '#0d0d24', '#000']} style={StyleSheet.absoluteFill} />
          )}
          <View style={styles.swipeEdge}>
            {[0, 1, 2, 3].map((d) => (
              <View key={d} style={[styles.swipeDot, d === (index % 4) && styles.swipeDotActive]} />
            ))}
          </View>
          <View style={styles.centerPlay}>
            <Play size={22} color="#fff" fill="#fff" />
          </View>
          <View style={styles.videoControls}>
            <View style={styles.badgeRow}>
              {item.is_wiam_origin ? (
                <Text style={[styles.infoBadge, styles.exclusive]}>EXCLUSIVE</Text>
              ) : null}
              {item.genre ? (
                <Text style={[styles.infoBadge, styles.genreBadge]}>{item.genre}</Text>
              ) : null}
            </View>
            <Maximize2 size={16} color="#fff" />
          </View>
        </TouchableOpacity>

        <View style={styles.infoPanel}>
          <Text style={styles.seriesTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.epCaption} numberOfLines={3}>
            {item.description
              || `EP.1 — ${item.genre || 'Drama'} short series on WiamEpisio.`}
            {' '}
            <Text style={styles.more}>more</Text>
          </Text>
          <TouchableOpacity
            style={styles.watchBtn}
            onPress={() => navigation.navigate('SeriesDetail', { seriesId: item.id })}
          >
            <Text style={styles.watchBtnText}>Watch Full Series</Text>
          </TouchableOpacity>
          <View style={styles.actionStrip}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => saveToList(item.id)}
            >
              <Bookmark size={20} color="#C9C9DE" />
              <Text style={styles.actionLabel}>My List</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => Share.share({ message: `${item.title} on WiamEpisio` }).catch(() => {})}
            >
              <Share2 size={20} color="#C9C9DE" />
              <Text style={styles.actionLabel}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>For You</Text>
        <TouchableOpacity style={styles.searchBtn} onPress={() => navigation.navigate('Search')}>
          <Search size={15} color="#C9C9DE" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        pagingEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={COLORS.gold}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.empty}>
              For You fills when series go live. Browse Home meanwhile.
            </Text>
            <TouchableOpacity style={styles.watchBtn} onPress={() => navigation.navigate('Home')}>
              <Text style={styles.watchBtnText}>Go to Home</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topBar: {
    paddingHorizontal: 18,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topTitle: { fontSize: 15, fontFamily: FONTS.bold, color: '#fff' },
  searchBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.navyCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  block: { marginBottom: 8 },
  videoFrame: {
    width: '100%',
    backgroundColor: '#0d0d24',
    overflow: 'hidden',
  },
  swipeEdge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 8,
    justifyContent: 'center',
    gap: 5,
  },
  swipeDot: {
    width: 3,
    height: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  swipeDotActive: { backgroundColor: COLORS.gold },
  centerPlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -26,
    marginTop: -26,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeRow: { flexDirection: 'row', gap: 6 },
  infoBadge: {
    fontSize: 9.5,
    fontFamily: FONTS.bold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    overflow: 'hidden',
  },
  exclusive: { backgroundColor: COLORS.gold, color: COLORS.navy },
  genreBadge: { backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' },
  infoPanel: { paddingHorizontal: 18, paddingVertical: 16, backgroundColor: COLORS.navy },
  seriesTitle: { fontSize: 15.5, fontFamily: FONTS.bold, color: '#fff', marginBottom: 6 },
  epCaption: { fontSize: 12, color: '#8B8BA3', lineHeight: 18, marginBottom: 14, fontFamily: FONTS.regular },
  more: { color: COLORS.gold, fontFamily: FONTS.semi },
  watchBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    marginBottom: 16,
  },
  watchBtnText: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.navy },
  actionStrip: {
    flexDirection: 'row',
    gap: 22,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1a1a3a',
  },
  actionItem: { alignItems: 'center', gap: 4 },
  actionLabel: { fontSize: 10, color: '#8B8BA3', fontFamily: FONTS.regular },
  emptyWrap: { padding: 32, alignItems: 'center' },
  empty: {
    textAlign: 'center',
    color: COLORS.textFaint,
    fontFamily: FONTS.medium,
    marginBottom: 20,
    lineHeight: 20,
  },
});

export default DiscoverScreen;
