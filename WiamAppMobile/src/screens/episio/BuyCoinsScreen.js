/**
 * Exact layout: WiamEpisio-Buy-Coins.html
 * In-app coin packs only.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ChevronLeft, Coins } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../constants/theme';
import coinsApi from '../../api/coins';
import useAuthStore from '../../store/useAuthStore';
import { isIAPAvailable, getProducts, purchaseCoinPack, initIAP } from '../../services/iap';
import { COIN_PRODUCTS } from '../../services/iapProducts';
import { currencyForCountry } from '../../utils/currencyLocale';

const BuyCoinsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const [packages, setPackages] = useState([]);
  const [iapProducts, setIapProducts] = useState([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (soft = false) => {
    if (!soft) setLoading(true);
    setError(null);
    try {
      if (isAuthenticated && user?.wiam_id) {
        try { await initIAP(user.wiam_id); } catch { /* ignore */ }
      }
      const currency = currencyForCountry(user?.country);
      const [pkgs, bal] = await Promise.all([
        coinsApi.getPackages(currency),
        isAuthenticated ? coinsApi.getBalance() : Promise.resolve({ balance: 0 }),
      ]);
      const list = pkgs?.packages || pkgs?.items || (Array.isArray(pkgs) ? pkgs : []);
      setPackages(list.map((p) => ({
        ...p,
        display_price: p.display_price
          || p.display?.display
          || (p.display?.symbol != null && p.display?.amount != null
            ? `${p.display.symbol}${p.display.amount}`
            : p.display_price),
      })));
      setBalance(bal?.balance ?? bal?.coins ?? 0);

      if (isIAPAvailable()) {
        try {
          const { coinProducts = [] } = await getProducts();
          setIapProducts(coinProducts);
        } catch {
          setIapProducts([]);
        }
      }
    } catch {
      setError('Could not load coin packs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, user?.wiam_id, user?.country]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const buyIap = async (product) => {
    if (!isAuthenticated) {
      navigation.navigate('LoginRequiredSheet', {
        title: 'Almost there',
        message: 'Create a free account so your coins stay in your wallet. Guests can browse packs — purchase credits need an account.',
        returnTo: 'BuyCoins',
      });
      return;
    }
    setBuying(product.identifier || product.productId);
    setError(null);
    try {
      const result = await purchaseCoinPack(product);
      if (result?.cancelled) return;
      if (result?.ok) {
        setBalance(result.balance ?? balance);
        Alert.alert('Coins added', `${result.coins_credited || ''} coins are in your wallet.`.trim());
        load(true);
      } else {
        setError(result?.error || 'Purchase failed');
      }
    } catch (e) {
      setError(e?.message || 'Purchase failed');
    } finally {
      setBuying(null);
    }
  };

  const catalog = iapProducts.length
    ? iapProducts.map((p) => {
      const meta = COIN_PRODUCTS[p.identifier] || COIN_PRODUCTS[p.productId] || {};
      return {
        id: p.identifier || p.productId,
        coins: meta.coins || p.coins,
        bonus: meta.bonus || 0,
        display_price: p.priceString || p.price,
        _iap: p,
        popular: meta.tier === 2,
      };
    })
    : packages.map((pkg, idx) => ({
      id: pkg.id,
      coins: pkg.coins ?? pkg.amount ?? pkg.coin_amount,
      bonus: pkg.bonus_coins || pkg.bonus || 0,
      display_price: pkg.display_price
        || (pkg.price_ghs ? `GHS ${pkg.price_ghs}` : null)
        || (pkg.price_usd ? `$${pkg.price_usd}` : null)
        || pkg.price
        || '—',
      popular: idx === 1 || pkg.is_popular || pkg.popular,
      _iap: null,
    }));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <ChevronLeft size={17} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.h1}>Buy Coins</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={COLORS.gold}
          />
        )}
      >
        <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceValue}>{isAuthenticated ? `${balance} Coins` : 'Guest'}</Text>
        </LinearGradient>

        {!isAuthenticated ? (
          <Text style={styles.guestHint}>
            Guests can buy coins. Create a free account at checkout so packs credit to your wallet.
          </Text>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {loading ? (
          <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.grid}>
            {catalog.map((pkg) => (
              <TouchableOpacity
                key={String(pkg.id)}
                style={[styles.pack, pkg.popular && styles.packPopular]}
                onPress={() => {
                  if (pkg._iap) buyIap(pkg._iap);
                  else if (!isAuthenticated) {
                    navigation.navigate('LoginRequiredSheet', {
                      title: 'Quick email signup to buy',
                      message: 'Guests can buy coins — a free account keeps them on your wallet. Then you return here to checkout.',
                      returnTo: 'BuyCoins',
                    });
                  } else {
                    Alert.alert(
                      'Packs loading',
                      Platform.OS === 'web'
                        ? 'Coin packs buy on the WiamEpisio website later — not in this app build.'
                        : 'Coin packs are not ready in this build yet. Try again after a production install.',
                    );
                  }
                }}
                disabled={buying === pkg.id}
                activeOpacity={0.85}
              >
                {pkg.popular ? <Text style={styles.popularBadge}>Most Popular</Text> : null}
                <Coins size={38} color={COLORS.gold} fill={COLORS.gold} style={{ marginBottom: 8 }} />
                <Text style={styles.amount}>{pkg.coins}</Text>
                <Text style={styles.bonus}>
                  {pkg.bonus ? `+${pkg.bonus} bonus` : ' '}
                </Text>
                <Text style={styles.price}>{pkg.display_price || '—'}</Text>
                {buying === pkg.id ? (
                  <ActivityIndicator color={COLORS.gold} style={{ marginTop: 6 }} />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!loading && !catalog.length ? (
          <Text style={styles.empty}>No coin packs available right now.</Text>
        ) : null}

        <Text style={styles.footer}>
          © 2026 WiamEpisio
        </Text>
        <Text style={styles.footerHelp}>Need help? support@wiamapp.com</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingBottom: 14,
  },
  back: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  h1: { fontSize: 17, fontFamily: FONTS.bold, color: '#fff' },
  balanceCard: {
    borderRadius: 22, padding: 20, marginBottom: 12, alignItems: 'center',
  },
  balanceLabel: { fontSize: 12, color: '#3A2E05', fontFamily: FONTS.regular, marginBottom: 4 },
  balanceValue: { fontSize: 28, fontFamily: FONTS.extraBold, color: COLORS.navy },
  guestHint: {
    fontSize: 12, color: COLORS.textFaint, fontFamily: FONTS.regular,
    marginBottom: 14, lineHeight: 17,
  },
  error: { color: '#EF4444', fontFamily: FONTS.medium, marginBottom: 12, fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 },
  pack: {
    width: '48%',
    borderRadius: 18,
    padding: 16,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1.5,
    borderColor: COLORS.navyLine,
    alignItems: 'center',
  },
  packPopular: { borderColor: COLORS.gold },
  popularBadge: {
    position: 'absolute', top: -9, alignSelf: 'center',
    backgroundColor: COLORS.gold, color: COLORS.navy,
    fontSize: 9, fontFamily: FONTS.bold, paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 999, overflow: 'hidden',
  },
  amount: { fontSize: 18, fontFamily: FONTS.extraBold, color: '#fff' },
  bonus: { fontSize: 10.5, color: COLORS.gold, fontFamily: FONTS.semi, marginTop: 2, marginBottom: 8 },
  price: { fontSize: 13, color: '#B8B8CC', fontFamily: FONTS.semi },
  empty: { textAlign: 'center', color: COLORS.textFaint, marginTop: 40, fontFamily: FONTS.medium },
  footer: {
    textAlign: 'center', fontSize: 10, color: '#3A3A56', paddingTop: 8, fontFamily: FONTS.regular,
  },
  footerHelp: {
    textAlign: 'center', fontSize: 10, color: '#3A3A56', paddingBottom: 8, marginTop: 4, fontFamily: FONTS.regular,
  },
});

export default BuyCoinsScreen;
