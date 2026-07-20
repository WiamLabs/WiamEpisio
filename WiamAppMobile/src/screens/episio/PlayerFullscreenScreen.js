/**
 * WiamEpisio-Player-Fullscreen.html — handoff to Player
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Maximize2 } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const PlayerFullscreenScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { episodeId, seriesId } = route.params || {};

  return (
    <EpisioScreenShell
      title="Fullscreen"
      subtitle="Immersive vertical playback"
      footer={(
        <TouchableOpacity
          style={styles.cta}
          onPress={() => navigation.replace('Player', { episodeId, seriesId, fullscreen: true })}
        >
          <Text style={styles.ctaText}>Open Player</Text>
        </TouchableOpacity>
      )}
    >
      <View style={styles.center}>
        <Maximize2 size={48} color={COLORS.gold} />
        <Text style={styles.note}>
          Fullscreen mode uses the main player with gesture controls, swipe-to-next, and unlock gates.
        </Text>
      </View>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: 'center', paddingTop: 48, gap: 16 },
  note: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textDim, textAlign: 'center', lineHeight: 21 },
  cta: { backgroundColor: COLORS.gold, borderRadius: RADIUS.md, padding: 15, alignItems: 'center' },
  ctaText: { fontFamily: FONTS.extraBold, fontSize: 14, color: COLORS.navy },
});

export default PlayerFullscreenScreen;
