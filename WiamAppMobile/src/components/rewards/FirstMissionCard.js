import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Target, CheckCircle, Circle } from 'lucide-react-native';
import walletApi from '../../api/wallet';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

/**
 * First mission (+10 coins): read ≥1 chapter (book_view) + follow ≥1 creator.
 * Hidden after reward is claimed. Refreshes when the hosting screen gains focus.
 */
const FirstMissionCard = ({ navigation, onClaimed, style: styleProp }) => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await walletApi.getFirstMissionStatus();
      setStatus(s);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().catch(() => {});
    }, [load])
  );

  if (loading && !status) {
    return (
      <View style={[styles.card, styleProp]}>
        <ActivityIndicator color={COLORS.secondary} />
      </View>
    );
  }

  if (!status || status.claimed) return null;

  const readDone = !!status.has_read_chapter;
  const followDone = !!status.has_followed_creator;
  const canClaim = !!status.eligible;
  const rewardCoins = Number(status.reward_coins) || 10;

  const goBrowse = () => {
    try {
      navigation.navigate('Browse');
    } catch {
      navigation.getParent?.()?.navigate?.('Browse');
    }
  };

  const onClaim = async () => {
    setClaiming(true);
    try {
      const r = await walletApi.claimFirstMissionReward();
      if (r?.ok) {
        Alert.alert('Mission complete', `You earned ${r.coins || rewardCoins} coins.`);
        await load();
        onClaimed?.();
      } else {
        Alert.alert('Almost there', r?.error || 'Complete both steps, then try again.');
      }
    } catch (e) {
      Alert.alert('Could not claim', typeof e === 'string' ? e : 'Please try again.');
    } finally {
      setClaiming(false);
    }
  };

  const Row = ({ done, label }) => (
    <View style={styles.row}>
      {done ? (
        <CheckCircle size={18} color="#22c55e" />
      ) : (
        <Circle size={18} color={COLORS.textMuted} />
      )}
      <Text style={[styles.rowText, done && styles.rowTextDone]}>{label}</Text>
    </View>
  );

  return (
    <View style={[styles.card, styleProp]}>
      <View style={styles.head}>
        <View style={styles.iconWrap}>
          <Target size={20} color={COLORS.secondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>First mission</Text>
          <Text style={styles.sub}>Earn {rewardCoins} coins once — read a chapter & follow a creator.</Text>
        </View>
      </View>

      <Row done={readDone} label="Read at least one chapter" />
      <Row done={followDone} label="Follow at least one creator" />

      {!readDone || !followDone ? (
        <TouchableOpacity style={styles.linkRow} onPress={goBrowse}>
          <Text style={styles.linkText}>Discover stories in Browse →</Text>
        </TouchableOpacity>
      ) : null}

      {canClaim ? (
        <TouchableOpacity
          style={[styles.claimBtn, claiming && styles.claimBtnDisabled]}
          onPress={onClaim}
          disabled={claiming}
        >
          {claiming ? (
            <ActivityIndicator color={COLORS.black} />
          ) : (
            <Text style={styles.claimBtnText}>Claim {rewardCoins} coins</Text>
          )}
        </TouchableOpacity>
      ) : (
        !readDone || !followDone ? (
          <Text style={styles.hint}>Finish both steps to unlock the reward.</Text>
        ) : null
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.2)',
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(212,168,67,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  sub: { fontSize: 12, color: COLORS.textMuted, marginTop: 4, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  rowText: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  rowTextDone: { color: COLORS.text },
  linkRow: { marginTop: 4, marginBottom: 8 },
  linkText: { fontSize: 12, color: COLORS.secondary, fontWeight: '600' },
  hint: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  claimBtn: {
    marginTop: 8,
    backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.full,
    paddingVertical: 12,
    alignItems: 'center',
  },
  claimBtnDisabled: { opacity: 0.6 },
  claimBtnText: { color: COLORS.black, fontWeight: '700', fontSize: 14 },
});

export default FirstMissionCard;
