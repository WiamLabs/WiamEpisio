/**
 * WiamEpisio-Coins-Success.html — purchase successful + receipt card.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Check, Coins } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';

const CoinsSuccessScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation();
  const {
    coins,
    amount,
    pack,
    packLabel,
    method,
    paymentMethod,
    txId,
    transactionId,
    reference,
    episodeId,
    seriesId,
  } = route.params || {};

  const [receiptOpen, setReceiptOpen] = useState(false);

  const coinsAdded = coins ?? amount ?? null;
  const packName = packLabel || pack || 'Coin pack';
  const paidAmount = typeof amount === 'string' && amount.includes('₵')
    ? amount
    : (route.params?.paidLabel || route.params?.amountPaid || (amount != null ? `₵${amount}` : '—'));
  const payMethod = paymentMethod || method || '—';
  const tx = txId || transactionId || reference || '—';

  const continueWatching = () => {
    if (episodeId) {
      navigation.replace('Player', { episodeId, seriesId });
      return;
    }
    navigation.navigate('Main');
  };

  const viewReceipt = () => {
    if (receiptOpen) {
      setReceiptOpen(false);
      return;
    }
    setReceiptOpen(true);
    Alert.alert(
      'Receipt',
      [
        `Pack: ${packName}`,
        `Amount: ${paidAmount}`,
        `Method: ${payMethod}`,
        `Transaction: ${tx}`,
      ].join('\n'),
      [{ text: 'OK' }],
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 28) }]}>
      <View style={styles.glow} pointerEvents="none" />
      <ScrollView
        contentContainerStyle={styles.wrap}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <LinearGradient
          colors={[COLORS.gold, COLORS.goldDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.badgeRing}
        >
          <Check size={38} color={COLORS.navy} strokeWidth={2.6} />
        </LinearGradient>

        <Text style={styles.title}>Purchase successful</Text>
        <Text style={styles.sub}>
          Your coins have been added to your wallet. Enjoy the show!
        </Text>

        <View style={styles.coinTally}>
          <Coins size={20} color={COLORS.gold} />
          <Text style={styles.coinValue}>
            {coinsAdded != null ? `+${coinsAdded}` : '+—'}
          </Text>
          <Text style={styles.coinHint}>coins added</Text>
        </View>

        <View style={styles.receiptCard}>
          <View style={styles.receiptRow}>
            <Text style={styles.k}>Coin Pack</Text>
            <Text style={styles.v}>{packName}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.k}>Amount Paid</Text>
            <Text style={styles.v}>{paidAmount}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.k}>Payment Method</Text>
            <Text style={styles.v}>{payMethod}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.k}>Transaction ID</Text>
            <Text style={styles.v} numberOfLines={1}>{tx}</Text>
          </View>
          {receiptOpen ? (
            <Text style={styles.receiptNote}>
              Keep this ID if you need help from support@wiamapp.com.
            </Text>
          ) : null}
        </View>

        <EpisioGoldButton
          label="Continue Watching"
          onPress={continueWatching}
          style={{ width: '100%', marginBottom: 14 }}
        />
        <TouchableOpacity onPress={viewReceipt} hitSlop={12}>
          <Text style={styles.ghostLink}>View receipt</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },
  glow: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(212,160,23,0.18)',
  },
  wrap: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingBottom: 24,
  },
  badgeRing: {
    width: 94,
    height: 94,
    borderRadius: 47,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  title: {
    fontFamily: FONTS.extraBold,
    fontSize: 22,
    color: '#fff',
    marginBottom: 8,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  sub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textDim,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 24,
  },
  coinTally: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 22,
  },
  coinValue: {
    fontFamily: FONTS.extraBold,
    fontSize: 20,
    color: '#fff',
  },
  coinHint: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textFaint,
  },
  receiptCard: {
    width: '100%',
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 12,
  },
  k: {
    fontFamily: FONTS.regular,
    fontSize: 11.5,
    color: COLORS.textDim,
  },
  v: {
    fontFamily: FONTS.bold,
    fontSize: 11.5,
    color: '#fff',
    flexShrink: 1,
    textAlign: 'right',
  },
  receiptNote: {
    fontFamily: FONTS.regular,
    fontSize: 10.5,
    color: COLORS.textFaint,
    marginTop: 10,
    lineHeight: 16,
  },
  ghostLink: {
    fontFamily: FONTS.semi,
    fontSize: 12.5,
    color: COLORS.textDim,
    textAlign: 'center',
  },
});

export default CoinsSuccessScreen;
