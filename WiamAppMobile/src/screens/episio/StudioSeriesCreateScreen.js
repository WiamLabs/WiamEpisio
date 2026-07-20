/**
 * Layout: WiamStudio-Series-Create + Series vs Season choice (team copy).
 * structure_mode: series (one complete story) | season (Season N — submit season-by-season)
 * KeyboardAvoidingView + scroll so Next stays reachable.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Keyboard, Modal, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Check } from 'lucide-react-native';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import { useEpisioGenres } from '../../hooks/useEpisioGenres';

const StudioSeriesCreateScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const scrollRef = useRef(null);
  const { genres: GENRES, reload: reloadGenres } = useEpisioGenres();
  const [title, setTitle] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [genre, setGenre] = useState('Drama');
  const [planned, setPlanned] = useState('5');
  const [structure, setStructure] = useState('series'); // series | season
  const [seasonNumber, setSeasonNumber] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [genreReqOpen, setGenreReqOpen] = useState(false);
  const [genreReqName, setGenreReqName] = useState('');
  const [genreReqBusy, setGenreReqBusy] = useState(false);

  useEffect(() => {
    if (GENRES?.length && !GENRES.includes(genre)) {
      setGenre(GENRES[0]);
    }
  }, [GENRES, genre]);

  const scrollToEnd = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 100);
  };

  const create = async () => {
    setError(null);
    Keyboard.dismiss();
    if (title.trim().length < 2) {
      setError('Title required');
      return;
    }
    if (synopsis.trim().length > 0 && synopsis.trim().length < 40) {
      setError('Synopsis should be at least 40 characters when provided');
      return;
    }
    if (Number(planned) < 5) {
      setError('Plan at least 5 episodes for this series or season');
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
      navigation.replace('StudioCover', { seriesId: id });
    } catch (e) {
      setError(e?.message || 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + 8 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
      >
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <ChevronLeft size={20} color={COLORS.text} />
        </TouchableOpacity>

        <Text style={styles.stepLabel}>Step 1 of 4 — Identity</Text>
        <View style={styles.stepTrack}>
          <View style={[styles.stepSeg, styles.stepDone]} />
          <View style={styles.stepSeg} />
          <View style={styles.stepSeg} />
          <View style={styles.stepSeg} />
        </View>

        <Text style={styles.title}>Tell us about the series</Text>
        <Text style={styles.hint}>
          This becomes the public series page once live. The WiamEpisio team reviews the full unit you submit — every episode + trailer — before anything goes live.
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
              onFocus={scrollToEnd}
              placeholderTextColor={COLORS.textFaint}
            />
          </>
        ) : null}

        <Text style={styles.label}>Series title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          keyboardType="default"
          autoCapitalize="words"
          onFocus={scrollToEnd}
          placeholderTextColor={COLORS.textFaint}
          placeholder="Series title"
        />
        <Text style={styles.label}>Synopsis · {synopsis.length}/400</Text>
        <TextInput
          style={[styles.input, { minHeight: 90 }]}
          multiline
          maxLength={400}
          value={synopsis}
          onChangeText={setSynopsis}
          keyboardType="default"
          textAlignVertical="top"
          onFocus={scrollToEnd}
          placeholderTextColor={COLORS.textFaint}
          placeholder="Story hook (min 40 characters when set)"
        />
        <Text style={styles.label}>Genre</Text>
        <View style={styles.genreRow}>
          {GENRES.map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.genreChip, genre === g && styles.genreOn]}
              onPress={() => setGenre(g)}
            >
              <Text style={[styles.genreText, genre === g && { color: COLORS.navy }]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity onPress={() => { setGenreReqName(''); setGenreReqOpen(true); }}>
          <Text style={styles.requestGenre}>Don't see your genre? Request one</Text>
        </TouchableOpacity>
        <Text style={styles.label}>
          Planned episodes for this {structure === 'season' ? 'season' : 'series'} (min 5 · max 200)
        </Text>
        <TextInput
          style={styles.input}
          value={planned}
          onChangeText={setPlanned}
          keyboardType="number-pad"
          onFocus={scrollToEnd}
          placeholderTextColor={COLORS.textFaint}
        />
        <Text style={styles.footNote}>
          Episode count locks your completeness gate. Each episode must be 4–5 minutes. Trailer 15–60 seconds. Half stories cannot go live or earn.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <EpisioGoldButton
          label={`Next: Cover · create ${structure === 'season' ? `Season ${seasonNumber}` : 'series'} draft`}
          onPress={create}
          loading={busy}
        />
      </ScrollView>

      <Modal visible={genreReqOpen} transparent animationType="slide" onRequestClose={() => setGenreReqOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Request a genre</Text>
            <Text style={styles.modalSub}>We will review and add it for all creators if it fits.</Text>
            <TextInput
              style={styles.input}
              value={genreReqName}
              onChangeText={setGenreReqName}
              placeholder="e.g. Medical Drama"
              placeholderTextColor={COLORS.textFaint}
              autoFocus
            />
            <EpisioGoldButton
              label={genreReqBusy ? 'Sending…' : 'Submit request'}
              loading={genreReqBusy}
              onPress={async () => {
                const n = genreReqName.trim();
                if (n.length < 2) {
                  Alert.alert('Genre', 'Enter a genre name');
                  return;
                }
                setGenreReqBusy(true);
                try {
                  await studioEpisioApi.requestGenre(n);
                  setGenreReqOpen(false);
                  Alert.alert('Submitted', 'Thanks — the team will review your genre request.');
                  reloadGenres?.();
                } catch (e) {
                  Alert.alert('Request', e?.message || 'Could not submit');
                } finally {
                  setGenreReqBusy(false);
                }
              }}
            />
            <TouchableOpacity onPress={() => setGenreReqOpen(false)} style={{ marginTop: 12 }}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  back: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  stepLabel: { fontSize: 11, fontFamily: FONTS.bold, color: COLORS.textFaint, marginBottom: 8 },
  stepTrack: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  stepSeg: { flex: 1, height: 4, borderRadius: 99, backgroundColor: COLORS.navyLine },
  stepDone: { backgroundColor: COLORS.gold },
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
  genreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  requestGenre: {
    color: COLORS.gold, fontFamily: FONTS.semi, fontSize: 12.5, marginBottom: 14,
  },
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.navyCard, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 32,
  },
  modalTitle: { fontFamily: FONTS.bold, fontSize: 16, color: '#fff', marginBottom: 6 },
  modalSub: { fontFamily: FONTS.regular, fontSize: 12.5, color: COLORS.textDim, marginBottom: 14, lineHeight: 18 },
  modalCancel: { textAlign: 'center', color: COLORS.textFaint, fontFamily: FONTS.semi },
  genreChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  genreOn: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  genreText: { fontFamily: FONTS.semi, fontSize: 12, color: COLORS.textDim },
  footNote: {
    fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textFaint, lineHeight: 16, marginBottom: 14,
  },
  error: { color: COLORS.error, fontFamily: FONTS.medium, marginBottom: 10 },
});

export default StudioSeriesCreateScreen;
