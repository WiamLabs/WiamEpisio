import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import apiClient from '../../api/client';
import useAuthStore from '../../store/useAuthStore';

const DailyRewardsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiClient.get('/rewards/status');
      setStatus(data);
      setError(null);
    } catch {
      setError('Could not load rewards');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const claim = async () => {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const { data } = await apiClient.post('/rewards/daily');
      setMsg(data?.message || `Claimed ${data?.coins || data?.amount || ''} coins`);
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || 'Claim failed');
    } finally {
      setBusy(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.empty}>Sign in to claim daily rewards.</Text>
        <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.ctaText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingHorizontal: 20 }]}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <ChevronLeft size={20} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={styles.title}>Daily Rewards</Text>
      {loading ? <ActivityIndicator color={COLORS.gold} /> : (
        <>
          <Text style={styles.meta}>Streak: {status?.daily_streak ?? 0} days</Text>
          <Text style={styles.meta}>Base reward: {status?.daily_base_coins ?? 5} coins</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {msg ? <Text style={styles.ok}>{msg}</Text> : null}
          <TouchableOpacity
            style={[styles.cta, !status?.can_claim_daily && styles.ctaDisabled]}
            onPress={claim}
            disabled={busy || !status?.can_claim_daily}
          >
            {busy ? (
              <ActivityIndicator color={COLORS.navy} />
            ) : (
              <Text style={styles.ctaText}>
                {status?.can_claim_daily ? 'Claim today' : 'Already claimed today'}
              </Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  back: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 22, fontFamily: FONTS.extraBold, color: COLORS.text, marginBottom: 16 },
  meta: { color: COLORS.textDim, fontFamily: FONTS.medium, marginBottom: 8, fontSize: 14 },
  cta: { marginTop: 24, backgroundColor: COLORS.gold, borderRadius: 14, padding: 15, alignItems: 'center' },
  ctaDisabled: { opacity: 0.55 },
  ctaText: { fontFamily: FONTS.bold, color: COLORS.navy },
  error: { color: COLORS.error, marginTop: 12, fontFamily: FONTS.medium },
  ok: { color: COLORS.success, marginTop: 12, fontFamily: FONTS.medium },
  empty: { color: COLORS.textFaint, fontFamily: FONTS.medium, textAlign: 'center' },
});

export default DailyRewardsScreen;
