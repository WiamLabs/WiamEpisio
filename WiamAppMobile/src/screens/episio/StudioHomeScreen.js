import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ChevronLeft, Plus } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import useAuthStore from '../../store/useAuthStore';
import PosterCard from '../../components/episio/PosterCard';
import QualityRejectedBanner from '../../components/episio/QualityRejectedBanner';

const StudioHomeScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [apply, setApply] = useState(null);

  const patchUser = useAuthStore((s) => s.patchUser);

  const load = useCallback(async (soft = false) => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    if (!soft) setLoading(true);
    setError(null);
    try {
      try {
        const me = await (await import('../../api/auth')).default.me();
        if (me?.user) await patchUser(me.user);
        else if (me?.is_creator != null) await patchUser(me);
      } catch { /* keep cached user */ }
      const app = await studioEpisioApi.getApply().catch(() => null);
      setApply(app);
      const unlocked = !!(
        user?.is_creator
        || app?.is_creator
        || app?.studio_unlocked
        || app?.application?.status === 'accepted'
      );
      if (!unlocked) {
        setSeries([]);
        return;
      }
      const data = await studioEpisioApi.listSeries();
      setSeries(data?.series || []);
    } catch (e) {
      setError(e?.message || 'Studio locked — apply and wait for acceptance');
      setSeries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, user?.is_creator, patchUser]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!isAuthenticated) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.empty}>Sign in for WiamStudio.</Text>
        <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.ctaText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const locked = (() => {
    const status = (user?.status || apply?.user_status || '').toLowerCase();
    if (['banned', 'suspended', 'frozen'].includes(status)) return true;
    return !(
      user?.is_creator
      || apply?.is_creator
      || apply?.studio_unlocked
      || apply?.application?.status === 'accepted'
    );
  })();

  const lockReason = (() => {
    const status = (user?.status || '').toLowerCase();
    if (['banned', 'suspended', 'frozen'].includes(status)) {
      return {
        title: 'Studio locked',
        sub: 'Your creator access is suspended. Contact support@wiamapp.com if you think this is a mistake.',
        showApply: false,
      };
    }
    if (apply?.application?.status === 'pending') {
      return {
        title: 'Application pending review',
        sub: apply?.application?.reviewer_note || 'High quality only. Complete series + trailer QA before public live.',
        showApply: false,
      };
    }
    if (apply?.application?.status === 'rejected') {
      return {
        title: 'Application rejected — re-apply after fixing notes',
        sub: apply?.application?.reviewer_note || 'High quality only. Complete series + trailer QA before public live.',
        showApply: true,
      };
    }
    return {
      title: 'Apply before uploading',
      sub: apply?.application?.reviewer_note || 'High quality only. Complete series + trailer QA before public live.',
      showApply: true,
    };
  })();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.top}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <ChevronLeft size={20} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>WiamStudio</Text>
          <Text style={styles.brandSub}>
            {locked ? 'Apply to create' : `${series.length} series · Build complete stories`}
          </Text>
        </View>
        {!locked ? (
          <TouchableOpacity style={styles.plus} onPress={() => navigation.navigate('StudioSeriesCreate')}>
            <Plus size={18} color={COLORS.navy} />
          </TouchableOpacity>
        ) : <View style={{ width: 36 }} />}
      </View>

      {!locked ? (
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>
            {series.filter((s) => s.pipeline_state === 'live').length
              ? `${series.filter((s) => s.pipeline_state === 'live').length} live · keep building`
              : series.length
                ? `${series.filter((s) => !['live', 'published'].includes(s.pipeline_state)).length || series.length} series in progress`
                : 'Start your first series'}
          </Text>
          <Text style={styles.statusSub}>Complete seasons only. Trailer + every episode must pass before publish.</Text>
        </View>
      ) : null}

      <TouchableOpacity onPress={() => navigation.navigate('StudioSpecs')}>
        <Text style={styles.specsLink}>Video specs: 9:16 · 1080×1920 · 4–5 min →</Text>
      </TouchableOpacity>
      {!locked ? (
        <View style={styles.quickLinks}>
          <TouchableOpacity onPress={() => navigation.navigate('StudioSettings')}>
            <Text style={styles.specsLink}>Studio settings →</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('CreatorTrustTier')}>
            <Text style={styles.specsLink}>Trust tier →</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {locked ? (
        <View style={styles.lockBox}>
          <Text style={styles.lockTitle}>{lockReason.title}</Text>
          <Text style={styles.lockSub}>{lockReason.sub}</Text>
          {apply?.application?.status === 'rejected' ? (
            <TouchableOpacity
              style={styles.ctaAlt}
              onPress={() => navigation.navigate('CreatorApplyRejected', {
                reviewerNote: apply?.application?.reviewer_note,
              })}
            >
              <Text style={styles.ctaAltText}>Read team note</Text>
            </TouchableOpacity>
          ) : null}
          {lockReason.showApply ? (
            <TouchableOpacity
              style={styles.cta}
              onPress={() => navigation.navigate(apply?.invite_only ? 'CreatorApplyInviteOnly' : 'CreatorApply')}
            >
              <Text style={styles.ctaText}>
                {apply?.application?.status === 'rejected' ? 'Re-apply' : 'Start application'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 30 }} /> : (
        <FlatList
          data={series}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={COLORS.gold} />
          }
          ListEmptyComponent={!locked ? <Text style={styles.empty}>No series yet. Tap + to create.</Text> : null}
          ListHeaderComponent={(
            series.some((s) => s.pipeline_state === 'needs_changes' || s.failed_episodes > 0) ? (
              <QualityRejectedBanner
                title="Quality issues need attention"
                subtitle="Open the series flagged below and fix rejected assets before resubmit."
                onPress={() => {
                  const hit = series.find((s) => s.pipeline_state === 'needs_changes' || s.failed_episodes > 0);
                  if (!hit) return;
                  navigation.navigate(
                    hit.pipeline_state === 'needs_changes' ? 'StudioNeedsChanges' : 'StudioEpisodeList',
                    { seriesId: hit.id },
                  );
                }}
              />
            ) : null
          )}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => {
                const state = item.pipeline_state;
                if (state === 'in_review') {
                  navigation.navigate('StudioSubmitPending', { seriesId: item.id });
                } else if (state === 'needs_changes') {
                  navigation.navigate('StudioNeedsChanges', { seriesId: item.id });
                } else if (state === 'live') {
                  navigation.navigate('StudioDashboard', { seriesId: item.id });
                } else {
                  navigation.navigate('StudioSeriesDetail', { seriesId: item.id });
                }
              }}
            >
              <PosterCard
                title=""
                posterUrl={item.poster_url || item.cover_url}
                width={64}
                height={90}
                onPress={() => navigation.navigate('StudioSeriesDetail', { seriesId: item.id })}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowMeta}>
                  {item.ready_episodes || 0}/{item.planned_episode_count || 0} ready · Trailer {item.trailer_qa_status || '—'}
                </Text>
                <View style={styles.flagRow}>
                  <Text style={[
                    styles.flag,
                    item.pipeline_state === 'live' && styles.flagLive,
                    item.pipeline_state === 'needs_changes' && styles.flagWarn,
                    item.pipeline_state === 'in_review' && styles.flagReview,
                  ]}
                  >
                    {(item.pipeline_state || item.review_status || item.status || 'building').replace(/_/g, ' ').toUpperCase()}
                  </Text>
                  {item.season_locked ? <Text style={styles.flagMuted}>LOCKED</Text> : null}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8, gap: 10 },
  back: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.text },
  brandSub: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textFaint, marginTop: 2 },
  plus: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  statusCard: {
    marginHorizontal: 20, marginBottom: 10, padding: 14, borderRadius: 14,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  statusTitle: { fontFamily: FONTS.bold, color: '#fff', fontSize: 13.5 },
  statusSub: { marginTop: 4, fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 11.5, lineHeight: 16 },
  quickLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  specsLink: { color: COLORS.gold, fontFamily: FONTS.semi, fontSize: 12.5, paddingHorizontal: 20, marginBottom: 8 },
  lockBox: {
    marginHorizontal: 20, marginBottom: 16, padding: 16, borderRadius: 14,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  lockTitle: { fontFamily: FONTS.bold, color: COLORS.text, fontSize: 15 },
  lockSub: { marginTop: 8, color: COLORS.textDim, fontFamily: FONTS.regular, lineHeight: 19 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  rowTitle: { fontFamily: FONTS.semi, color: COLORS.text, fontSize: 14 },
  rowMeta: { marginTop: 4, color: COLORS.textFaint, fontSize: 11.5, fontFamily: FONTS.regular },
  flagRow: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  flag: {
    fontSize: 9, fontFamily: FONTS.extraBold, color: COLORS.gold,
    backgroundColor: 'rgba(212,160,23,0.14)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, overflow: 'hidden',
  },
  flagLive: { color: '#fff', backgroundColor: '#E4573D' },
  flagWarn: { color: '#E0A79A', backgroundColor: 'rgba(228,87,61,0.16)' },
  flagReview: { color: COLORS.gold, backgroundColor: 'rgba(212,160,23,0.2)' },
  flagMuted: {
    fontSize: 9, fontFamily: FONTS.extraBold, color: COLORS.textFaint,
    backgroundColor: COLORS.navySoft, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, overflow: 'hidden',
  },
  empty: { textAlign: 'center', color: COLORS.textFaint, marginTop: 30, fontFamily: FONTS.medium },
  error: { color: COLORS.error, paddingHorizontal: 20, fontFamily: FONTS.medium, marginBottom: 8 },
  cta: { marginTop: 14, backgroundColor: COLORS.gold, borderRadius: 12, padding: 13, alignItems: 'center' },
  ctaText: { fontFamily: FONTS.bold, color: COLORS.navy },
  ctaAlt: {
    marginTop: 10, backgroundColor: COLORS.navySoft, borderRadius: 12, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.navyLine,
  },
  ctaAltText: { fontFamily: FONTS.semi, color: COLORS.gold, fontSize: 13 },
});

export default StudioHomeScreen;
