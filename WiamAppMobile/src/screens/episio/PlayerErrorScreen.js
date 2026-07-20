/**
 * WiamEpisio-Player-Error.html
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { AlertTriangle } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const PlayerErrorScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { episodeId, seriesId, message } = route.params || {};

  const retry = () => {
    navigation.replace('Player', { episodeId, seriesId });
  };

  return (
    <EpisioScreenShell
      title="Playback error"
      scroll={false}
      footer={(
        <TouchableOpacity style={styles.cta} onPress={retry}>
          <Text style={styles.ctaText}>Retry</Text>
        </TouchableOpacity>
      )}
    >
      <View style={styles.center}>
        <AlertTriangle size={48} color={COLORS.error} />
        <Text style={styles.headline}>Couldn't play this episode</Text>
        <Text style={styles.sub}>{message || 'Check your connection and try again.'}</Text>
      </View>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 12 },
  headline: { fontFamily: FONTS.extraBold, fontSize: 18, color: COLORS.text, textAlign: 'center' },
  sub: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textDim, textAlign: 'center', lineHeight: 20 },
  cta: { backgroundColor: COLORS.gold, borderRadius: RADIUS.md, padding: 15, alignItems: 'center' },
  ctaText: { fontFamily: FONTS.extraBold, fontSize: 14, color: COLORS.navy },
});

export default PlayerErrorScreen;
