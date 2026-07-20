/**
 * StudioLibraryScreen — V2 Library tab (Push 9).
 *
 * Shows three sections in a single scroll view:
 *   1. Stories (existing creator books, opens StoryManager).
 *   2. Series (V2 — pro-gated to create, free to view/edit if existing).
 *   3. Universes (V2 — pro-gated to create).
 *
 * On first open we display a 3-card welcome tour (StudioTourModal).
 * The "+ New …" buttons trigger the paywall when the user is not Pro.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Plus, BookOpen, Layers, Globe, ChevronRight, Sparkles, Crown, Lock,
} from 'lucide-react-native';
import CachedImage from '../../../components/common/CachedImage';
import { COLORS, FONTS, SPACING, RADIUS } from '../../../constants/theme';
import { STUDIO_COLORS } from '../../../constants/studioTheme';
import resolveUrl from '../../../utils/resolveUrl';
import studioApi from '../../../api/studio';
import studioV2Api from '../../../api/studioV2';
import StudioTourModal from './StudioTourModal';
import StudioBackHomeRow from '../../../components/studio/StudioBackHomeRow';

const StudioLibraryScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [stories, setStories] = useState([]);
  const [universes, setUniverses] = useState([]);
  const [series, setSeries] = useState([]);
  const [settings, setSettings] = useState(null);
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [storiesRes, settingsRes, universesRes, seriesRes] = await Promise.allSettled([
        studioApi.listMyStories(),
        studioV2Api.getSettings(),
        studioV2Api.listUniverses(),
        studioV2Api.listSeries(),
      ]);
      setStories(storiesRes.status === 'fulfilled' ? (storiesRes.value?.stories || []) : []);
      if (settingsRes.status === 'fulfilled') {
        setSettings(settingsRes.value?.settings || null);
        setIsPro(!!settingsRes.value?.is_pro);
        if (settingsRes.value?.settings && !settingsRes.value.settings.has_seen_v2_tour) {
          setTourOpen(true);
        }
      }
      setUniverses(universesRes.status === 'fulfilled' ? (universesRes.value?.universes || []) : []);
      setSeries(seriesRes.status === 'fulfilled' ? (seriesRes.value?.series || []) : []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const onTourDismiss = async () => {
    setTourOpen(false);
    try {
      await studioV2Api.updateSettings({ has_seen_v2_tour: true });
    } catch {
      // ignore
    }
  };

  const proGate = useCallback((labelEntity, action) => {
    if (isPro) {
      action();
      return;
    }
    navigation.navigate('StudioProPaywall', { reason: `Create ${labelEntity}` });
  }, [isPro, navigation]);

  if (loading) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={STUDIO_COLORS.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={STUDIO_COLORS.accent} />}
      >
        <StudioBackHomeRow navigation={navigation} title="Studio" />
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>WiamStudio</Text>
            <Text style={styles.heroSub}>
              {isPro ? 'Pro · every tool unlocked' : 'Build your creative system'}
            </Text>
          </View>
          {isPro ? (
            <View style={styles.proBadge}>
              <Crown size={12} color={STUDIO_COLORS.pro} />
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={() => navigation.navigate('StudioProPaywall')}
            >
              <Crown size={12} color="#000" />
              <Text style={styles.upgradeBtnText}>Upgrade</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* STORIES */}
        <Section
          title="Stories"
          icon={<BookOpen size={16} color={STUDIO_COLORS.accent} />}
          actionLabel="+ New story"
          onAction={() => navigation.navigate('NewStory')}
        >
          {stories.length === 0 ? (
            <Empty
              text="No stories yet — start your first story to bring your worlds to life."
              cta="Create story"
              onPress={() => navigation.navigate('NewStory')}
            />
          ) : (
            stories.map((b) => (
              <StoryRow
                key={`story-${b.id}`}
                book={b}
                onPress={() => navigation.navigate('StoryManager', { bookId: b.id })}
              />
            ))
          )}
        </Section>

        {/* SERIES */}
        <Section
          title="Series"
          icon={<Layers size={16} color={STUDIO_COLORS.accent} />}
          actionLabel={isPro ? '+ New series' : 'Pro · New series'}
          onAction={() => proGate('series', () => navigation.navigate('SeriesEditor', { mode: 'create' }))}
          locked={!isPro}
        >
          {series.length === 0 ? (
            <Empty
              text={
                isPro
                  ? 'Group your books into a reading order. Readers can binge from one to the next.'
                  : 'Series unlock with Studio Pro. Group books into a reading order, set a series cover, lock late entries.'
              }
              cta={isPro ? 'Create series' : 'See Pro plans'}
              onPress={() =>
                isPro
                  ? navigation.navigate('SeriesEditor', { mode: 'create' })
                  : navigation.navigate('StudioProPaywall', { reason: 'Series creation' })
              }
            />
          ) : (
            series.map((s) => (
              <EntityRow
                key={`series-${s.id}`}
                title={s.title}
                subtitle={`${s.book_count || 0} book${(s.book_count || 0) === 1 ? '' : 's'} · ${s.status}`}
                cover={s.cover_url}
                onPress={() => navigation.navigate('SeriesEditor', { mode: 'edit', seriesId: s.id })}
              />
            ))
          )}
        </Section>

        {/* UNIVERSES */}
        <Section
          title="Universes"
          icon={<Globe size={16} color={STUDIO_COLORS.accent} />}
          actionLabel={isPro ? '+ New universe' : 'Pro · New universe'}
          onAction={() => proGate('universe', () => navigation.navigate('UniverseEditor', { mode: 'create' }))}
          locked={!isPro}
        >
          {universes.length === 0 ? (
            <Empty
              text={
                isPro
                  ? 'A universe holds multiple series. Build the ecosystem behind your stories.'
                  : 'Universes unlock with Studio Pro. Hold multiple series under one creative banner.'
              }
              cta={isPro ? 'Create universe' : 'See Pro plans'}
              onPress={() =>
                isPro
                  ? navigation.navigate('UniverseEditor', { mode: 'create' })
                  : navigation.navigate('StudioProPaywall', { reason: 'Universe creation' })
              }
            />
          ) : (
            universes.map((u) => (
              <EntityRow
                key={`universe-${u.id}`}
                title={u.title}
                subtitle={`${u.series_count || 0} series · ${u.visibility}`}
                cover={u.cover_url}
                onPress={() => navigation.navigate('UniverseEditor', { mode: 'edit', universeId: u.id })}
              />
            ))
          )}
        </Section>

        <View style={{ height: 96 }} />
      </ScrollView>

      <StudioTourModal visible={tourOpen} onClose={onTourDismiss} />
    </View>
  );
};

