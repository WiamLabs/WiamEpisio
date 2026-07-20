/**
 * Exact layout: WiamEpisio-Buy-Coins.html
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Linking, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ChevronLeft, Coins } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../constants/theme';
import coinsApi from '../../api/coins';
import useAuthStore from '../../store/useAuthStore';

const BuyCoinsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [packages, setPackages] = useState([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const pendingRef = useRef(null);

  const load = useCallback(async (soft = false) => {
    if (!soft) setLoading(true);
    setError(null);
    try {
      if (pendingRef.current && isAuthenticated) {
        const ref = pendingRef.current;
        pendingRef.current = null;
        try {
          await coinsApi.verify(ref);
          Alert.alert('Coins added', 'Your purchase was confirmed.');
        } catch { /* user may still be mid-checkout */ }
      }
      const [pkgs, bal] = await Promise.all([
        coinsApi.getPackages(),
        isAuthenticated ? coinsApi.getBalance() : Promise.resolve({ balance: 0 }),
      ]);
      setPackages(pkgs?.packages || pkgs?.items || (Array.isArray(pkgs) ? pkgs : []));
      setBalance(bal?.balance ?? bal?.coins ?? 0);
    } catch {
      setError('Could not load coin packs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!isAuthenticated) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
            <ChevronLeft size={17} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.h1}>Buy Coins</Text>
        </View>
        <View style={styles.gate}>
          <Text style={styles.gateTitle}>Sign in to buy coins</Text>
          <Text style={styles.gateSub}>Wallet actions need an account.</Text>
          <TouchableOpacity style={styles.gateBtn} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.gateBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const buy = async (pkg) => {
    setBuying(pkg.id);
    try {
      const data = await coinsApi.buyCoins(pkg.id);
      const url = data?.authorization_url || data?.checkout_url || data?.url;
      if (data?.reference) pendingRef.current = data.reference;
      if (url) {
        await Linking.openURL(url);
        Alert.alert('Complete payment', 'After paying, return to this screen — we will confirm your coins.');
      } else setError(data?.error || 'Checkout unavailable');
    } catch {
      setError('Purchase failed to start');
    } finally {
      setBuying(null);
    }
  };

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={COLORS.gold}
          />
        }
      >
        <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceValue}>{balance} Coins</Text>
        </LinearGradient>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {loading ? (
          <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.grid}>
            {packages.map((pkg, idx) => {
              const popular = idx === 1 || pkg.is_popular || pkg.popular;
              return (
                <TouchableOpacity
                  key={pkg.id}
                  style={[styles.pack, popular && styles.packPopular]}
                  onPress={() => buy(pkg)}
                  disabled={buying === pkg.id}
                  activeOpacity={0.85}
                >
                  {popular ? <Text style={styles.popularBadge}>Most Popular</Text> : null}
                  <Coins size={38} color={COLORS.gold} fill={COLORS.gold} style={{ marginBottom: 8 }} />
                  <Text style={styles.amount}>{pkg.coins ?? pkg.amount ?? pkg.coin_amount}</Text>
                  <Text style={styles.bonus}>
                    {(pkg.bonus_coins || pkg.bonus)
                      ? `+${pkg.bonus_coins || pkg.bonus} bonus`
                      : ' '}
                  </Text>
                  <Text style={styles.price}>
                    {pkg.display_price
                      || (pkg.price_ghs ? `GHS ${pkg.price_ghs}` : null)
                      || (pkg.price_usd ? `$${pkg.price_usd}` : null)
                      || pkg.price
                      || '—'}
                  </Text>
                  {buying === pkg.id ? (
                    <ActivityIndicator color={COLORS.gold} style={{ marginTop: 6 }} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {!loading && !packages.length ? (
          <Text style={styles.empty}>No coin packs available right now.</Text>
        ) : null}

        <Text style={styles.footer}>
          © 2026 WiamEpisio · Powered by WiamLabs · Billed via App Store/Google Play
        </Text>
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
    borderRadius: 22, padding: 20, marginBottom: 20, alignItems: 'center',
  },
  balanceLabel: { fontSize: 12, color: '#3A2E05', fontFamily: FONTS.regular, marginBottom: 4 },
  balanceValue: { fontSize: 28, fontFamily: FONTS.extraBold, color: COLORS.navy },
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
    textAlign: 'center', fontSize: 10, color: '#3A3A56', paddingVertical: 8, fontFamily: FONTS.regular,
  },
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  gateTitle: { fontSize: 17, fontFamily: FONTS.bold, color: '#fff', marginBottom: 8 },
  gateSub: { fontSize: 13, color: COLORS.textFaint, marginBottom: 20, textAlign: 'center' },
  gateBtn: {
    backgroundColor: COLORS.gold, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14,
  },
  gateBtnText: { fontFamily: FONTS.bold, color: COLORS.navy, fontSize: 14 },
});

export default BuyCoinsScreen;
