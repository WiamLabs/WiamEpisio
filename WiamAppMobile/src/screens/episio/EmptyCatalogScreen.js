/**
 * WiamEpisio-Empty-Catalog.html — genre shelf with filters, empty results.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LayoutGrid } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';

const FILTERS = ['Popular', 'Fresh', 'Completed', 'Free Only'];

const EmptyCatalogScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const genre = route.params?.genre || 'Catalog';
  const [activeFilter, setActiveFilter] = useState(
    route.params?.filter || 'Popular',
  );

  const clearFilters = () => {
    setActiveFilter('Popular');
  };

  const browseAll = () => {
    if (navigation.canGoBack()) {
      navigation.navigate('Main', { screen: 'Discover' });
      return;
    }
    navigation.navigate('Discover');
  };

  return (
    <EpisioScreenShell title={genre} scroll={false}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}
      >
        {FILTERS.map((chip) => {
          const active = chip === activeFilter;
          return (
            <TouchableOpacity
              key={chip}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setActiveFilter(chip)}
              activeOpacity={0.85}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.emptyWrap}>
        <View style={styles.emptyIcon}>
          <LayoutGrid size={34} color={COLORS.textFaint} />
        </View>
        <Text style={styles.headline}>Nothing here yet</Text>
        <Text style={styles.sub}>
          We don't have <Text style={styles.subBold}>{genre}</Text> series matching
          {' '}"{activeFilter}" right now. New titles are added every week — check back soon.
        </Text>
        <EpisioGoldButton
          label="Browse All Genres"
          onPress={browseAll}
          style={styles.primaryBtn}
        />
        <TouchableOpacity onPress={clearFilters} hitSlop={12}>
          <Text style={styles.ghostLink}>Clear Filters</Text>
        </TouchableOpacity>
      </View>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  filterScroll: {
    flexGrow: 0,
    marginHorizontal: -20,
  },
  filterRow: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 999,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
  },
  chipActive: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  chipText: {
    fontFamily: FONTS.semi,
    fontSize: 12,
    color: '#B8B8CC',
  },
  chipTextActive: {
    color: COLORS.navy,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingBottom: 40,
  },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  headline: {
    fontFamily: FONTS.extraBold,
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
  },
  sub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textDim,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 270,
    marginBottom: 24,
  },
  subBold: {
    fontFamily: FONTS.bold,
    color: '#fff',
  },
  primaryBtn: {
    minWidth: 180,
    marginBottom: 12,
  },
  ghostLink: {
    fontFamily: FONTS.semi,
    fontSize: 12,
    color: COLORS.textDim,
  },
});

export default EmptyCatalogScreen;
