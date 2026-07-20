/**
 * Search filters & sort — genres from founder DB
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';
import { useEpisioGenres } from '../../hooks/useEpisioGenres';

const SORTS = ['Popular', 'Newest', 'Top rated', 'A–Z'];

const SearchFiltersSortScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { genres: GENRES } = useEpisioGenres({ includeAll: true });
  const [genre, setGenre] = useState(route.params?.genre || 'All');
  const [sort, setSort] = useState(route.params?.sort || 'Popular');

  const apply = () => {
    navigation.navigate('Search', { genre: genre === 'All' ? undefined : genre, sort });
  };

  return (
    <EpisioScreenShell
      title="Filters"
      subtitle="Refine search"
      footer={(
        <TouchableOpacity style={styles.cta} onPress={apply}>
          <Text style={styles.ctaText}>Apply</Text>
        </TouchableOpacity>
      )}
    >
      <Text style={styles.section}>Genre</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {GENRES.map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.chip, genre === g && styles.chipOn]}
            onPress={() => setGenre(g)}
          >
            <Text style={[styles.chipText, genre === g && styles.chipTextOn]}>{g}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={styles.section}>Sort by</Text>
      {SORTS.map((s) => (
        <TouchableOpacity key={s} style={styles.sortRow} onPress={() => setSort(s)}>
          <Text style={styles.sortLabel}>{s}</Text>
          <View style={[styles.radio, sort === s && styles.radioOn]} />
        </TouchableOpacity>
      ))}
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  section: { fontFamily: FONTS.semi, fontSize: 13, color: COLORS.textDim, marginTop: 16, marginBottom: 10 },
  chips: { gap: 8, paddingBottom: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  chipOn: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  chipText: { fontFamily: FONTS.semi, fontSize: 13, color: COLORS.text },
  chipTextOn: { color: COLORS.navy },
  sortRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.navyLine,
  },
  sortLabel: { fontFamily: FONTS.regular, fontSize: 15, color: COLORS.text },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.navyLine,
  },
  radioOn: { borderColor: COLORS.gold, backgroundColor: COLORS.gold },
  cta: { backgroundColor: COLORS.gold, borderRadius: RADIUS.md, padding: 15, alignItems: 'center' },
  ctaText: { fontFamily: FONTS.extraBold, fontSize: 14, color: COLORS.navy },
});

export default SearchFiltersSortScreen;
