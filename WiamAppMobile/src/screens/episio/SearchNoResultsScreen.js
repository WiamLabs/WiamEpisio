/**
 * WiamEpisio-Search-No-Results.html — empty search state with tips + chips.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Search, X, Check, SearchX } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';

const TIPS = [
  'Check for typos in series or creator names',
  'Use fewer, more general keywords',
  'Try searching by genre, like "Revenge" or "Royal"',
];

const DEFAULT_CHIPS = ['The King\'s Forgotten Son', 'Accra Nights', 'Drama', 'Revenge'];

const SearchNoResultsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const initialQuery = route.params?.query || route.params?.q || '';
  const suggestions = route.params?.suggestions || DEFAULT_CHIPS;
  const [q, setQ] = useState(initialQuery);

  const runSearch = (query) => {
    const next = (query ?? q).trim();
    navigation.navigate('Search', { query: next, q: next });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={15} color="#fff" />
        </TouchableOpacity>
        <View style={styles.searchField}>
          <Search size={15} color={COLORS.textFaint} />
          <TextInput
            style={styles.input}
            value={q}
            onChangeText={setQ}
            placeholder="Search series"
            placeholderTextColor={COLORS.textFaint}
            returnKeyType="search"
            onSubmitEditing={() => runSearch()}
          />
          {q ? (
            <TouchableOpacity onPress={() => setQ('')}>
              <X size={14} color={COLORS.textFaint} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
        <View style={styles.emptyBlock}>
          <View style={styles.emptyIcon}>
            <SearchX size={30} color={COLORS.textFaint} />
          </View>
          <Text style={styles.emptyTitle}>
            No results for "{initialQuery || q || '…'}"
          </Text>
          <Text style={styles.emptySub}>
            Try a different spelling, or browse by genre instead.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Search tips</Text>
        {TIPS.map((t) => (
          <View key={t} style={styles.tipRow}>
            <Check size={14} color={COLORS.gold} style={{ marginTop: 2 }} />
            <Text style={styles.tipText}>{t}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Popular right now</Text>
        <View style={styles.chips}>
          {suggestions.map((chip) => (
            <TouchableOpacity
              key={chip}
              style={styles.chip}
              onPress={() => runSearch(chip)}
              activeOpacity={0.85}
            >
              <Text style={styles.chipText}>{chip}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <EpisioGoldButton
          label="Browse popular"
          onPress={() => navigation.navigate('Main')}
          style={{ marginTop: 28 }}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  topbar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingBottom: 14,
  },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  searchField: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: COLORS.navyCard, borderWidth: 1.5, borderColor: COLORS.navyLine,
    borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10,
  },
  input: { flex: 1, color: '#fff', fontSize: 13, fontFamily: FONTS.regular, padding: 0 },
  emptyBlock: { alignItems: 'center', paddingTop: 50, paddingBottom: 30 },
  emptyIcon: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: COLORS.navyCard,
    borderWidth: 1, borderColor: COLORS.navyLine,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 16, fontFamily: FONTS.extraBold, color: '#fff', marginBottom: 8, textAlign: 'center',
  },
  emptySub: {
    fontSize: 12.5, color: COLORS.textDim, fontFamily: FONTS.regular,
    lineHeight: 20, textAlign: 'center', maxWidth: 260,
  },
  sectionTitle: {
    fontSize: 12, fontFamily: FONTS.extraBold, color: COLORS.textDim,
    letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 20, marginBottom: 12,
  },
  tipRow: { flexDirection: 'row', gap: 9, marginBottom: 10 },
  tipText: { flex: 1, fontSize: 11.5, color: '#C9C9DE', fontFamily: FONTS.regular, lineHeight: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 9, paddingHorizontal: 15, borderRadius: 999,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  chipText: { fontSize: 12, fontFamily: FONTS.semi, color: '#B8B8CC' },
});

export default SearchNoResultsScreen;
