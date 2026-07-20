/**
 * Layout: WiamStudio-Soft-Interest.html
 * Data: readiness.soft_interest from series completeness
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Share,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import CONFIG from '../../constants/config';

const StudioSoftInterestScreen = () => {
  const navigation = useNavigation();
  const seriesId = useRoute().params?.seriesId;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!seriesId) return;
    setLoading(true);
    try {
      setData(await studioEpisioApi.completeness(seriesId));
    } finally {
      setLoading(false);
    }
  }, [seriesId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const soft = data?.soft_interest || {};
  const followers = soft.followers || 0;
  const reminds = soft.remind_count || 0;
  const combined = soft.combined || followers + reminds;
  const target = soft.target || soft.threshold || 200;
  const pct = Math.min(100, Math.round((combined / target) * 100));
  const need = Math.max(0, target - combined);
  const series = data?.series;
  const sources = soft.sources || {};

  return (
    <EpisioScreenShell
      title="Soft Interest"
      subtitle={series?.title || 'Series'}
      footer={(
        <>
          <EpisioGoldButton
            label="Share Teaser to Boost Interest"
            onPress={() => Share.share({
              message: `Coming soon on WiamEpisio: ${series?.title || 'my series'}\n${CONFIG.SITE_ORIGIN || 'https://episio.wiamlabs.com'}/series/${seriesId}`,
            }).catch(() => {})}
            variant="ghost"
          />
          <View style={{ height: 10 }} />
          {soft.soft_ok && series?.season_locked ? (
            <EpisioGoldButton
              label="Continue to Submit for Live"
              onPress={() => navigation.navigate('StudioSubmitForLive', { seriesId })}
            />
          ) : !series?.season_locked ? (
            <EpisioGoldButton
              label="Lock complete season first"
              onPress={() => navigation.navigate('StudioSeasonLock', { seriesId })}
            />
          ) : (
            <EpisioGoldButton
              label="Preview public teaser"
              onPress={() => navigation.navigate('StudioTeaserPreview', { seriesId })}
              variant="ghost"
            />
          )}
        </>
      )}
    >
      {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
        <>
          <View style={styles.ringCard}>
            <Text style={styles.ringBig}>{combined}</Text>
            <Text style={styles.ringOf}>OF {target}</Text>
            <View style={styles.miniBar}>
              <View style={[styles.miniFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.ringTitle}>{pct}% to launch-ready</Text>
            <Text style={styles.ringSub}>
              {soft.soft_ok
                ? 'Threshold met — you can submit for live'
                : `Need ${need} more followers or remind-me taps`}
            </Text>
          </View>

          <View style={styles.statGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Followers</Text>
              <Text style={styles.statValue}>{followers}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Remind Me Taps</Text>
              <Text style={styles.statValue}>{reminds}</Text>
            </View>
          </View>

          <View style={styles.thresholdCard}>
            <Text style={styles.thresholdTitle}>Why this matters</Text>
            <Text style={styles.thresholdText}>
              Series need{' '}
              <Text style={{ color: '#fff', fontFamily: FONTS.bold }}>50 followers or 200 combined remind-me + followers</Text>
              {' '}before Submit unlocks. Hard quality (full season + trailer) still comes first.
            </Text>
          </View>

          {(sources.teaser != null || sources.profile != null || sources.shared != null) ? (
            <View style={styles.sourcesCard}>
              <Text style={styles.sourcesTitle}>Interest sources</Text>
              {sources.teaser != null ? <Text style={styles.sourceLine}>Trailer teaser · {sources.teaser}</Text> : null}
              {sources.profile != null ? <Text style={styles.sourceLine}>Creator profile · {sources.profile}</Text> : null}
              {sources.shared != null ? <Text style={styles.sourceLine}>Shared links · {sources.shared}</Text> : null}
            </View>
          ) : null}
        </>
      )}
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  ringCard: {
    backgroundColor: COLORS.navyCard, borderRadius: 18, borderWidth: 1, borderColor: COLORS.navyLine,
    padding: 24, alignItems: 'center', marginBottom: 16,
  },
  ringBig: { fontSize: 36, fontFamily: FONTS.extraBold, color: COLORS.gold },
  ringOf: { fontSize: 11, color: COLORS.textFaint, fontFamily: FONTS.bold, marginTop: 2 },
  miniBar: {
    width: '70%', height: 6, borderRadius: 4, backgroundColor: COLORS.navySoft,
    overflow: 'hidden', marginTop: 12,
  },
  miniFill: { height: '100%', backgroundColor: COLORS.gold },
  ringTitle: { marginTop: 14, fontSize: 15, fontFamily: FONTS.extraBold, color: '#fff' },
  ringSub: { marginTop: 6, fontSize: 12, color: COLORS.textDim, textAlign: 'center', fontFamily: FONTS.regular },
  statGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: COLORS.navyCard, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.navyLine, padding: 14,
  },
  statLabel: { fontSize: 11, color: COLORS.textFaint, fontFamily: FONTS.semi },
  statValue: { marginTop: 6, fontSize: 22, fontFamily: FONTS.extraBold, color: '#fff' },
  thresholdCard: {
    backgroundColor: 'rgba(212,160,23,0.1)', borderWidth: 1, borderColor: 'rgba(212,160,23,0.28)',
    borderRadius: 16, padding: 16, marginBottom: 16,
  },
  thresholdTitle: { fontSize: 12.5, fontFamily: FONTS.extraBold, color: '#fff', marginBottom: 8 },
  thresholdText: { fontSize: 11.5, color: '#D9C89A', lineHeight: 18, fontFamily: FONTS.regular },
  sourcesCard: {
    backgroundColor: COLORS.navyCard, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  sourcesTitle: { fontFamily: FONTS.bold, color: '#fff', fontSize: 12.5, marginBottom: 8 },
  sourceLine: { fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 12, marginBottom: 4 },
});

export default StudioSoftInterestScreen;
