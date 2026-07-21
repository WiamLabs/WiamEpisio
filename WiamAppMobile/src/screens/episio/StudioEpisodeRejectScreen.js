/**
 * Layout: WiamStudio-Episode-Reject-Wrong-Size.html
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, AlertTriangle } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';

const StudioEpisodeRejectScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { seriesId, episodeId, episodeNumber, message } = useRoute().params || {};

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingHorizontal: 20 }]}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <ChevronLeft size={20} color={COLORS.text} />
      </TouchableOpacity>
      <View style={styles.iconWrap}>
        <AlertTriangle size={28} color={COLORS.error} />
      </View>
      <Text style={styles.title}>Upload rejected</Text>
      <Text style={styles.sub}>
        {episodeNumber ? `Episode ${episodeNumber}` : 'This episode'} failed validation.
      </Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Why</Text>
        <Text style={styles.cardText}>
          {message || 'Wrong aspect or duration. Export 9:16 vertical or 16:9 landscape, 4–5 minutes.'}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.cta}
        onPress={() => navigation.replace('StudioEpisodeUpload', { seriesId, episodeId, episodeNumber })}
      >
        <Text style={styles.ctaText}>Re-upload</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('StudioSpecs')}>
        <Text style={styles.link}>Open Specs guide</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  back: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(228,87,61,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 22, fontFamily: FONTS.extraBold, color: COLORS.text },
  sub: { marginTop: 8, color: COLORS.textDim, fontFamily: FONTS.regular, marginBottom: 18 },
  card: {
    backgroundColor: COLORS.navyCard, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(228,87,61,0.35)', marginBottom: 20,
  },
  cardTitle: { fontFamily: FONTS.bold, color: COLORS.error, fontSize: 12, marginBottom: 6 },
  cardText: { fontFamily: FONTS.regular, color: COLORS.text, lineHeight: 20 },
  cta: { backgroundColor: COLORS.gold, borderRadius: 14, padding: 15, alignItems: 'center' },
  ctaText: { fontFamily: FONTS.bold, color: COLORS.navy },
  link: { marginTop: 16, textAlign: 'center', color: COLORS.gold, fontFamily: FONTS.semi },
});

export default StudioEpisodeRejectScreen;
