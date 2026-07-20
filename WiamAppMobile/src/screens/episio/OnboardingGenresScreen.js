/**
 * Style: WiamEpisio-Onboarding-Genres.html
 * Genres from founder DB · Min 3 · Continue → OnboardingDone
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Check, Layers } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import apiClient from '../../api/client';
import useAuthStore from '../../store/useAuthStore';

const MIN_GENRES = 3;

const OnboardingGenresScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await apiClient.get('/episio/genres');
        const list = (data?.genres || []).map((g) => ({
          id: g.id,
          name: g.name,
          Icon: Layers,
        }));
        setItems(list);
        if (list.length >= 3) {
          setSelected(list.slice(0, 3).map((g) => g.id));
        }
      } catch {
        setItems([
          { id: 'Drama', name: 'Drama', Icon: Layers },
          { id: 'Romance', name: 'Romance', Icon: Layers },
          { id: 'Revenge', name: 'Revenge', Icon: Layers },
        ]);
        setSelected(['Drama', 'Romance', 'Revenge']);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = (id) => {
    setSelected((prev) => (
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    ));
  };

  const canContinue = selected.length >= MIN_GENRES;
  const selectedNames = useMemo(() => {
    return selected.map((id) => {
      const hit = items.find((g) => g.id === id);
      return hit?.name || String(id);
    });
  }, [selected, items]);

  const continueNext = async () => {
    if (!canContinue) return;
    if (isAuthenticated) {
      try {
        const numericIds = selected.filter((id) => typeof id === 'number');
        if (numericIds.length) {
          await apiClient.post('/genres/preferences', { genre_ids: numericIds });
        }
      } catch { /* prefs optional for guests */ }
    }
    navigation.navigate('OnboardingDone', { genres: selectedNames });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <ChevronLeft size={17} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.h1}>Pick your tastes</Text>
      </View>
      <Text style={styles.sub}>Choose at least {MIN_GENRES} genres. You can change this later.</Text>

      {loading ? (
        <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {items.map((g) => {
            const on = selected.includes(g.id);
            const Icon = g.Icon || Layers;
            return (
              <TouchableOpacity
                key={String(g.id)}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => toggle(g.id)}
                activeOpacity={0.85}
              >
                <Icon size={18} color={on ? COLORS.navy : COLORS.gold} />
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{g.name}</Text>
                {on ? <Check size={14} color={COLORS.navy} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <EpisioGoldButton
          label={canContinue ? 'Continue' : `Pick ${MIN_GENRES - selected.length} more`}
          onPress={continueNext}
          disabled={!canContinue}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingBottom: 8,
  },
  back: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  h1: { fontSize: 18, fontFamily: FONTS.bold, color: '#fff' },
  sub: {
    paddingHorizontal: 20, marginBottom: 16,
    fontSize: 13, color: COLORS.textFaint, fontFamily: FONTS.regular,
  },
  grid: {
    paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 20,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14,
    backgroundColor: COLORS.navyCard, borderWidth: 1.5, borderColor: COLORS.navyLine,
    minWidth: '46%',
  },
  chipOn: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  chipText: { flex: 1, fontFamily: FONTS.semi, color: '#fff', fontSize: 13 },
  chipTextOn: { color: COLORS.navy },
  footer: { paddingHorizontal: 20, paddingTop: 8 },
});

export default OnboardingGenresScreen;
