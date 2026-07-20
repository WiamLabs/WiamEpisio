/**
 * Payment method picker — Mobile Money / Card / Bank
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Smartphone, CreditCard, Building2, ChevronRight } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const METHODS = [
  { key: 'momo', label: 'Mobile Money', sub: 'MTN · Vodafone · AirtelTigo', icon: Smartphone },
  { key: 'card', label: 'Debit / Credit Card', sub: 'Visa · Mastercard', icon: CreditCard },
  { key: 'bank', label: 'Bank transfer', sub: 'Paystack bank channels', icon: Building2 },
];

const PaymentMethodPickerScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { packageId, checkoutUrl, reference, amount } = route.params || {};

  const pick = (method) => {
    if (checkoutUrl) {
      navigation.navigate('CheckoutWeb', { checkoutUrl, reference, label: METHODS.find((m) => m.key === method)?.label });
    } else {
      navigation.navigate('BuyCoins', { preferredMethod: method, packageId, amount });
    }
  };

  return (
    <EpisioScreenShell title="Payment method" subtitle="Choose how to pay">
      {METHODS.map((m) => {
        const Icon = m.icon;
        return (
          <TouchableOpacity key={m.key} style={styles.row} onPress={() => pick(m.key)}>
            <View style={styles.iconWrap}><Icon size={20} color={COLORS.gold} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{m.label}</Text>
              <Text style={styles.sub}>{m.sub}</Text>
            </View>
            <ChevronRight size={18} color={COLORS.textFaint} />
          </TouchableOpacity>
        );
      })}
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.navyLine,
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { fontFamily: FONTS.semi, fontSize: 15, color: COLORS.text },
  sub: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textDim, marginTop: 2 },
});

export default PaymentMethodPickerScreen;
