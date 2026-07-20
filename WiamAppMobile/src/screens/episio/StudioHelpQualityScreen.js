/**
 * Layout: WiamStudio-Help-Quality.html
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';

const FAQS = [
  {
    q: 'What does the WiamEpisio team check?',
    a: 'Your trailer and every episode — picture, sound, light, frame, duration (4–5 min), 9:16, and no watermarks. Cover and banner too.',
  },
  {
    q: 'Series or Season — what’s the difference?',
    a: 'Series = one complete story you submit once. Season = Season N of a longer show; finish that season fully, then submit season-by-season after the previous one is live.',
  },
  {
    q: 'If something fails, does Episode 1 still go live?',
    a: 'No. Needs Changes keeps the whole series offline until everything is fixed and our team publishes.',
  },
  {
    q: 'What about Revision Requests?',
    a: 'Only after you’re live, and only for legal, rights, or factual fixes — not quality. Only the piece you pick is re-reviewed; the rest stays live.',
  },
];

const StudioHelpQualityScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={15} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.h1}>Quality & review help</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {FAQS.map((f) => (
          <View key={f.q} style={styles.card}>
            <Text style={styles.q}>{f.q}</Text>
            <Text style={styles.a}>{f.a}</Text>
          </View>
        ))}
        <TouchableOpacity onPress={() => navigation.navigate('StudioSpecs')}>
          <Text style={styles.link}>Open Specs guide →</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  h1: { fontFamily: FONTS.extraBold, color: '#fff', fontSize: 16 },
  card: {
    backgroundColor: COLORS.navyCard, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  q: { fontFamily: FONTS.bold, color: '#fff', fontSize: 13, marginBottom: 6 },
  a: { fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 12.5, lineHeight: 19 },
  link: { marginTop: 12, color: COLORS.gold, fontFamily: FONTS.semi },
});

export default StudioHelpQualityScreen;
