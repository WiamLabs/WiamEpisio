/**
 * Paystack / hosted checkout — opens authorization_url then verifies reference.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { COLORS, FONTS } from '../../constants/theme';
import coinsApi from '../../api/coins';

const CheckoutWebScreen = () => {
  const navigation = useNavigation();
  const params = useRoute().params || {};
  const {
    checkoutUrl,
    reference,
    packLabel,
    returnTo = 'BuyCoins',
  } = params;
  const [status, setStatus] = useState('Opening checkout…');

  const finish = useCallback((ok) => {
    if (navigation.canGoBack()) navigation.goBack();
    if (ok) {
      navigation.navigate(returnTo === 'VipCheckout' ? 'Membership' : 'BuyCoins');
    } else if (returnTo) {
      navigation.navigate(returnTo);
    }
  }, [navigation, returnTo]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!checkoutUrl) {
        setStatus('No checkout link — returning to Buy Coins');
        setTimeout(() => finish(false), 600);
        return;
      }
      try {
        setStatus(packLabel ? `Paying for ${packLabel}…` : 'Complete payment in the browser…');
        await WebBrowser.openBrowserAsync(checkoutUrl, {
          dismissButtonStyle: 'close',
          showTitle: true,
          enableBarCollapsing: true,
        });
        if (cancelled) return;
        if (reference) {
          setStatus('Confirming payment…');
          try {
            const verified = await coinsApi.verify(reference);
            if (verified?.ok || verified?.verified || verified?.balance != null) {
              Alert.alert('Payment received', 'Coins will appear in your wallet shortly.');
              finish(true);
              return;
            }
          } catch { /* user may have cancelled */ }
        }
        Alert.alert(
          'Checkout closed',
          'If you paid, pull to refresh Buy Coins — your balance updates after confirmation.',
        );
        finish(false);
      } catch (e) {
        if (!cancelled) {
          Alert.alert('Checkout failed', e?.message || 'Could not open payment page.');
          finish(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [checkoutUrl, reference, packLabel, finish]);

  return (
    <View style={styles.root}>
      <ActivityIndicator color={COLORS.gold} />
      <Text style={styles.text}>{status}</Text>
      <Text style={styles.sub}>Stay on this screen until the browser closes.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: COLORS.navy, alignItems: 'center',
    justifyContent: 'center', padding: 28,
  },
  text: {
    marginTop: 16, fontFamily: FONTS.bold, color: '#fff', fontSize: 15, textAlign: 'center',
  },
  sub: {
    marginTop: 8, fontFamily: FONTS.regular, color: COLORS.textFaint, fontSize: 12, textAlign: 'center',
  },
});

export default CheckoutWebScreen;
