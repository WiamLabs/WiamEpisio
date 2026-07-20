/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 (Text Edition park).
 * Do not wire into active navigation. Pending possible future Text Edition.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
/**
 * StudioScheduleScreen — V2 Schedule tab (Push 9).
 *
 * Lists every chapter with a future ``scheduled_publish_at`` across all
 * the creator's stories. Free for everyone (scheduling itself is free).
 * Tap a row to navigate to the chapter editor for inline edits.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Calendar, Clock3, ChevronRight } from 'lucide-react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../../constants/theme';
import { STUDIO_COLORS } from '../../../constants/studioTheme';
import studioApi from '../../../api/studio';
import StudioBackHomeRow from '../../../components/studio/StudioBackHomeRow';

const StudioScheduleScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await studioApi.listMyStories();
      const stories = res?.stories || [];
      const all = [];
      for (const s of stories) {
        try {
          const detail = await studioApi.getStory(s.id);
          (detail?.chapters || []).forEach((ch) => {
            if (ch.scheduled_publish_at) {
              all.push({
                bookId: s.id,
                bookTitle: s.title,
                chapter_number: ch.chapter_number,
                chapter_title: ch.chapter_title || `Chapter ${ch.chapter_number}`,
                scheduled_publish_at: ch.scheduled_publish_at,
                status: ch.status || 'draft',
              });
            }
          });
        } catch {
          // skip story
        }
      }
      all.sort((a, b) => new Date(a.scheduled_publish_at) - new Date(b.scheduled_publish_at));
      setItems(all);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={STUDIO_COLORS.accent}
          />
        }
      >
        <StudioBackHomeRow navigation={navigation} title="Schedule" />
        <View style={styles.head}>
          <Calendar size={18} color={STUDIO_COLORS.accent} />
          <Text style={styles.headTitle}>Scheduled releases</Text>
        </View>
        <Text style={styles.headSub}>
          {items.length === 0
            ? 'Schedule a chapter to publish later from the chapter editor. Followers get a push the moment it goes live.'
            : `${items.length} chapter${items.length === 1 ? '' : 's'} queued.`}
        </Text>

        {items.length === 0 ? (
          <View style={styles.empty}>
            <Clock3 size={20} color={STUDIO_COLORS.accent} />
            <Text style={styles.emptyText}>
              Nothing scheduled yet. Open a chapter, tap the calendar icon, and pick a future date — we&apos;ll publish it for you.
            </Text>
          </View>
        ) : (
          items.map((it, idx) => {
            const dt = new Date(it.scheduled_publish_at);
            const dateStr = dt.toLocaleString();
            return (
              <TouchableOpacity
                key={`sched-${it.bookId}-${it.chapter_number}-${idx}`}
                style={styles.row}
                onPress={() =>
                  navigation.navigate('ChapterEditor', {
                    bookId: it.bookId,
                    chapterNumber: it.chapter_number,
                    storyTitle: it.bookTitle,
                  })
                }
              >
                <View style={styles.dateCol}>
                  <Text style={styles.dateText}>{dt.toLocaleDateString(undefined, { month: 'short' })}</Text>
                  <Text style={styles.dayText}>{dt.getDate()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{it.bookTitle}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    Chapter {it.chapter_number} · {it.chapter_title}
                  </Text>
                  <Text style={styles.rowMeta}>{dateStr}</Text>
                </View>
                <ChevronRight size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: STUDIO_COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: 120 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headTitle: { color: STUDIO_COLORS.textBright, fontSize: 22, fontFamily: FONTS.display },
  headSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 4, marginBottom: SPACING.lg },
  empty: {
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(168,85,247,0.06)',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.18)',
    borderStyle: 'dashed',
    flexDirection: 'row', gap: 10,
  },
  emptyText: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, flex: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: STUDIO_COLORS.card,
    borderWidth: 1, borderColor: STUDIO_COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  dateCol: {
    width: 56, alignItems: 'center', justifyContent: 'center',
    backgroundColor: STUDIO_COLORS.accentSoft,
    borderColor: STUDIO_COLORS.accentBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
  },
  dateText: { color: STUDIO_COLORS.accent, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  dayText: { color: STUDIO_COLORS.textBright, fontSize: 18, fontWeight: '800' },
  rowTitle: { color: STUDIO_COLORS.textBright, fontSize: 14, fontWeight: '700' },
  rowSub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  rowMeta: { color: COLORS.textMuted, fontSize: 11, marginTop: 4 },
});

export default StudioScheduleScreen;
