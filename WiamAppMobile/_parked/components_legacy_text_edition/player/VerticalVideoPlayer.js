/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
/**
 * VerticalVideoPlayer — WiamEpisio full-bleed vertical episode player.
 * Uses expo-video when available; falls back to a poster + play affordance.
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, Text, ActivityIndicator } from 'react-native';
import { Play, Pause } from 'lucide-react-native';
import { COLORS } from '../../constants/theme';

let VideoView = null;
let useVideoPlayer = null;
try {
  // eslint-disable-next-line global-require
  const ev = require('expo-video');
  VideoView = ev.VideoView;
  useVideoPlayer = ev.useVideoPlayer;
} catch {
  VideoView = null;
  useVideoPlayer = null;
}

const FallbackPlayer = ({ uri, paused, onToggle }) => (
  <Pressable style={styles.fill} onPress={onToggle}>
    <View style={styles.fallback}>
      <Text style={styles.fallbackHint} numberOfLines={2}>
        {uri ? 'Video ready — install/rebuild with expo-video for playback' : 'No stream URL'}
      </Text>
      <View style={styles.centerBtn}>
        {paused ? <Play size={40} color={COLORS.secondary} /> : <Pause size={40} color={COLORS.secondary} />}
      </View>
      {uri ? <Text style={styles.uriHint} numberOfLines={1}>{uri}</Text> : null}
    </View>
  </Pressable>
);

const ExpoVideoPlayer = ({ uri, paused, onProgress, onEnd, onToggle }) => {
  const player = useVideoPlayer(uri || '', (p) => {
    p.loop = false;
    p.play();
  });

  useEffect(() => {
    if (!player) return;
    if (!uri) return;
    try {
      player.replace(uri);
    } catch {
      /* older API */
    }
  }, [uri, player]);

  useEffect(() => {
    if (!player) return;
    if (paused) player.pause();
    else player.play();
  }, [paused, player]);

  useEffect(() => {
    if (!player) return undefined;
    const interval = setInterval(() => {
      try {
        const current = player.currentTime || 0;
        const duration = player.duration || 0;
        onProgress?.({ currentTime: current, duration });
        if (duration > 0 && current >= duration - 0.35) {
          onEnd?.();
        }
      } catch {
        /* ignore */
      }
    }, 500);
    return () => clearInterval(interval);
  }, [player, onProgress, onEnd]);

  if (!VideoView || !player) {
    return <FallbackPlayer uri={uri} paused={paused} onToggle={onToggle} />;
  }

  return (
    <Pressable style={styles.fill} onPress={onToggle}>
      <VideoView
        style={styles.fill}
        player={player}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
      />
      {paused ? (
        <View style={styles.pauseOverlay} pointerEvents="none">
          <Play size={48} color={COLORS.secondary} fill={COLORS.secondary} />
        </View>
      ) : null}
    </Pressable>
  );
};

const VerticalVideoPlayer = ({
  uri,
  paused = false,
  loading = false,
  onTogglePause,
  onProgress,
  onEnd,
}) => {
  if (loading) {
    return (
      <View style={[styles.fill, styles.center]}>
        <ActivityIndicator color={COLORS.secondary} size="large" />
      </View>
    );
  }

  if (!useVideoPlayer || !VideoView) {
    return (
      <FallbackPlayer
        uri={uri}
        paused={paused}
        onToggle={onTogglePause}
      />
    );
  }

  return (
    <ExpoVideoPlayer
      uri={uri}
      paused={paused}
      onProgress={onProgress}
      onEnd={onEnd}
      onToggle={onTogglePause}
    />
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%', height: '100%', backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  fallback: {
    flex: 1,
    backgroundColor: '#0a0a12',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fallbackHint: { color: COLORS.textMuted, textAlign: 'center', marginBottom: 16 },
  centerBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(212,168,67,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uriHint: { color: COLORS.textMuted, fontSize: 10, marginTop: 20, opacity: 0.5 },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
});

export default VerticalVideoPlayer;
