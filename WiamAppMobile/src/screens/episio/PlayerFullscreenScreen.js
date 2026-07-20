/**
 * WiamEpisio-Player-Fullscreen.html — fullscreen navy player chrome (UI only).
 * Not a real video engine — static scrubber + chrome matching the HTML mock.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import {
  Minimize2,
  Lock,
  Unlock,
  Play,
  SkipBack,
  SkipForward,
} from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';

const formatTime = (seconds) => {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
};

const PlayerFullscreenScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation();
  const {
    episodeId,
    seriesId,
    episodeNumber,
    episodeTotal,
    position,
    duration,
    label,
  } = route.params || {};

  const [locked, setLocked] = useState(false);

  const progress = useMemo(() => {
    const pos = Number(position);
    const dur = Number(duration);
    if (Number.isFinite(pos) && Number.isFinite(dur) && dur > 0) {
      return Math.min(1, Math.max(0, pos / dur));
    }
    return 0.5;
  }, [position, duration]);

  const posLabel = Number.isFinite(Number(position)) ? formatTime(position) : formatTime((duration || 590) * progress);
  const durLabel = Number.isFinite(Number(duration)) && Number(duration) > 0
    ? formatTime(duration)
    : '9:50';

  const epLabel = label
    || (episodeNumber != null
      ? `EP ${episodeNumber}${episodeTotal != null ? ` of ${episodeTotal}` : ''}`
      : 'EP · Fullscreen');

  const exitFullscreen = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.replace('Player', { episodeId, seriesId });
  };

  const goPrev = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Player', { episodeId, seriesId, skip: 'prev' });
  };

  const goNext = () => {
    navigation.navigate('Player', { episodeId, seriesId, skip: 'next' });
  };

  const openPlayer = () => {
    navigation.replace('Player', { episodeId, seriesId, fullscreen: false });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.videoBg} pointerEvents="none" />
      <View style={styles.zoomRing} pointerEvents="none" />
      <View style={styles.fadeTop} pointerEvents="none" />
      <View style={styles.fadeBottom} pointerEvents="none" />

      <View style={styles.topRow}>
        <TouchableOpacity style={styles.exitBtn} onPress={exitFullscreen} activeOpacity={0.85}>
          <Minimize2 size={14} color="#fff" />
          <Text style={styles.exitText}>Exit Fullscreen</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.lockBtn}
          onPress={() => setLocked((v) => !v)}
          activeOpacity={0.85}
        >
          {locked
            ? <Lock size={15} color={COLORS.gold} />
            : <Unlock size={15} color="#fff" />}
        </TouchableOpacity>
      </View>

      <View style={styles.epTag}>
        <Text style={styles.epTagText}>{epLabel}</Text>
      </View>

      <TouchableOpacity
        style={styles.centerPlay}
        onPress={locked ? undefined : openPlayer}
        disabled={locked}
        activeOpacity={0.85}
      >
        <Play size={24} color="#fff" fill="#fff" />
      </TouchableOpacity>

      <View style={styles.bottomControls}>
        <View style={styles.scrubRow}>
          <Text style={styles.timeLabel}>{posLabel}</Text>
          <View style={styles.scrubTrack}>
            <View style={[styles.scrubFill, { width: `${progress * 100}%` }]} />
            <View style={[styles.scrubHandle, { left: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.timeLabel}>{durLabel}</Text>
        </View>

        <View style={styles.controlsRow}>
          <View style={styles.crLeft}>
            <TouchableOpacity onPress={locked ? undefined : goPrev} disabled={locked} hitSlop={10}>
              <SkipBack size={19} color={locked ? COLORS.textFaint : '#fff'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={locked ? undefined : goNext} disabled={locked} hitSlop={10}>
              <SkipForward size={19} color={locked ? COLORS.textFaint : '#fff'} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.pinchHint} onPress={exitFullscreen} activeOpacity={0.85}>
            <Minimize2 size={16} color="#fff" />
            <Text style={styles.pinchText}>Pinch to shrink</Text>
          </TouchableOpacity>
        </View>
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0d0d24',
  },
  zoomRing: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -110,
    marginLeft: -110,
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  fadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 110,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 110,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    zIndex: 4,
  },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  exitText: {
    fontFamily: FONTS.semi,
    fontSize: 12,
    color: '#fff',
  },
  lockBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  epTag: {
    alignSelf: 'flex-start',
    marginTop: 14,
    marginLeft: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 999,
    zIndex: 4,
  },
  epTagText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#fff',
  },
  centerPlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -29,
    marginLeft: -29,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  bottomControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingBottom: 20,
    paddingTop: 10,
    zIndex: 4,
  },
  scrubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 10,
  },
  timeLabel: {
    fontFamily: FONTS.semi,
    fontSize: 10.5,
    color: '#fff',
    minWidth: 34,
  },
  scrubTrack: {
    flex: 1,
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.3)',
    position: 'relative',
  },
  scrubFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.gold,
    borderRadius: 999,
  },
  scrubHandle: {
    position: 'absolute',
    top: '50%',
    marginTop: -6,
    marginLeft: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.gold,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  crLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  pinchHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pinchText: {
    fontFamily: FONTS.semi,
    fontSize: 11,
    color: '#fff',
  },
});

export default PlayerFullscreenScreen;
