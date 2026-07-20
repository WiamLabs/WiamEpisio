/**
 * MosaicRail — generic mosaic layout used by Home V2 sections.
 *
 * Same visual pattern as the legacy PulseRail (1 BIG tile + 2 small
 * stacked tiles per page) but parameterised so any section with
 * ``layout: 'mosaic'`` or ``layout: 'pulse'`` can render with its own
 * title, subtitle and icon. The Home V2 renderer dispatches on the
 * ``layout`` field returned by the backend, so the same component
 * powers Pulse Right Now, Hidden Gems, Most Loved This Week and any
 * future mosaic-style section without UI churn.
 *
 * Tracking: queues ``home_impression`` for the first 9 visible books;
 * BookTile records ``home_click`` on press.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { COLORS, FONTS, SPACING } from '../../constants/theme';
import BookTile from './BookTile';
import trackingApi from '../../api/tracking';

const BIG_W = 124;
const SMALL_W = 84;

const MosaicRail = ({
  title,
  subtitle,
  icon,
  books,
  onPressBook,
  sectionKey = 'mosaic',
}) => {
  const data = useMemo(() => (books || []).slice(0, 9), [books]);
  const seen = useRef(new Set()).current;

  useEffect(() => {
    data.forEach((b, idx) => {
      if (b && b.id && !seen.has(b.id)) {
        seen.add(b.id);
        trackingApi.queueImpression(sectionKey, b.id, idx);
      }
    });
  }, [data, sectionKey, seen]);

  if (!data.length) return null;

  // Build groups of 3: 1 big tile + 2 small tiles stacked.
  const groups = [];
  for (let i = 0; i < data.length; i += 3) {
    groups.push(data.slice(i, i + 3));
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          {icon}
          <Text style={styles.headTitle}>{title}</Text>
        </View>
        {subtitle ? <Text style={styles.headSub}>{subtitle}</Text> : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {groups.map((group, gi) => {
          const big = group[0];
          const top = group[1];
          const bot = group[2];
          const baseIdx = gi * 3;
          return (
            <View key={`${sectionKey}-g-${gi}`} style={styles.group}>
              {big ? (
                <BookTile
                  book={big}
                  size="md"
                  section={sectionKey}
                  position={baseIdx}
                  onPress={onPressBook}
                  style={{ width: BIG_W }}
                />
              ) : null}
              <View style={styles.stack}>
                {top ? (
                  <BookTile
                    book={top}
                    size="sm"
                    section={sectionKey}
                    position={baseIdx + 1}
                    onPress={onPressBook}
                    style={{ width: SMALL_W, marginBottom: SPACING.sm }}
                  />
                ) : null}
                {bot ? (
                  <BookTile
                    book={bot}
                    size="sm"
                    section={sectionKey}
                    position={baseIdx + 2}
                    onPress={onPressBook}
                    style={{ width: SMALL_W }}
                  />
                ) : null}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginTop: SPACING.lg,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  headLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontFamily: FONTS.display,
  },
  headSub: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  scroll: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginRight: SPACING.md,
  },
  stack: {
    flexDirection: 'column',
  },
});

export default MosaicRail;
