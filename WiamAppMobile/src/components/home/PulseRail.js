/**
 * PulseRail — mosaic rail showing 8 high-engagement books.
 *
 * Layout per "page" (3 books):
 *   [ BIG ]  [ small-top    ]
 *            [ small-bottom ]
 *
 * The mosaic alternates so the page rhythm is BIG, two small stacked,
 * BIG, two small stacked... This is intentionally different from
 * Spotlight (single big hero) and Stream (lots of tiny tiles) so the
 * page feels layered, not repetitive.
 *
 * Section name in tracking events: 'pulse'.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { COLORS, FONTS, SPACING } from '../../constants/theme';
import { Flame } from 'lucide-react-native';
import BookTile from './BookTile';
import trackingApi from '../../api/tracking';

const SECTION_KEY = 'pulse';
const BIG_W = 124;
const SMALL_W = 84;

const PulseRail = ({ books, onPressBook }) => {
  const data = useMemo(() => (books || []).slice(0, 9), [books]);
  const seen = useRef(new Set()).current;

  useEffect(() => {
    data.forEach((b, idx) => {
      if (b && b.id && !seen.has(b.id)) {
        seen.add(b.id);
        trackingApi.queueImpression(SECTION_KEY, b.id, idx);
      }
    });
  }, [data, seen]);

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
          <Flame size={16} color="#f97316" />
          <Text style={styles.headTitle}>Pulse Right Now</Text>
        </View>
        <Text style={styles.headSub}>Most engaged this week</Text>
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
            <View key={`pulse-g-${gi}`} style={styles.group}>
              {big ? (
                <BookTile
                  book={big}
                  size="md"
                  section={SECTION_KEY}
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
                    section={SECTION_KEY}
                    position={baseIdx + 1}
                    onPress={onPressBook}
                    style={{ width: SMALL_W, marginBottom: SPACING.sm }}
                  />
                ) : null}
                {bot ? (
                  <BookTile
                    book={bot}
                    size="sm"
                    section={SECTION_KEY}
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

export default PulseRail;
