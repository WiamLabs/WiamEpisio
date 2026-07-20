/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
/**
 * BrowseScreen — watch categories → CategoryResults.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Compass } from 'lucide-react-native';
import { EPISIO, EPISIO_FONTS, GENRE_CHIPS } from '../../constants/episioTheme';

const BrowseScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const cats = GENRE_CHIPS.filter((c) => c !== 'For you').concat(['Trending', 'New releases']);

  return (
    <View style={[styles.page, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>Browse</Text>
      <Text style={styles.sub}>Find short dramas by mood</Text>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {cats.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={styles.row}
            onPress={() => navigation.navigate('CategoryResults', { category: cat })}
            activeOpacity={0.85}
          >
            <Compass size={18} color={EPISIO.ember} />
            <Text style={styles.rowText}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: EPISIO.ink900, paddingHorizontal: 16 },
  title: { fontFamily: EPISIO_FONTS.display, fontSize: 28, color: EPISIO.paper },
  sub: { color: EPISIO.smoke, fontFamily: EPISIO_FONTS.ui, marginTop: 4, marginBottom: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: EPISIO.borderRow,
  },
  rowText: { fontFamily: EPISIO_FONTS.uiSemi, fontSize: 15, color: EPISIO.paper },
});

export default BrowseScreen;
