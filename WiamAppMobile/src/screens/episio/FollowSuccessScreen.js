/**
 * Follow success confirmation
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { UserCheck } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const FollowSuccessScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const creatorName = route.params?.creatorName || 'this creator';

  return (
    <EpisioScreenShell
      title="Following"
      scroll={false}
      footer={(
        <TouchableOpacity style={styles.cta} onPress={() => navigation.goBack()}>
          <Text style={styles.ctaText}>Done</Text>
        </TouchableOpacity>
      )}
    >
      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <UserCheck size={40} color={COLORS.gold} />
        </View>
        <Text style={styles.headline}>You're following {creatorName}</Text>
        <Text style={styles.sub}>New series and drops from this creator will surface in your feed.</Text>
      </View>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 20 },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  headline: { fontFamily: FONTS.extraBold, fontSize: 20, color: COLORS.text, textAlign: 'center', marginBottom: 8 },
  sub: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textDim, textAlign: 'center', lineHeight: 20 },
  cta: { backgroundColor: COLORS.gold, borderRadius: RADIUS.md, padding: 15, alignItems: 'center' },
  ctaText: { fontFamily: FONTS.extraBold, fontSize: 14, color: COLORS.navy },
});

export default FollowSuccessScreen;
