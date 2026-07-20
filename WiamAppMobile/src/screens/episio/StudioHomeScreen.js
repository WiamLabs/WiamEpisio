/**
 * WiamStudio-Home.html — creator mood home: brand, earnings pill, series cards, checklist, tools.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  Plus, PenLine, Check, X, Info, BarChart3, Wallet, Settings, FileVideo,
  Shield, HelpCircle, Eye,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import useAuthStore from '../../store/useAuthStore';
import useAppModeStore from '../../store/useAppModeStore';
import resolveUrl from '../../utils/resolveUrl';
import QualityRejectedBanner from '../../components/episio/QualityRejectedBanner';

function statusTag(item) {
  const state = (item.pipeline_state || item.review_status || item.status || 'draft').toLowerCase();
  if (state === 'live' || state === 'published') return { label: 'LIVE', kind: 'live' };
  if (state === 'in_review' || state === 'review') return { label: 'READY FOR REVIEW', kind: 'review' };
  if (state === 'needs_changes') return { label: 'NEEDS CHANGES', kind: 'changes' };
  return { label: 'DRAFT', kind: 'draft' };
}

function SeriesCard({ item, onPress }) {
  const tag = statusTag(item);
  const planned = item.planned_episode_count || 0;
  const ready = item.ready_episodes || item.uploaded_episodes || 0;
  const pct = planned > 0 ? Math.min(100, Math.round((ready / planned) * 100)) : 0;
  const cover = resolveUrl(item.poster_url || item.cover_url);
  const trailerOk = ['pass', 'passed', 'approved', 'ok'].includes(
    String(item.trailer_qa_status || '').toLowerCase(),
  );
  const hasCover = !!(item.cover_url || item.poster_url);

  return (
    <TouchableOpacity style={styles.seriesCard} onPress={onPress} activeOpacity={0.8}>
      {cover ? (
        <Image source={{ uri: cover }} style={styles.poster} />
      ) : (
        <LinearGradient colors={['#3a1420', '#12122a']} style={styles.poster} />
      )}
      <View style={styles.seriesBody}>
        <View style={styles.seriesTop}>
          <Text style={styles.seriesTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={[
            styles.tag,
            tag.kind === 'live' && styles.tagLive,
            tag.kind === 'review' && styles.tagReview,
            tag.kind === 'changes' && styles.tagChanges,
            tag.kind === 'draft' && styles.tagDraft,
          ]}
          >
            {tag.label}
          </Text>
        </View>
        <Text style={styles.progressLine}>
          <Text style={styles.progressBold}>{ready}</Text>
          {` of ${planned || '—'} episodes uploaded`}
        </Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
        <View style={styles.flagRow}>
          <Flag ok={trailerOk} warn={!trailerOk} label={trailerOk ? 'Trailer Pass' : 'Trailer Missing'} />
          <Flag ok={hasCover} warn={!hasCover} label={hasCover ? 'Cover Set' : 'Cover Missing'} />
          {item.follower_count != null ? (
            <Flag pending label={`${item.follower_count} Followers`} />
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function Flag({ ok, warn, pending, label }) {
  return (
    <View style={[
      styles.flag,
      ok && styles.flagOk,
      warn && styles.flagWarn,
      pending && styles.flagPending,
    ]}
    >
      {ok ? <Check size={9} color="#3BB273" /> : null}
      {warn ? <X size={9} color="#E4573D" /> : null}
      <Text style={[
        styles.flagText,
        ok && { color: '#3BB273' },
        warn && { color: '#E4573D' },
        pending && { color: COLORS.textFaint },
      ]}
      >
        {label}
      </Text>
    </View>
  );
}

function ToolChip({ icon: Icon, label, onPress }) {
  return (
    <TouchableOpacity style={styles.toolChip} onPress={onPress} activeOpacity={0.75}>
      <Icon size={15} color={COLORS.gold} />
      <Text style={styles.toolLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const StudioHomeScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const patchUser = useAuthStore((s) => s.patchUser);
  const mode = useAppModeStore((s) => s.mode);
  const setMode = useAppModeStore((s) => s.setMode);
  const inCreatorMood = mode === 'creator';

  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [apply, setApply] = useState(null);
  const [earningsPending, setEarningsPending] = useState(null);

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
      } catch { /* keep */ }
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
      const list = data?.series || [];
      setSeries(list);
      const pending = list.reduce((sum, s) => {
        const n = s?.stats?.earnings_pending ?? s?.earnings_pending ?? 0;
        return sum + (Number(n) || 0);
      }, 0);
      setEarningsPending(pending);
    } catch (e) {
      setError(e?.message || 'Could not load studio');
      setSeries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, user?.is_creator, patchUser]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const unlocked = (() => {
    const status = (user?.status || '').toLowerCase();
    if (['banned', 'suspended', 'frozen'].includes(status)) return false;
    return !!(
      user?.is_creator
      || apply?.is_creator
      || apply?.studio_unlocked
      || apply?.application?.status === 'accepted'
    );
  })();

  const channel = user?.channel_name || user?.creator_name || user?.display_name || 'Creator';
  const inProgress = series.filter((s) => !['live', 'published'].includes(s.pipeline_state));
  const needsFix = series.filter((s) => s.pipeline_state === 'needs_changes' || s.failed_episodes > 0);

  const openSeries = (item) => {
    const state = item.pipeline_state;
    if (state === 'in_review') navigation.navigate('StudioSubmitPending', { seriesId: item.id });
    else if (state === 'needs_changes') navigation.navigate('StudioNeedsChanges', { seriesId: item.id });
    else if (state === 'live') navigation.navigate('StudioDashboard', { seriesId: item.id });
    else navigation.navigate('StudioSeriesDetail', { seriesId: item.id });
  };

  const switchToWatcher = async () => {
    await setMode('watcher');
    navigation.navigate('CreatorViewerSwitch', {
      target: 'Main',
      direction: 'watcher',
      studioName: channel,
    });
  };

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

  return (
    <View style={[styles.root, { paddingTop: insets.top + 4 }]}>
      <View style={styles.topfixed}>
        <View style={styles.brandRow}>
          <View style={styles.brand}>
            <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.logoBadge}>
              <Text style={styles.logoW}>W</Text>
            </LinearGradient>
            <View>
              <Text style={styles.brandName}>
                Wiam<Text style={{ color: COLORS.gold }}>Studio</Text>
              </Text>
              <Text style={styles.brandTag}>{String(channel).toUpperCase()}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.earnPill} onPress={() => navigation.navigate('StudioEarnings')}>
            <View style={styles.earnDot} />
            <View>
              <Text style={styles.earnAmt}>
                {earningsPending != null ? `₵${Number(earningsPending).toFixed(0)}` : '₵—'}
              </Text>
              <Text style={styles.earnSmall}>pending</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28 }}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={COLORS.gold}
          />
        )}
      >
        {!inCreatorMood ? (
          <TouchableOpacity style={styles.backWatcher} onPress={switchToWatcher}>
            <Eye size={14} color={COLORS.gold} />
            <Text style={styles.backWatcherText}>Switch to Watcher Mood</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.backWatcher} onPress={switchToWatcher}>
            <Eye size={14} color={COLORS.gold} />
            <Text style={styles.backWatcherText}>Switch to Watcher Mood</Text>
          </TouchableOpacity>
        )}

        {!unlocked ? (
          <View style={styles.lockBox}>
            <Text style={styles.lockTitle}>Studio locked</Text>
            <Text style={styles.lockSub}>
              Finish creator approval (or redeem an invite) to upload series.
            </Text>
            <TouchableOpacity
              style={styles.cta}
              onPress={() => navigation.navigate(
                apply?.invite_only ? 'CreatorApplyInviteOnly' : 'CreatorApply',
              )}
            >
              <Text style={styles.ctaText}>Open application</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.statusCard}>
              <View style={styles.statusIcon}>
                <PenLine size={18} color={COLORS.navy} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statusTitle}>
                  {needsFix.length
                    ? `${needsFix.length} series need fixes`
                    : inProgress.length
                      ? `${inProgress.length} series in progress`
                      : series.length
                        ? `${series.length} series · keep building`
                        : 'Start your first series'}
                </Text>
                <Text style={styles.statusSub}>
                  Complete seasons only. Trailer + every episode must pass before publish.
                </Text>
              </View>
            </View>

            {needsFix.length ? (
              <QualityRejectedBanner
                title="Quality issues need attention"
                subtitle="Open the series flagged below and fix rejected assets before resubmit."
                onPress={() => openSeries(needsFix[0])}
              />
            ) : null}

            <View style={styles.sectionHead}>
              <Text style={styles.sectionH2}>My Series</Text>
              <TouchableOpacity
                style={styles.newSeriesBtn}
                onPress={() => navigation.navigate('StudioSeriesCreate')}
              >
                <Plus size={13} color={COLORS.gold} />
                <Text style={styles.newSeriesText}>New Series</Text>
              </TouchableOpacity>
            </View>

            {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginVertical: 24 }} /> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            {!loading && series.length === 0 ? (
              <Text style={styles.emptyInline}>No series yet. Start one below.</Text>
            ) : null}

            {series.map((item) => (
              <SeriesCard key={String(item.id)} item={item} onPress={() => openSeries(item)} />
            ))}

            <TouchableOpacity
              style={styles.addCard}
              onPress={() => navigation.navigate('StudioSeriesCreate')}
              activeOpacity={0.8}
            >
              <View style={styles.addIcon}>
                <Plus size={17} color={COLORS.gold} />
              </View>
              <Text style={styles.addTitle}>Start a new series</Text>
              <Text style={styles.addSub}>Title, genres & episode plan first</Text>
            </TouchableOpacity>

            <Text style={styles.sectionH2Alt}>Studio tools</Text>
            <View style={styles.toolsGrid}>
              <ToolChip icon={FileVideo} label="Video specs" onPress={() => navigation.navigate('StudioSpecs')} />
              <ToolChip icon={BarChart3} label="Analytics" onPress={() => navigation.navigate('StudioAnalytics')} />
              <ToolChip icon={Wallet} label="Earnings" onPress={() => navigation.navigate('StudioEarnings')} />
              <ToolChip icon={Settings} label="Channel" onPress={() => navigation.navigate('StudioSettings')} />
              <ToolChip icon={Shield} label="Trust tier" onPress={() => navigation.navigate('CreatorTrustTier')} />
              <ToolChip icon={HelpCircle} label="Quality help" onPress={() => navigation.navigate('StudioHelpQuality')} />
            </View>

            <View style={styles.checklist}>
              <View style={styles.checklistTitle}>
                <Info size={15} color={COLORS.gold} />
                <Text style={styles.checklistTitleText}>Before a series goes public</Text>
              </View>
              {[
                'Complete series (all planned episodes)',
                'Trailer passes quality check',
                '50 followers or 200 remind-me on teaser',
                'Reviewer approval (or auto if gates pass)',
              ].map((line) => (
                <View key={line} style={styles.checklistItem}>
                  <Check size={14} color={COLORS.gold} />
                  <Text style={styles.checklistText}>{line}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  topfixed: { paddingHorizontal: 20, paddingBottom: 10 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logoBadge: {
    width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  logoW: { fontFamily: FONTS.extraBold, fontSize: 14, color: COLORS.navy },
  brandName: { fontFamily: FONTS.extraBold, fontSize: 16.5, color: '#fff' },
  brandTag: {
    fontFamily: FONTS.semi, fontSize: 9.5, color: COLORS.textFaint, letterSpacing: 0.3, marginTop: 1,
  },
  earnPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
  },
  earnDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.gold },
  earnAmt: { fontFamily: FONTS.bold, fontSize: 11.5, color: '#fff' },
  earnSmall: { fontFamily: FONTS.semi, fontSize: 9, color: COLORS.textFaint },
  backWatcher: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    marginBottom: 14, paddingVertical: 4,
  },
  backWatcherText: { fontFamily: FONTS.semi, fontSize: 12, color: COLORS.gold },
  statusCard: {
    borderRadius: 18, padding: 16, marginBottom: 16,
    backgroundColor: 'rgba(212,160,23,0.1)', borderWidth: 1, borderColor: 'rgba(212,160,23,0.3)',
    flexDirection: 'row', alignItems: 'center', gap: 13,
  },
  statusIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  statusTitle: { fontFamily: FONTS.extraBold, fontSize: 13.5, color: '#fff', marginBottom: 2 },
  statusSub: { fontFamily: FONTS.regular, fontSize: 11, color: '#C9C9DE', lineHeight: 16 },
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  sectionH2: { fontFamily: FONTS.bold, fontSize: 15, color: '#fff' },
  sectionH2Alt: { fontFamily: FONTS.bold, fontSize: 15, color: '#fff', marginBottom: 10, marginTop: 4 },
  newSeriesBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  newSeriesText: { fontFamily: FONTS.bold, fontSize: 11.5, color: COLORS.gold },
  seriesCard: {
    flexDirection: 'row', gap: 12, backgroundColor: COLORS.navyCard,
    borderWidth: 1, borderColor: COLORS.navyLine, borderRadius: 16, padding: 12, marginBottom: 12,
  },
  poster: { width: 64, height: 92, borderRadius: 10 },
  seriesBody: { flex: 1, minWidth: 0 },
  seriesTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 },
  seriesTitle: { flex: 1, fontFamily: FONTS.bold, fontSize: 13.5, color: '#fff' },
  tag: {
    fontSize: 8.5, fontFamily: FONTS.extraBold, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, overflow: 'hidden',
  },
  tagDraft: { backgroundColor: COLORS.navySoft, color: COLORS.textDim },
  tagReview: { backgroundColor: 'rgba(212,160,23,0.18)', color: COLORS.gold },
  tagLive: { backgroundColor: 'rgba(59,178,115,0.18)', color: '#3BB273' },
  tagChanges: { backgroundColor: 'rgba(228,87,61,0.18)', color: '#E4573D' },
  progressLine: { fontFamily: FONTS.regular, fontSize: 10.5, color: COLORS.textDim, marginTop: 6, marginBottom: 7 },
  progressBold: { fontFamily: FONTS.bold, color: '#fff' },
  progressBar: {
    height: 5, backgroundColor: COLORS.navyLine, borderRadius: 99, overflow: 'hidden', marginBottom: 9,
  },
  progressFill: { height: '100%', backgroundColor: COLORS.gold, borderRadius: 99 },
  flagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  flag: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5,
  },
  flagOk: { backgroundColor: 'rgba(59,178,115,0.14)' },
  flagWarn: { backgroundColor: 'rgba(228,87,61,0.14)' },
  flagPending: { backgroundColor: COLORS.navySoft },
  flagText: { fontFamily: FONTS.bold, fontSize: 9 },
  addCard: {
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.navyLine,
    borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 18, marginTop: 4,
  },
  addIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  addTitle: { fontFamily: FONTS.bold, fontSize: 13, color: '#fff', marginBottom: 3 },
  addSub: { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textDim },
  toolsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  toolChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  toolLabel: { fontFamily: FONTS.semi, fontSize: 12, color: '#fff' },
  checklist: {
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 16, padding: 15, marginBottom: 8,
  },
  checklistTitle: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  checklistTitleText: { fontFamily: FONTS.bold, fontSize: 12, color: '#fff' },
  checklistItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  checklistText: { flex: 1, fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textDim },
  lockBox: {
    padding: 16, borderRadius: 14, backgroundColor: COLORS.navyCard,
    borderWidth: 1, borderColor: COLORS.navyLine, marginBottom: 16,
  },
  lockTitle: { fontFamily: FONTS.bold, color: COLORS.text, fontSize: 15 },
  lockSub: { marginTop: 8, color: COLORS.textDim, fontFamily: FONTS.regular, lineHeight: 19 },
  empty: { textAlign: 'center', color: COLORS.textFaint, fontFamily: FONTS.medium },
  emptyInline: {
    textAlign: 'center', color: COLORS.textFaint, fontFamily: FONTS.medium, marginBottom: 12,
  },
  error: { color: COLORS.error, fontFamily: FONTS.medium, marginBottom: 8 },
  cta: {
    marginTop: 14, backgroundColor: COLORS.gold, borderRadius: 12, padding: 13, alignItems: 'center',
  },
  ctaText: { fontFamily: FONTS.bold, color: COLORS.navy },
});

export default StudioHomeScreen;
