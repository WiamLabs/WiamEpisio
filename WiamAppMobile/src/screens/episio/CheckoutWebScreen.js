/**
 * Legacy checkout chrome — redirects to BuyCoins for old deep links.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '../../constants/theme';

const CheckoutWebScreen = () => {
  const navigation = useNavigation();

  useEffect(() => {
    const t = setTimeout(() => {
      if (navigation.canGoBack()) navigation.goBack();
      navigation.navigate('BuyCoins');
    }, 400);
    return () => clearTimeout(t);
  }, [navigation]);

  return (
    <View style={styles.root}>
      <ActivityIndicator color={COLORS.gold} />
      <Text style={styles.text}>Opening in-app coin packs…</Text>
      <Text style={styles.sub}>Complete your purchase in the app — no external checkout.</Text>
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
