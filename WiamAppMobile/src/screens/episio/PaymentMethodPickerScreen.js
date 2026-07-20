/**
 * WiamEpisio-Payment-Method-Picker.html — choose MTN / Visa / Telecel / Bank.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Plus } from 'lucide-react-native';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';

const METHODS = [
  {
    key: 'mtn',
    icon: '📱',
    name: 'MTN Mobile Money',
    sub: '•••• 0187',
    section: 'saved',
    default: true,
  },
  {
    key: 'visa',
    icon: '💳',
    name: 'Visa •••• 4471',
    sub: 'Expires 08/28',
    section: 'saved',
  },
  {
    key: 'telecel',
    icon: '📱',
    name: 'Telecel Cash',
    sub: 'Add a new number',
    section: 'other',
  },
  {
    key: 'bank',
    icon: '🏦',
    name: 'Bank Transfer',
    sub: 'Direct from your bank',
    section: 'other',
  },
];

const PaymentMethodPickerScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation();
  const {
    amount,
    amountLabel,
    coins,
    coinLabel,
    checkoutUrl,
    reference,
    packageId,
    returnTo,
  } = route.params || {};

  const [selected, setSelected] = useState('mtn');

  const selectedMethod = useMemo(
    () => METHODS.find((m) => m.key === selected) || METHODS[0],
    [selected],
  );

  const payLabel = amountLabel
    || (amount != null ? `₵${amount}` : '₵50.00');
  const coinsLabel = coinLabel
    || (coins != null ? `${coins} Coins` : '650 Coins');

  const continueWith = () => {
    const methodPayload = {
      method: selectedMethod.key,
      preferredMethod: selectedMethod.key,
      label: selectedMethod.name,
      packageId,
      reference,
    };

    if (checkoutUrl) {
      navigation.navigate('CheckoutWeb', {
        checkoutUrl,
        ...methodPayload,
      });
      return;
    }

    const returnTo = route.params?.returnTo;
    if (returnTo) {
      navigation.navigate(returnTo, methodPayload);
      return;
    }

    if (navigation.canGoBack()) {
      const state = navigation.getState();
      const prev = state?.routes?.[state.index - 1];
      if (prev?.name) {
        navigation.navigate({
          name: prev.name,
          params: methodPayload,
          merge: true,
        });
        return;
      }
      navigation.goBack();
      return;
    }

    navigation.navigate('CheckoutWeb', methodPayload);
  };

  const renderMethod = (m) => {
    const on = m.key === selected;
    return (
      <TouchableOpacity
        key={m.key}
        style={[styles.methodItem, on && styles.methodSelected]}
        onPress={() => setSelected(m.key)}
        activeOpacity={0.85}
      >
        <View style={styles.methodIcon}>
          <Text style={styles.methodEmoji}>{m.icon}</Text>
        </View>
        <View style={styles.methodBody}>
          <View style={styles.nameRow}>
            <Text style={styles.methodName}>{m.name}</Text>
            {m.default ? (
              <View style={styles.defaultTag}>
                <Text style={styles.defaultTagText}>DEFAULT</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.methodSub}>{m.sub}</Text>
        </View>
        <View style={[styles.radio, on && styles.radioOn]}>
          {on ? <View style={styles.radioDot} /> : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.backdrop} pointerEvents="none" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 28) }]}>
        <View style={styles.handle} />
        <Text style={styles.sheetTitle}>Choose payment method</Text>
        <Text style={styles.sheetSub}>
          Paying <Text style={styles.sheetSubBold}>{payLabel}</Text> for {coinsLabel}
        </Text>

        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          <Text style={styles.sectionLabel}>Saved methods</Text>
          {METHODS.filter((m) => m.section === 'saved').map(renderMethod)}

          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Other options</Text>
          {METHODS.filter((m) => m.section === 'other').map(renderMethod)}

          <TouchableOpacity
            style={styles.addNew}
            onPress={() => setSelected('telecel')}
            activeOpacity={0.85}
          >
            <Plus size={16} color={COLORS.gold} />
            <Text style={styles.addNewText}>Add new payment method</Text>
          </TouchableOpacity>
        </ScrollView>

        <EpisioGoldButton
          label={`Continue with ${selectedMethod.name}`}
          onPress={continueWith}
          style={{ marginTop: 8 }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.navy,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0d0d24',
    opacity: 0.55,
  },
  sheet: {
    backgroundColor: COLORS.navySoft,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 14,
    paddingHorizontal: 24,
    maxHeight: '92%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 99,
    backgroundColor: COLORS.navyLine,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontFamily: FONTS.extraBold,
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  sheetSub: {
    fontFamily: FONTS.regular,
    fontSize: 11.5,
    color: COLORS.textDim,
    marginBottom: 18,
  },
  sheetSubBold: {
    fontFamily: FONTS.bold,
    color: '#fff',
  },
  sectionLabel: {
    fontFamily: FONTS.extraBold,
    fontSize: 11,
    color: COLORS.textFaint,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  methodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 13,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1.5,
    borderColor: COLORS.navyLine,
    marginBottom: 8,
  },
  methodSelected: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(212,160,23,0.08)',
  },
  methodIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.navySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodEmoji: {
    fontSize: 16,
  },
  methodBody: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  methodName: {
    fontFamily: FONTS.bold,
    fontSize: 12.5,
    color: '#fff',
  },
  defaultTag: {
    backgroundColor: 'rgba(59,178,115,0.14)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  defaultTagText: {
    fontFamily: FONTS.extraBold,
    fontSize: 8,
    color: '#3BB273',
  },
  methodSub: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.textFaint,
    marginTop: 2,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.navyLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: COLORS.gold,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.gold,
  },
  addNew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: COLORS.navyLine,
    borderStyle: 'dashed',
    marginTop: 6,
    marginBottom: 20,
  },
  addNewText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.gold,
  },
});

export default PaymentMethodPickerScreen;
