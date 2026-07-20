/**
 * Episode autoplay countdown — Up Next 5s
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const COUNTDOWN_START = 5;

const EpisodeAutoplayCountdownScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { nextEpisodeId, seriesId, nextTitle } = route.params || {};
  const [seconds, setSeconds] = useState(COUNTDOWN_START);

  useEffect(() => {
    if (seconds <= 0) {
      navigation.replace('Player', { episodeId: nextEpisodeId, seriesId });
      return undefined;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, navigation, nextEpisodeId, seriesId]);

  const playNow = () => {
    navigation.replace('Player', { episodeId: nextEpisodeId, seriesId });
  };

  const cancel = () => navigation.goBack();

  return (
    <EpisioScreenShell title="Up Next" subtitle={nextTitle || 'Next episode'} scroll={false}>
      <View style={styles.center}>
        <View style={styles.ring}>
          <Text style={styles.count}>{seconds}</Text>
        </View>
        <Text style={styles.label}>Starting in {seconds}s</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.cta} onPress={playNow}>
          <Text style={styles.ctaText}>Play Now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancel} onPress={cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ring: {
    width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  count: { fontFamily: FONTS.extraBold, fontSize: 36, color: COLORS.gold },
  label: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textDim },
  actions: { paddingBottom: 20, gap: 10 },
  cta: { backgroundColor: COLORS.gold, borderRadius: RADIUS.md, padding: 15, alignItems: 'center' },
  ctaText: { fontFamily: FONTS.extraBold, fontSize: 14, color: COLORS.navy },
  cancel: { padding: 12, alignItems: 'center' },
  cancelText: { fontFamily: FONTS.semi, fontSize: 14, color: COLORS.textDim },
});

export default EpisodeAutoplayCountdownScreen;
