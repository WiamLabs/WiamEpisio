/**
 * Home hero: up to 6 featured trailers.
 * Muted autoplay on the active slide; press → TrailerPlayer (with sound).
 * Renders nothing when there are no featured items (no placeholders).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Image, Dimensions,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { Play } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import watchApi from '../../api/watch';
import resolveUrl from '../../utils/resolveUrl';

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_H = 230;
const SIDE_PAD = 20;
const CARD_W = SCREEN_W - SIDE_PAD * 2;

function Slide({ item, active, width, onPress }) {
  const [streamUrl, setStreamUrl] = useState(null);
  const poster = resolveUrl(
    item.trailer_poster_url || item.poster_url || item.cover_url,
  );
  const direct = resolveUrl(item.trailer_hls_url || item.trailer_url);

  const player = useVideoPlayer(streamUrl || direct || '', (p) => {
    p.loop = true;
    p.muted = true;
    try { p.volume = 0; } catch { /* older expo-video */ }
  });

  useEffect(() => {
    let cancelled = false;
    if (!active) {
      try { player.pause(); } catch { /* ignore */ }
      return undefined;
    }
    (async () => {
      let url = direct;
      if (!url) {
        try {
          const data = await watchApi.trailerStream(item.id);
          url = data?.url || data?.manifest_url || data?.hls_url || data?.signed_url;
        } catch { /* poster-only fallback */ }
      }
      if (cancelled || !url) return;
      setStreamUrl(url);
      try {
        player.muted = true;
        player.volume = 0;
        player.replace(url);
        player.play();
      } catch { /* ignore */ }
    })();
    return () => {
      cancelled = true;
      try { player.pause(); } catch { /* ignore */ }
    };
  }, [active, item.id, direct, player]);

  const meta = [
    item.genre,
    item.total_episodes ? `${item.total_episodes} Episodes` : null,
    item.featured_source && item.featured_source !== 'home'
      ? String(item.featured_source).replace(/_/g, ' ')
      : null,
  ].filter(Boolean).join(' · ');

  return (
    <Pressable style={[styles.card, { width }]} onPress={() => onPress(item)}>
      {streamUrl || direct ? (
        <VideoView
          style={StyleSheet.absoluteFill}
          player={player}
          nativeControls={false}
          contentFit="cover"
          pointerEvents="none"
        />
      ) : poster ? (
        <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={['#2a1a1a', '#0d0d24']}
          style={StyleSheet.absoluteFill}
        />
      )}
      <LinearGradient
        colors={['transparent', 'rgba(8,8,26,0.2)', 'rgba(8,8,26,0.95)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.play}>
        <Play size={22} color={COLORS.navy} fill={COLORS.navy} />
      </View>
      <View style={styles.content}>
        <Text style={styles.badge}>TRAILER</Text>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        {meta ? <Text style={styles.meta} numberOfLines={1}>{meta}</Text> : null}
      </View>
    </Pressable>
  );
}

/** Build up to 6 featured cards: founder slots first, then Origin / VIP / Ranking / Fresh. */
export function buildFeaturedList(data) {
  const seen = new Set();
  const out = [];
  const push = (list, source) => {
    for (const s of list || []) {
      if (!s?.id || seen.has(s.id)) continue;
      seen.add(s.id);
      out.push({ ...s, featured_source: source });
      if (out.length >= 6) return true;
    }
    return false;
  };
  const ft = data?.featured_trailers || {};
  if (push(ft.home_featured, 'home')) return out;
  if (push(ft.origin, 'origin')) return out;
  if (push(ft.vip, 'vip')) return out;
  if (push(ft.ranking, 'ranking')) return out;
  if (push(data?.shelves?.origin, 'origin')) return out;
  if (push(data?.shelves?.vip, 'vip')) return out;
  if (push(data?.popular, 'rankings')) return out;
  if (push(data?.coming_soon, 'coming_soon')) return out;
  push(data?.fresh, 'fresh');
  return out;
}

const FeaturedTrailerCarousel = ({ items, onPressItem }) => {
  const [index, setIndex] = useState(0);
  const listRef = useRef(null);

  const onScrollEnd = useCallback((e) => {
    const x = e.nativeEvent.contentOffset.x;
    const next = Math.round(x / CARD_W);
    if (next >= 0 && next < items.length) setIndex(next);
  }, [items.length]);

  if (!items?.length) return null;

  return (
    <View style={styles.wrap}>
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item) => String(item.id)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={CARD_W}
        snapToAlignment="start"
        disableIntervalMomentum
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, i) => ({ length: CARD_W, offset: CARD_W * i, index: i })}
        renderItem={({ item, index: i }) => (
          <Slide
            item={item}
            active={i === index}
            width={CARD_W}
            onPress={onPressItem}
          />
        )}
      />
      {items.length > 1 ? (
        <View style={styles.dots}>
          {items.map((item, i) => (
            <View
              key={item.id}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  card: {
    height: HERO_H,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#0d0d24',
  },
  play: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -26,
    marginTop: -26,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(212,160,23,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16 },
  badge: {
    alignSelf: 'flex-start',
    fontSize: 9.5,
    fontFamily: FONTS.bold,
    color: COLORS.navy,
    backgroundColor: COLORS.gold,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 5,
    marginBottom: 8,
    overflow: 'hidden',
    letterSpacing: 0.4,
  },
  title: { fontSize: 18, fontFamily: FONTS.extraBold, color: '#fff', marginBottom: 4 },
  meta: { fontSize: 11, color: '#C9C9DE', fontFamily: FONTS.regular },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.navyLine,
  },
  dotActive: { backgroundColor: COLORS.gold, width: 16 },
});

export default FeaturedTrailerCarousel;