const Section = ({ title, icon, actionLabel, onAction, locked, children }) => (
  <View style={styles.section}>
    <View style={styles.sectionHead}>
      <View style={styles.sectionTitleWrap}>
        {icon}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {actionLabel ? (
        <TouchableOpacity onPress={onAction} style={[styles.sectionAction, locked && styles.sectionActionLocked]}>
          {locked ? <Lock size={11} color={STUDIO_COLORS.pro} /> : null}
          <Text style={[styles.sectionActionText, locked && styles.sectionActionTextLocked]}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
    {children}
  </View>
);

const StoryRow = ({ book, onPress }) => (
  <TouchableOpacity style={styles.row} onPress={onPress}>
    {book.cover_url ? (
      <CachedImage source={{ uri: resolveUrl(book.cover_url) }} style={styles.rowCover} />
    ) : (
      <View style={[styles.rowCover, styles.rowCoverPlaceholder]}>
        <BookOpen size={14} color={STUDIO_COLORS.accent} />
      </View>
    )}
    <View style={{ flex: 1 }}>
      <Text style={styles.rowTitle} numberOfLines={1}>{book.title}</Text>
      <Text style={styles.rowSub} numberOfLines={1}>
        {(book.status || 'draft').toUpperCase()} · {book.chapter_count || 0} ch · {book.views || 0} views
      </Text>
    </View>
    <ChevronRight size={16} color={COLORS.textMuted} />
  </TouchableOpacity>
);

const EntityRow = ({ title, subtitle, cover, onPress }) => (
  <TouchableOpacity style={styles.row} onPress={onPress}>
    {cover ? (
      <CachedImage source={{ uri: resolveUrl(cover) }} style={styles.rowCover} />
    ) : (
      <View style={[styles.rowCover, styles.rowCoverPlaceholder]}>
        <Sparkles size={14} color={STUDIO_COLORS.accent} />
      </View>
    )}
    <View style={{ flex: 1 }}>
      <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.rowSub} numberOfLines={1}>{subtitle}</Text>
    </View>
    <ChevronRight size={16} color={COLORS.textMuted} />
  </TouchableOpacity>
);

const Empty = ({ text, cta, onPress }) => (
  <View style={styles.empty}>
    <Text style={styles.emptyText}>{text}</Text>
    {cta ? (
      <TouchableOpacity style={styles.emptyCta} onPress={onPress}>
        <Plus size={12} color={STUDIO_COLORS.accent} />
        <Text style={styles.emptyCtaText}>{cta}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: STUDIO_COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: 120 },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  heroTitle: {
    color: STUDIO_COLORS.textBright,
    fontFamily: FONTS.display,
    fontSize: 26,
  },
  heroSub: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: STUDIO_COLORS.proSoft,
    borderWidth: 1,
    borderColor: STUDIO_COLORS.proBorder,
  },
  proBadgeText: { color: STUDIO_COLORS.pro, fontSize: 11, fontWeight: '700' },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: STUDIO_COLORS.pro,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  upgradeBtnText: { color: '#000', fontSize: 11, fontWeight: '700' },
  section: { marginTop: SPACING.lg },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  sectionTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: {
    color: STUDIO_COLORS.textBright,
    fontFamily: FONTS.display,
    fontSize: 16,
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: STUDIO_COLORS.accentSoft,
    borderWidth: 1,
    borderColor: STUDIO_COLORS.accentBorder,
  },
  sectionActionLocked: {
    backgroundColor: STUDIO_COLORS.proSoft,
    borderColor: STUDIO_COLORS.proBorder,
  },
  sectionActionText: { color: STUDIO_COLORS.accent, fontSize: 11, fontWeight: '700' },
  sectionActionTextLocked: { color: STUDIO_COLORS.pro },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: STUDIO_COLORS.card,
    borderWidth: 1,
    borderColor: STUDIO_COLORS.border,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  rowCover: {
    width: 48, height: 64, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  rowCoverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: STUDIO_COLORS.textBright, fontSize: 14, fontWeight: '700' },
  rowSub: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  empty: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(168, 85, 247, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.18)',
    borderStyle: 'dashed',
  },
  emptyText: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18 },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: SPACING.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: STUDIO_COLORS.accentSoft,
    gap: 4,
  },
  emptyCtaText: { color: STUDIO_COLORS.accent, fontSize: 11, fontWeight: '700' },
});

export default StudioLibraryScreen;
