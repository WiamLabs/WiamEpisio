/**
 * Layout: WiamStudio-Payout-KYC.html — stub form (team payout later)
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';

const StudioPayoutKycScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingHorizontal: 20 }]}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <ChevronLeft size={20} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={styles.title}>Payout & KYC</Text>
      <Text style={styles.sub}>
        The WiamEpisio team enables payouts after your series is live and identity checks clear. Earnings never start before publish.
      </Text>
      <Text style={styles.label}>Legal name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={COLORS.textFaint} />
      <Text style={styles.label}>Mobile Money / phone</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor={COLORS.textFaint} />
      <TouchableOpacity
        style={styles.cta}
        onPress={() => Alert.alert('Received', 'Thanks — the WiamEpisio team will review your payout details.')}
      >
        <Text style={styles.ctaText}>Submit to our team</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  back: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  title: { fontSize: 22, fontFamily: FONTS.extraBold, color: '#fff' },
  sub: { marginTop: 8, marginBottom: 18, color: COLORS.textDim, fontFamily: FONTS.regular, lineHeight: 19 },
  label: { color: COLORS.textDim, fontFamily: FONTS.semi, fontSize: 11.5, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 12, padding: 13, color: COLORS.text, marginBottom: 12, fontFamily: FONTS.regular,
  },
  cta: { backgroundColor: COLORS.gold, borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 8 },
  ctaText: { fontFamily: FONTS.bold, color: COLORS.navy },
});

export default StudioPayoutKycScreen;
