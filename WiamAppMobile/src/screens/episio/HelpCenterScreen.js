import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import { legalOrigin } from '../../utils/siteOrigin';

const FAQS = [
  { q: 'How do free episodes work?', a: 'The first episodes of each series are free. After that, unlock with coins.' },
  { q: 'What video size do creators upload?', a: 'Vertical 9:16 only — prefer 1080×1920, episodes 4–5 minutes.' },
  { q: 'How do I become a creator?', a: 'Apply from Profile → Upload Your Own Series. Founder reviews before Studio unlocks.' },
];

const HelpCenterScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const legal = legalOrigin();

  return (
    <ScrollView style={[styles.root, { paddingTop: insets.top + 8 }]} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <ChevronLeft size={20} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={styles.title}>Help Center</Text>
      {FAQS.map((f) => (
        <View key={f.q} style={styles.card}>
          <Text style={styles.q}>{f.q}</Text>
          <Text style={styles.a}>{f.a}</Text>
        </View>
      ))}
      <TouchableOpacity style={styles.cta} onPress={() => Linking.openURL('mailto:support@wiamapp.com')}>
        <Text style={styles.ctaText}>Email support@wiamapp.com</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => Linking.openURL(`${legal}/privacy`)}>
        <Text style={styles.link}>Privacy Policy</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => Linking.openURL(`${legal}/terms`)}>
        <Text style={styles.link}>Terms of Service</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  back: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 22, fontFamily: FONTS.extraBold, color: COLORS.text, marginBottom: 18 },
  card: {
    backgroundColor: COLORS.navyCard, borderRadius: 14, borderWidth: 1, borderColor: COLORS.navyLine,
    padding: 14, marginBottom: 12,
  },
  q: { fontFamily: FONTS.semi, color: COLORS.text, fontSize: 14, marginBottom: 6 },
  a: { fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 13, lineHeight: 19 },
  cta: { marginTop: 12, backgroundColor: COLORS.gold, borderRadius: 14, padding: 15, alignItems: 'center' },
  ctaText: { fontFamily: FONTS.bold, color: COLORS.navy },
  link: { marginTop: 16, color: COLORS.gold, fontFamily: FONTS.semi, textAlign: 'center' },
});

export default HelpCenterScreen;
