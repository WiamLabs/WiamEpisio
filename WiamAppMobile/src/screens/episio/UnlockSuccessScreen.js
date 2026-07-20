/**
 * WiamEpisio-Unlock-Success.html
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { CheckCircle2 } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const UnlockSuccessScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { episodeId, seriesId, episodeNumber } = route.params || {};

  const continueWatching = () => {
    if (episodeId) {
      navigation.replace('Player', { episodeId, seriesId });
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main');
    }
  };

  return (
    <EpisioScreenShell
      title="Unlocked!"
      scroll={false}
      footer={(
        <TouchableOpacity style={styles.cta} onPress={continueWatching}>
          <Text style={styles.ctaText}>Continue Watching</Text>
        </TouchableOpacity>
      )}
    >
      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <CheckCircle2 size={48} color={COLORS.gold} />
        </View>
        <Text style={styles.headline}>Episode unlocked</Text>
        <Text style={styles.sub}>
          {episodeNumber ? `EP ${episodeNumber} is ready.` : 'Your episode is ready to watch.'}
        </Text>
      </View>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  iconWrap: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  headline: { fontFamily: FONTS.extraBold, fontSize: 22, color: COLORS.text, marginBottom: 8 },
  sub: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textDim, textAlign: 'center' },
  cta: { backgroundColor: COLORS.gold, borderRadius: RADIUS.md, padding: 15, alignItems: 'center' },
  ctaText: { fontFamily: FONTS.extraBold, fontSize: 14, color: COLORS.navy },
});

export default UnlockSuccessScreen;
