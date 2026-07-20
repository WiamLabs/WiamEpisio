/**
 * Layout: WiamStudio-Completeness-Gate.html
 * Data: GET /creator/studio/series/:id/completeness — full season gates
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Check, X } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';

const fixRoute = (gate, seriesId) => {
  const f = gate?.fix;
  if (f === 'lock') return { name: 'StudioSeasonLock', params: { seriesId } };
  if (f === 'soft_interest') return { name: 'StudioSoftInterest', params: { seriesId } };
  if (f === 'trailer' || gate?.key === 'trailer') return { name: 'StudioTrailer', params: { seriesId } };
  if (f === 'cover' || gate?.key === 'cover') return { name: 'StudioCover', params: { seriesId } };
  if (f === 'episodes' || gate?.key === 'episodes' || gate?.key === 'all_episodes') {
    return { name: 'StudioEpisodeList', params: { seriesId } };
  }
  if (f === 'banner') return { name: 'StudioBanner', params: { seriesId } };
  if (f === 'rights' || f === 'metadata') return { name: 'StudioSeriesDetail', params: { seriesId } };
  return { name: 'StudioSeriesDetail', params: { seriesId } };
};

const StudioCompletenessScreen = () => {
  const navigation = useNavigation();
  const seriesId = useRoute().params?.seriesId;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!seriesId) return;
    setLoading(true);
    try {
      setData(await studioEpisioApi.completeness(seriesId));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [seriesId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const gates = data?.gates || [];
  const green = data?.gates_green || 0;
  const total = data?.gates_total || gates.length || 1;
  const canSubmit = !!data?.can_submit;
  const canLock = !!data?.can_lock;
  const series = data?.series;
  const unit = series?.unit_label || (series?.structure_mode === 'season' ? 'season' : 'series');
  const unitCap = unit.charAt(0).toUpperCase() + unit.slice(1);
  const blocked = gates.find((g) => !g.ok);
  const blockedCount = gates.filter((g) => !g.ok).length;
  const ringPct = total ? Math.min(100, (green / total) * 100) : 0;

  const onFix = (gate) => {
    if (!gate || gate.ok) return;
    if (gate.key === 'rights' || gate.fix === 'rights') {
      Alert.alert(
        'Confirm rights',
        'Confirm you own or have licensed all content before lock. Open your series hub to confirm rights.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open hub',
            onPress: () => navigation.navigate('StudioSeriesDetail', { seriesId }),
          },
        ],
      );
      return;
    }
    const r = fixRoute(gate, seriesId);
    navigation.navigate(r.name, r.params);
  };

  const primary = () => {
    if (canSubmit) navigation.navigate('StudioSubmitForLive', { seriesId });
    else if (canLock) navigation.navigate('StudioSeasonLock', { seriesId });
    else if (blocked) onFix(blocked);
    else navigation.navigate('StudioSeriesDetail', { seriesId });
  };

  const ctaLabel = canSubmit
    ? 'Submit for Live'
    : canLock
      ? `Lock complete ${unit}`
      : 'Fix blocking items';

  return (
    <EpisioScreenShell
      title="Completeness Check"
      subtitle={series?.title || unitCap}
      footer={(
        <>
          <EpisioGoldButton
            label={ctaLabel}
            onPress={primary}
            disabled={!canSubmit && !canLock && !blocked}
            variant={canSubmit || canLock ? 'gold' : 'ghost'}
          />
          <Text style={styles.note}>
            {canSubmit
              ? 'All gates green — unlock Submit for Live'
              : blocked
                ? `Fix: ${blocked.title || blocked.detail || 'blocking item'} to unlock Submit`
                : 'Upload a trailer and finish every planned episode to unlock Submit'}
          </Text>
        </>
      )}
    >
      {loading ? (
        <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} />
      ) : (
        <>
          <View style={styles.ringCard}>
            <View style={styles.ringOuter}>
              <View style={[styles.ringTrack, { borderColor: COLORS.navyLine }]} />
              <View
                style={[
                  styles.ringFill,
                  {
                    borderTopColor: ringPct > 12 ? COLORS.gold : 'transparent',
                    borderRightColor: ringPct > 37 ? COLORS.gold : 'transparent',
                    borderBottomColor: ringPct > 62 ? COLORS.gold : 'transparent',
                    borderLeftColor: ringPct > 87 ? COLORS.gold : 'transparent',
                  },
                ]}
              />
              <View style={styles.ringInner}>
                <Text style={styles.ringBig}>{green}/{total}</Text>
                <Text style={styles.ringLabel}>GATES GREEN</Text>
              </View>
            </View>
            <Text style={styles.ringTitle}>
              {canSubmit ? 'Ready to submit' : blocked ? 'Almost ready' : 'Keep building'}
            </Text>
            <Text style={styles.ringSub}>
              {canSubmit
                ? 'All hard gates green — submit for system QC + founder publish'
                : blockedCount === 1
                  ? '1 item is blocking Submit — fix it below'
                  : blockedCount > 1
                    ? `${blockedCount} items are blocking Submit — fix them below`
                    : 'Finish every planned episode, trailer, cover, and lock'}
            </Text>
          </View>

          {gates.map((g) => (
            <TouchableOpacity
              key={g.key || g.title}
              style={[styles.gateItem, !g.ok && styles.gateBlocked]}
              onPress={() => onFix(g)}
              disabled={g.ok}
              activeOpacity={0.85}
            >
              <View style={[styles.gateIcon, g.ok ? styles.ok : styles.bad]}>
                {g.ok ? <Check size={17} color="#fff" /> : <X size={17} color="#fff" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.gateTitle}>{g.title}</Text>
                <Text style={[styles.gateSub, !g.ok && styles.gateSubBad]}>{g.detail}</Text>
              </View>
              {!g.ok ? <Text style={styles.fix}>Fix →</Text> : null}
            </TouchableOpacity>
          ))}
        </>
      )}
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  ringCard: {
    backgroundColor: COLORS.navyCard, borderRadius: 18, borderWidth: 1, borderColor: COLORS.navyLine,
    padding: 22, alignItems: 'center', marginBottom: 18,
  },
  ringOuter: {
    width: 112, height: 112, alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  ringTrack: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 56, borderWidth: 8,
  },
  ringFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 56, borderWidth: 8, borderColor: 'transparent',
    transform: [{ rotate: '-45deg' }],
  },
  ringInner: { alignItems: 'center', justifyContent: 'center' },
  ringBig: { fontSize: 28, fontFamily: FONTS.extraBold, color: COLORS.gold },
  ringLabel: { fontSize: 9, color: COLORS.textFaint, fontFamily: FONTS.bold, letterSpacing: 1, marginTop: 2 },
  ringTitle: { fontSize: 16, fontFamily: FONTS.extraBold, color: '#fff' },
  ringSub: {
    marginTop: 6, fontSize: 12, color: COLORS.textDim, textAlign: 'center',
    lineHeight: 18, fontFamily: FONTS.regular, maxWidth: 280,
  },
  gateItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine, marginBottom: 10,
  },
  gateBlocked: {
    borderColor: 'rgba(228,87,61,0.45)',
    backgroundColor: 'rgba(228,87,61,0.08)',
  },
  gateIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  ok: { backgroundColor: '#3BB273' },
  bad: { backgroundColor: '#E4573D' },
  gateTitle: { fontSize: 13, fontFamily: FONTS.bold, color: '#fff' },
  gateSub: { marginTop: 3, fontSize: 11.5, color: COLORS.textDim, fontFamily: FONTS.regular },
  gateSubBad: { color: '#E0A79A' },
  fix: { color: COLORS.gold, fontFamily: FONTS.bold, fontSize: 12 },
  note: {
    textAlign: 'center', color: COLORS.textFaint, fontSize: 11,
    fontFamily: FONTS.regular, lineHeight: 16, marginTop: 10,
  },
});

export default StudioCompletenessScreen;
