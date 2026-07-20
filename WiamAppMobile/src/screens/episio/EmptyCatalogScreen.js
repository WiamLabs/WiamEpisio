/**
 * Empty catalog
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Film } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const EmptyCatalogScreen = () => {
  const navigation = useNavigation();

  return (
    <EpisioScreenShell title="Catalog" scroll={false}>
      <View style={styles.center}>
        <Film size={48} color={COLORS.textFaint} />
        <Text style={styles.headline}>Nothing here yet</Text>
        <Text style={styles.sub}>New series are added as creators go live. Check Home or Discover.</Text>
        <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('Main')}>
          <Text style={styles.ctaText}>Go to Home</Text>
        </TouchableOpacity>
      </View>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 12 },
  headline: { fontFamily: FONTS.extraBold, fontSize: 20, color: COLORS.text },
  sub: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textDim, textAlign: 'center', lineHeight: 21 },
  cta: { marginTop: 16, backgroundColor: COLORS.gold, borderRadius: RADIUS.md, paddingHorizontal: 24, paddingVertical: 12 },
  ctaText: { fontFamily: FONTS.bold, color: COLORS.navy },
});

export default EmptyCatalogScreen;
