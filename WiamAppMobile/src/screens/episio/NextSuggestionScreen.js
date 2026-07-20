/**
 * WiamEpisio-Next-Suggestion.html — More Dramas You'll Love (bottom panel).
 * Uses params.items only — never invents fake series titles when empty.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const CENTER_W = 130;
const PEEK_W = 90;

const NextSuggestionScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation();
  const { items, suggestions } = route.params || {};

  const list = useMemo(() => {
    const raw = Array.isArray(items)
      ? items
      : (Array.isArray(suggestions) ? suggestions : []);
    return raw
      .filter((it) => it && (it.id || it.seriesId || it.episodeId))
      .map((it) => ({
        id: String(it.id || it.seriesId || it.episodeId),
        seriesId: it.seriesId || it.id,
        episodeId: it.episodeId,
        title: it.title || it.name || 'Untitled',
        meta: it.meta || it.genre || it.subtitle || '',
        coverUrl: it.coverUrl || it.posterUrl || it.thumbnail || null,
      }));
  }, [items, suggestions]);

  const [index, setIndex] = useState(0);
  const current = list[index] || null;
  const hasItems = list.length > 0;

  const onWatch = () => {
    if (!current) return;
    if (current.episodeId) {
      navigation.replace('Player', {
        episodeId: current.episodeId,
        seriesId: current.seriesId,
      });
      return;
    }
    navigation.navigate('SeriesDetail', { seriesId: current.seriesId || current.id });
  };

  const onExit = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Main');
  };

  const peekLeft = hasItems && list.length > 1
    ? list[(index - 1 + list.length) % list.length]
    : null;
  const peekRight = hasItems && list.length > 1
    ? list[(index + 1) % list.length]
    : null;

  const renderPoster = (item, size, styleExtra) => {
    if (!item) {
      return <View style={[styles.posterEmpty, { width: size.w, height: size.h }, styleExtra]} />;
    }
    return (
      <View style={[styles.posterWrap, { width: size.w, height: size.h }, styleExtra]}>
        {item.coverUrl ? (
          <Image source={{ uri: item.coverUrl }} style={styles.posterImg} resizeMode="cover" />
        ) : (
          <LinearGradient colors={[COLORS.navyCard, '#0d0d24']} style={styles.posterImg} />
        )}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.videoBg} pointerEvents="none" />
      <LinearGradient
        colors={['transparent', COLORS.navy]}
        style={styles.videoFade}
        pointerEvents="none"
      />

      <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <Text style={styles.h1}>More Dramas You'll Love</Text>

        {!hasItems ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyPoster} />
            <Text style={styles.emptyTitle}>No suggestions yet</Text>
            <Text style={styles.emptySub}>
              Keep watching — we'll surface dramas you'll love as your taste grows.
            </Text>
            <EpisioGoldButton
              variant="ghost"
              label="Exit"
              onPress={onExit}
              style={{ width: '100%', marginTop: 18 }}
            />
          </View>
        ) : (
          <>
            <View style={styles.carousel}>
              {peekLeft ? (
                <TouchableOpacity
                  onPress={() => setIndex((i) => (i - 1 + list.length) % list.length)}
                  style={styles.peekHitLeft}
                  activeOpacity={0.9}
                >
                  {renderPoster(peekLeft, { w: PEEK_W, h: 130 }, styles.peekLeft)}
                </TouchableOpacity>
              ) : (
                <View style={[styles.peekGhost, styles.peekLeft]} />
              )}

              <TouchableOpacity
                onPress={() => list.length > 1 && setIndex((i) => (i + 1) % list.length)}
                style={styles.centerHit}
                activeOpacity={0.9}
              >
                {renderPoster(current, { w: CENTER_W, h: 170 }, styles.centerPoster)}
              </TouchableOpacity>

              {peekRight ? (
                <TouchableOpacity
                  onPress={() => setIndex((i) => (i + 1) % list.length)}
                  style={styles.peekHitRight}
                  activeOpacity={0.9}
                >
                  {renderPoster(peekRight, { w: PEEK_W, h: 130 }, styles.peekRight)}
                </TouchableOpacity>
              ) : (
                <View style={[styles.peekGhost, styles.peekRight]} />
              )}
            </View>

            {list.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dots}
              >
                {list.map((it, i) => (
                  <View key={it.id} style={[styles.dot, i === index && styles.dotOn]} />
                ))}
              </ScrollView>
            ) : null}

            <Text style={styles.recTitle} numberOfLines={2}>{current.title}</Text>
            <Text style={styles.recMeta} numberOfLines={1}>
              {current.meta || 'Short drama'}
            </Text>

            <View style={styles.actionRow}>
              <EpisioGoldButton
                variant="ghost"
                label="Exit"
                onPress={onExit}
                style={{ flex: 1 }}
              />
              <EpisioGoldButton
                label="Watch"
                onPress={onWatch}
                style={{ flex: 1 }}
              />
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 460,
    backgroundColor: '#1a1030',
  },
  videoFade: {
    position: 'absolute',
    top: 360,
    left: 0,
    right: 0,
    height: 100,
  },
  panel: {
    position: 'absolute',
    top: 460,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.navy,
    paddingTop: 26,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  h1: {
    fontFamily: FONTS.extraBold,
    fontSize: 18,
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  carousel: {
    width: SCREEN_W - 48,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  posterWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.navyCard,
  },
  posterImg: {
    width: '100%',
    height: '100%',
  },
  posterEmpty: {
    borderRadius: 14,
    backgroundColor: COLORS.navyCard,
    opacity: 0.5,
  },
  peekLeft: {
    position: 'absolute',
    left: 6,
    opacity: 0.5,
    borderRadius: 14,
  },
  peekRight: {
    position: 'absolute',
    right: 6,
    opacity: 0.5,
    borderRadius: 14,
  },
  peekGhost: {
    position: 'absolute',
    width: PEEK_W,
    height: 130,
    borderRadius: 14,
    backgroundColor: COLORS.navyCard,
    opacity: 0.35,
  },
  peekHitLeft: {
    position: 'absolute',
    left: 6,
    zIndex: 1,
  },
  peekHitRight: {
    position: 'absolute',
    right: 6,
    zIndex: 1,
  },
  centerHit: {
    zIndex: 2,
  },
  centerPoster: {
    zIndex: 2,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.navyLine,
  },
  dotOn: {
    backgroundColor: COLORS.gold,
    width: 14,
  },
  recTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 5,
  },
  recMeta: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textDim,
    textAlign: 'center',
    marginBottom: 22,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  emptyWrap: {
    alignItems: 'center',
    width: '100%',
    paddingTop: 8,
  },
  emptyPoster: {
    width: CENTER_W,
    height: 170,
    borderRadius: 16,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    marginBottom: 18,
  },
  emptyTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: '#fff',
    marginBottom: 6,
  },
  emptySub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textDim,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
});

export default NextSuggestionScreen;
