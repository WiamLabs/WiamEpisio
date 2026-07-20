/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import AppBackground from '../../components/AppBackground';
import walletApi from '../../api/wallet';
import { ChevronLeft, Wallet, History, Package, ShieldCheck, AlertTriangle, RotateCcw, Smartphone, Crown } from 'lucide-react-native';
import BrandedFooter from '../../components/BrandedFooter';
import useAuthStore from '../../store/useAuthStore';
import { isIAPAvailable, getProducts, purchaseCoinPack, restorePurchases } from '../../services/iap';
import { COIN_PRODUCTS } from '../../services/iapProducts';

const { width } = Dimensions.get('window');

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

const WalletScreen = ({ navigation }) => {
  const user = useAuthStore((s) => s.user);
  const isPremium = user?.premium_status === 'active' || user?.premium_status === 'trial';
  const [balance, setBalance] = useState(0);
  const [iapProducts, setIapProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accountFrozen, setAccountFrozen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [iapReady, setIapReady] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statusData, historyData] = await Promise.all([
        walletApi.getWalletStatus().catch(() => ({})),
        walletApi.getHistory().catch(() => ({ transactions: [] })),
      ]);
      setBalance(statusData.balance || 0);
      setAccountFrozen(statusData.account_frozen || false);
      setTransactions(historyData.transactions || []);

      // Load RevenueCat store products (the ONLY purchase method on mobile)
      if (isIAPAvailable()) {
        try {
          const { coinProducts = [] } = await getProducts();
          if (coinProducts.length > 0) {
            setIapProducts(coinProducts);
            setIapReady(true);
          }
        } catch (err) {
          console.warn('[Wallet] IAP products unavailable:', err);
        }
      }
    } catch (error) {
      console.error('Error fetching wallet data', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleBuyIAP = async (product) => {
    if (accountFrozen) {
      Alert.alert('Account Frozen', 'Your account is frozen. Contact support.');
      return;
    }
    setPurchasing(true);
    try {
      const result = await purchaseCoinPack(product);
      if (result.cancelled) {
        // User cancelled — do nothing
      } else if (result.ok) {
        setBalance(result.balance || balance);
        const credited = result.coins_credited || 0;
        if (credited > 0) {
          Alert.alert('Success', `${credited} coins added to your wallet!`);
        } else if (result.already_processed) {
          Alert.alert('Info', 'This purchase was already processed.');
        }
        fetchData();
      } else {
        Alert.alert('Error', result.error || 'Purchase failed. Try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Purchase failed. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestorePurchases = async () => {
    setRestoring(true);
    try {
      const result = await restorePurchases();
      if (result.ok) {
        Alert.alert('Restored', 'Your purchases have been restored successfully.');
        fetchData();
      } else {
        Alert.alert('Info', result.error || 'No previous purchases found.');
      }
    } catch (err) {
      Alert.alert('Error', 'Could not restore purchases. Try again later.');
    } finally {
      setRestoring(false);
    }
  };

  const handleRequestRefund = (tx) => {
    if (tx.dispute_status) {
      Alert.alert('Already Disputed', 'This transaction already has a dispute.');
      return;
    }
    Alert.alert(
      'Request Refund',
      `Request refund for ${Math.abs(tx.amount)} coins?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request',
          style: 'destructive',
          onPress: async () => {
            try {
              await walletApi.requestRefund(tx.id, 'User-initiated refund request');
              Alert.alert('Submitted', 'Your refund request has been submitted for review.');
              fetchData();
            } catch (err) {
              const msg = err.response?.data?.error || 'Could not submit refund.';
              Alert.alert('Error', msg);
            }
          },
        },
      ],
    );
  };

  const renderIAPProduct = ({ item }) => {
    const coinInfo = COIN_PRODUCTS[item.productId] || {};
    const bonusCoins = coinInfo.bonus || 0;

    return (
      <TouchableOpacity
        style={styles.packageCard}
        onPress={() => handleBuyIAP(item)}
        disabled={purchasing}
      >
        <View style={styles.packageHeader}>
          <Package size={20} color={COLORS.secondary} />
          {bonusCoins > 0 && (
            <View style={styles.bonusBadge}>
              <Text style={styles.bonusText}>+{bonusCoins} Bonus</Text>
            </View>
          )}
        </View>
        <Text style={styles.packageName}>{coinInfo.label || item.title}</Text>
        <View style={styles.packageCoinsContainer}>
          <Text style={styles.packageCoins}>{coinInfo.coins || '—'}</Text>
          <Text style={styles.packageCoinsLabel}>Wiam Coins</Text>
        </View>
        <Text style={styles.packagePrice}>{item.priceString}</Text>
        <View style={styles.storeBadge}>
          <Smartphone size={10} color={COLORS.secondary} />
          <Text style={styles.storeBadgeText}>
            {Platform.OS === 'ios' ? 'App Store' : 'Play Store'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTransaction = ({ item }) => {
    const canRefund = item.amount < 0 && ['unlock', 'tip'].includes(item.type) && !item.dispute_status;
    return (
      <TouchableOpacity
        style={styles.transactionItem}
        onLongPress={() => canRefund && handleRequestRefund(item)}
        delayLongPress={600}
        activeOpacity={canRefund ? 0.7 : 1}
      >
        <View style={[
          styles.transactionIcon,
          { backgroundColor: item.amount > 0 ? COLORS.success + '20' : COLORS.error + '20' }
        ]}>
          <History size={16} color={item.amount > 0 ? COLORS.success : COLORS.error} />
        </View>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionType}>{item.type.charAt(0).toUpperCase() + item.type.slice(1)}</Text>
          <Text style={styles.transactionDesc} numberOfLines={1}>{item.description}</Text>
          <Text style={styles.transactionDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
        <Text style={[
          styles.transactionAmount,
          { color: item.amount > 0 ? COLORS.success : COLORS.text }
        ]}>
          {item.amount > 0 ? '+' : ''}{item.amount}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.secondary} />
      </View>
    );
  }

  return (
    <AppBackground>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wiam Wallet</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.container}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.secondary} />}
      >
        {/* Frozen Account Warning */}
        {accountFrozen && (
          <View style={styles.frozenBanner}>
            <AlertTriangle size={18} color="#ff4444" />
            <Text style={styles.frozenText}>Your account is frozen. Purchases and spending are disabled. Contact support.</Text>
          </View>
        )}

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceInfo}>
            <Text style={styles.balanceLabel}>Your Balance</Text>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceValue}>{balance}</Text>
              <Text style={styles.coinSymbol}>Coins</Text>
            </View>
          </View>
          <View style={styles.balanceIconContainer}>
            <Wallet size={40} color={COLORS.secondary} />
          </View>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <ShieldCheck size={16} color={COLORS.secondary} />
          <Text style={styles.infoText}>Use coins to unlock premium chapters and support your favorite creators.</Text>
        </View>

        {/* Premium Nudge */}
        {!isPremium && (
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: 'rgba(192,132,252,0.08)', borderWidth: 1, borderColor: 'rgba(192,132,252,0.2)' }}
            onPress={() => navigation.navigate('PremiumScreen')}
            activeOpacity={0.7}
          >
            <Crown size={20} color="#c084fc" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#c084fc', fontWeight: '700', fontSize: 13 }}>Save with WiamPremium</Text>
              <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 2 }}>Get monthly credits to unlock chapters for free</Text>
            </View>
            <ChevronLeft size={16} color="#c084fc" style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
        )}

        {/* Buy Coins Section — RevenueCat IAP Only */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Get Wiam Coins</Text>
          {iapReady && iapProducts.length > 0 ? (
            <FlatList
              data={iapProducts}
              renderItem={renderIAPProduct}
              keyExtractor={item => item.productId}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.packageList}
            />
          ) : (
            <View style={styles.iapLoadingBox}>
              <ActivityIndicator size="small" color={COLORS.secondary} />
              <Text style={styles.iapLoadingText}>
                {isIAPAvailable() ? 'Loading store products...' : 'Store purchases will be available soon.'}
              </Text>
            </View>
          )}
          {/* Restore Purchases */}
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={handleRestorePurchases}
            disabled={restoring}
          >
            <RotateCcw size={14} color={COLORS.textSecondary} />
            <Text style={styles.restoreBtnText}>
              {restoring ? 'Restoring...' : 'Restore Purchases'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Transaction History */}
        <View style={[styles.section, styles.historySection]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Transaction History</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {transactions.length > 0 ? (
            transactions.map(item => (
              <React.Fragment key={item.id.toString()}>
                {renderTransaction({ item })}
              </React.Fragment>
            ))
          ) : (
            <View style={styles.emptyState}>
              <History size={40} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          )}
        </View>
        <View style={{ marginTop: 'auto', paddingTop: 24 }}>
          <BrandedFooter compact />
        </View>
      </ScrollView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  backButton: {
    padding: SPACING.sm,
  },
  balanceCard: {
    margin: SPACING.md,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  balanceInfo: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.secondary,
  },
  coinSymbol: {
    fontSize: 16,
    color: COLORS.textMuted,
    marginLeft: SPACING.sm,
  },
  balanceIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(212, 168, 67, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: 'rgba(212, 168, 67, 0.05)',
    borderRadius: RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 168, 67, 0.1)',
  },
  infoText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
    flex: 1,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  packageList: {
    paddingHorizontal: SPACING.md,
  },
  packageCard: {
    width: width * 0.35,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginRight: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: SPACING.md,
  },
  bonusBadge: {
    backgroundColor: COLORS.success,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bonusText: {
    fontSize: 8,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  packageName: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  packageCoinsContainer: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  packageCoins: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  packageCoinsLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  packagePrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.secondary,
  },
  historySection: {
    backgroundColor: COLORS.surface,
    paddingTop: SPACING.lg,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  seeAll: {
    fontSize: 14,
    color: COLORS.secondary,
    marginRight: SPACING.md,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  transactionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionType: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  transactionDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  transactionDate: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
  frozenBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  frozenText: {
    fontSize: 12,
    color: '#ff4444',
    marginLeft: SPACING.sm,
    flex: 1,
    fontWeight: '600',
  },
  iapLoadingBox: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.md,
  },
  iapLoadingText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    marginHorizontal: SPACING.md,
  },
  restoreBtnText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  storeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    opacity: 0.7,
  },
  storeBadgeText: {
    fontSize: 9,
    color: COLORS.secondary,
    marginLeft: 3,
  },
});

export default WalletScreen;
