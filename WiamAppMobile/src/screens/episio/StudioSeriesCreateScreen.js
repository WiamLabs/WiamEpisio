/**
 * Layout: WiamStudio-Series-Create + Series vs Season choice (team copy).
 * structure_mode: series (one complete story) | season (Season N — submit season-by-season)
 */
import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Check } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';

const StudioSeriesCreateScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [title, setTitle] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [genre, setGenre] = useState('Drama');
  const [planned, setPlanned] = useState('20');
  const [structure, setStructure] = useState('series'); // series | season
  const [seasonNumber, setSeasonNumber] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const create = async () => {
    setError(null);
    if (title.trim().length < 2) {
      setError('Title required');
      return;
    }
    if (Number(planned) < 20) {
      setError('Plan at least 20 episodes for this series or season');
      return;
    }
    if (Number(planned) > 200) {
      setError('Max 200 episodes per series or season');
      return;
    }
    setBusy(true);
    try {
      const data = await studioEpisioApi.createSeries({
        title: title.trim(),
        description: synopsis.trim(),
        genre: genre.trim(),
        planned_episode_count: Number(planned),
        structure_mode: structure,
        season_number: structure === 'season' ? Number(seasonNumber) || 1 : 1,
      });
      const id = data?.series?.id;
      navigation.replace('StudioSeriesDetail', { seriesId: id });
    } catch (e) {
      setError(e?.message || 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={[styles.root, { paddingTop: insets.top + 8 }]} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <ChevronLeft size={20} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={styles.title}>New Series</Text>
      <Text style={styles.hint}>
        Choose how your story is shaped. The WiamEpisio team reviews the full unit you submit — every episode + trailer — before anything goes live.
      </Text>

      <Text style={styles.label}>How is this story structured?</Text>

      <TouchableOpacity
        style={[styles.choice, structure === 'series' && styles.choiceOn]}
        onPress={() => setStructure('series')}
      >
        <View style={styles.choiceTop}>
          <Text style={styles.choiceTitle}>Series (no seasons)</Text>
          {structure === 'series' ? <Check size={16} color={COLORS.gold} /> : null}
        </View>
        <Text style={styles.choiceBody}>
          One complete story. You upload all planned episodes, lock the series, and submit once.
          Best when the story ends in this batch — not split into Season 1 / Season 2.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.choice, structure === 'season' && styles.choiceOn]}
        onPress={() => setStructure('season')}
      >
        <View style={styles.choiceTop}>
          <Text style={styles.choiceTitle}>Season (multi-season show)</Text>
          {structure === 'season' ? <Check size={16} color={COLORS.gold} /> : null}
        </View>
        <Text style={styles.choiceBody}>
          This upload is one season of a longer show. Finish every episode in this season, lock it, and submit season-by-season.
          Season 2 only after Season 1 is live. Our team checks this season fully before publish.
        </Text>
      </TouchableOpacity>

      {structure === 'season' ? (
        <>
          <Text style={styles.label}>Season number</Text>
          <TextInput
            style={styles.input}
            value={seasonNumber}
            onChangeText={setSeasonNumber}
            keyboardType="number-pad"
            placeholderTextColor={COLORS.textFaint}
          />
        </>
      ) : null}

      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholderTextColor={COLORS.textFaint} placeholder="Series title" />
      <Text style={styles.label}>Synopsis</Text>
      <TextInput style={[styles.input, { minHeight: 90 }]} multiline value={synopsis} onChangeText={setSynopsis} placeholderTextColor={COLORS.textFaint} placeholder="Story..." />
      <Text style={styles.label}>Genre</Text>
      <TextInput style={styles.input} value={genre} onChangeText={setGenre} placeholderTextColor={COLORS.textFaint} />
      <Text style={styles.label}>
        Planned episodes for this {structure === 'season' ? 'season' : 'series'} (min 20 · max 200)
      </Text>
      <TextInput style={styles.input} value={planned} onChangeText={setPlanned} keyboardType="number-pad" placeholderTextColor={COLORS.textFaint} />
      <Text style={styles.footNote}>
        Each episode must be 4–5 minutes. Trailer 15–60 seconds. Half stories cannot go live or earn.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={styles.cta} onPress={create} disabled={busy}>
        {busy ? <ActivityIndicator color={COLORS.navy} /> : (
          <Text style={styles.ctaText}>
            Create {structure === 'season' ? `Season ${seasonNumber} draft` : 'series draft'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  back: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  title: { fontSize: 22, fontFamily: FONTS.extraBold, color: COLORS.text, marginBottom: 8 },
  hint: { color: COLORS.textDim, fontFamily: FONTS.regular, marginBottom: 16, lineHeight: 19 },
  label: { color: COLORS.textDim, fontFamily: FONTS.semi, fontSize: 11.5, marginBottom: 6, marginTop: 4 },
  choice: {
    backgroundColor: COLORS.navyCard, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  choiceOn: { borderColor: COLORS.gold, backgroundColor: 'rgba(212,160,23,0.08)' },
  choiceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  choiceTitle: { fontFamily: FONTS.bold, color: '#fff', fontSize: 14 },
  choiceBody: { fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 12, lineHeight: 18 },
  input: {
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 12, padding: 13, color: COLORS.text, marginBottom: 12, fontFamily: FONTS.regular,
  },
  footNote: { color: COLORS.textFaint, fontFamily: FONTS.regular, fontSize: 11.5, lineHeight: 17, marginBottom: 10 },
  cta: { backgroundColor: COLORS.gold, borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 8 },
  ctaText: { fontFamily: FONTS.bold, color: COLORS.navy },
  error: { color: COLORS.error, fontFamily: FONTS.medium, marginBottom: 8 },
});

export default StudioSeriesCreateScreen;
