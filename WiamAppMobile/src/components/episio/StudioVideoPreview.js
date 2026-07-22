/**
 * Studio local/remote video preview — real audio by default, mute/unmute toggle.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Volume2, VolumeX, Film } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';

const StudioVideoPreview = ({
  uri,
  badge = 'Preview',
  aspectRatio = 9 / 16,
  maxHeight = 280,
  style,
  emptyLabel = 'No video yet',
}) => {
  const [muted, setMuted] = useState(false);
  const source = uri || '';

  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = false;
    if (source) {
      try { p.play(); } catch { /* ignore */ }
    }
  });

  useEffect(() => {
    if (!source) return undefined;
    const run = async () => {
      try {
        if (typeof player.replaceAsync === 'function') {
          await player.replaceAsync(source);
        } else {
          player.replace(source);
        }
        player.muted = muted;
        player.play();
      } catch { /* ignore */ }
    };
    run();
    return undefined;
  }, [source, player]);

  useEffect(() => {
    try {
      player.muted = muted;
    } catch { /* ignore */ }
  }, [muted, player]);

  if (!source) {
    return (
      <View style={[styles.wrap, { aspectRatio, maxHeight }, style, styles.empty]}>
        <Film size={22} color={COLORS.textFaint} />
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { aspectRatio, maxHeight }, style]}>
      <VideoView
        style={styles.video}
        player={player}
        contentFit="contain"
        nativeControls={false}
      />
      <View style={styles.badge}>
        <Film size={12} color={COLORS.navy} />
        <Text style={styles.badgeText}>{badge}</Text>
      </View>
      <TouchableOpacity
        style={styles.muteBtn}
        onPress={() => setMuted((m) => !m)}
        accessibilityLabel={muted ? 'Unmute preview' : 'Mute preview'}
        hitSlop={8}
      >
        {muted ? (
          <VolumeX size={16} color="#fff" />
        ) : (
          <Volume2 size={16} color="#fff" />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 12,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    gap: 8,
  },
  emptyText: { fontFamily: FONTS.regular, color: COLORS.textFaint, fontSize: 12 },
  video: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.gold,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { fontFamily: FONTS.bold, fontSize: 10, color: COLORS.navy },
  muteBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
});

export default StudioVideoPreview;
