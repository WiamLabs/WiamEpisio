/**
 * Creator ↔ Viewer switch — go to Studio
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Clapperboard, Tv } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';
import useAuthStore from '../../store/useAuthStore';

const CreatorViewerSwitchScreen = () => {
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const isCreator = user?.is_creator || user?.creator_status === 'approved';

  return (
    <EpisioScreenShell title="Switch mode" subtitle="Viewer or Studio">
      <View style={styles.card}>
        <Tv size={28} color={COLORS.gold} />
        <Text style={styles.cardTitle}>Viewer</Text>
        <Text style={styles.cardSub}>Watch drama, manage My List, buy coins.</Text>
        <Text style={styles.active}>Currently active</Text>
      </View>
      <TouchableOpacity
        style={[styles.card, styles.studioCard]}
        onPress={() => {
          if (!isCreator) {
            navigation.navigate('CreatorApply');
            return;
          }
          navigation.navigate('StudioHome');
        }}
      >
        <Clapperboard size={28} color={COLORS.navy} />
        <Text style={[styles.cardTitle, styles.studioTitle]}>Wiam Studio</Text>
        <Text style={[styles.cardSub, styles.studioSub]}>Upload series, track reviews, go live.</Text>
        <Text style={styles.switchCta}>{isCreator ? 'Switch to Studio →' : 'Apply to create →'}</Text>
      </TouchableOpacity>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.navyLine,
    padding: 20, marginBottom: 14, gap: 6,
  },
  studioCard: { backgroundColor: COLORS.gold, borderColor: COLORS.goldDark },
  cardTitle: { fontFamily: FONTS.extraBold, fontSize: 17, color: COLORS.text },
  studioTitle: { color: COLORS.navy },
  cardSub: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textDim, lineHeight: 18 },
  studioSub: { color: COLORS.navy, opacity: 0.8 },
  active: { fontFamily: FONTS.semi, fontSize: 12, color: COLORS.gold, marginTop: 8 },
  switchCta: { fontFamily: FONTS.extraBold, fontSize: 13, color: COLORS.navy, marginTop: 8 },
});

export default CreatorViewerSwitchScreen;
