/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 (Text Edition park).
 * Do not wire into active navigation. Pending possible future Text Edition.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import AppBackground from '../../components/AppBackground';
import studioApi from '../../api/studio';
import {
  ArrowLeft, BookPlus, ChevronDown, ImagePlus, X, House,
} from 'lucide-react-native';
import BrandedFooter from '../../components/BrandedFooter';

const NewStoryScreen = ({ navigation }) => {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [genres, setGenres] = useState([]);
  const [showGenres, setShowGenres] = useState(false);
  const [coverUri, setCoverUri] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    studioApi.getGenres()
      .then((d) => setGenres(d.genres || []))
      .catch(() => {});
  }, []);

  const pickCover = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      return Alert.alert('Permission Needed', 'Allow photo library access to choose a cover.');
    }
    // We deliberately do NOT pass `allowsEditing: true` ΓÇö the OS crop UI gives a
    // tiny crop box that ruins covers. We accept the original file as-is and let
    // the server normalize to 600├ù900 (2:3) using cover_scanner.normalize_cover.
    // Creators are told the recommended size up front (see Cover Tips below).
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.95,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setCoverUri(result.assets[0].uri);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) return Alert.alert('Required', 'Enter a title for your story.');
    setCreating(true);
    try {
      const res = await studioApi.createStory({
        title: title.trim(),
        description: description.trim(),
        genre,
        author: author.trim() || undefined,
      });
      if (coverUri) {
        try {
          await studioApi.uploadCover(res.id, coverUri);
        } catch {}
      }
      navigation.replace('StoryManager', { bookId: res.id });
    } catch (e) {
      Alert.alert('Error', typeof e === 'string' ? e : 'Could not create story.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <ArrowLeft color={COLORS.white} size={24} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Main')} style={styles.homeBtn}>
              <House color={COLORS.secondary} size={18} />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>New Story</Text>
              <Text style={styles.headerSub}>Set up your book details</Text>
            </View>
          </View>

          {/* Cover Image Picker */}
          <Text style={styles.label}>Cover Image</Text>
          <View style={styles.coverRow}>
            <TouchableOpacity style={styles.coverPicker} onPress={pickCover} activeOpacity={0.7}>
              {coverUri ? (
                <Image source={{ uri: coverUri }} style={styles.coverPreview} />
              ) : (
                <View style={styles.coverEmpty}>
                  <ImagePlus color={COLORS.secondary} size={32} />
                  <Text style={styles.coverEmptyText}>Tap to add cover</Text>
                  <Text style={styles.coverHint}>600 x 900px (2:3)</Text>
                </View>
              )}
            </TouchableOpacity>
            {coverUri && (
              <TouchableOpacity style={styles.removeCover} onPress={() => setCoverUri(null)}>
                <X color="#ef4444" size={16} />
                <Text style={styles.removeCoverText}>Remove</Text>
              </TouchableOpacity>
            )}
            <View style={styles.coverTips}>
              <Text style={styles.tipTitle}>Cover guidelines</Text>
              <Text style={styles.tipText}>Recommended size: 600 ├ù 900 px (2:3 portrait).</Text>
              <Text style={styles.tipText}>Minimum: 400 ├ù 600 px. Maximum file size: 5 MB.</Text>
              <Text style={styles.tipText}>Format: JPG, PNG, or WebP.</Text>
              <Text style={styles.tipText}>We will fit your image to 2:3 automatically ΓÇö design your art tall, not wide. Free tools: Canva, Photoshop, BookBrush.</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your story title"
            placeholderTextColor={COLORS.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={200}
          />

          {/* Author / Pen Name */}
          <Text style={styles.label}>Author / Pen Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your pen name (optional)"
            placeholderTextColor={COLORS.textMuted}
            value={author}
            onChangeText={setAuthor}
            maxLength={100}
          />

          {/* Genre Picker */}
          <Text style={styles.label}>Genre</Text>
          <TouchableOpacity style={styles.genreBtn} onPress={() => setShowGenres(!showGenres)}>
            <Text style={genre ? styles.genreText : styles.genrePlaceholder}>
              {genre || 'Select a genre'}
            </Text>
            <ChevronDown color={COLORS.textMuted} size={20} />
          </TouchableOpacity>
          {showGenres && (
            <View style={styles.genreList}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                {genres.map((g) => (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.genreItem, genre === g.name && styles.genreItemActive]}
                    onPress={() => { setGenre(g.name); setShowGenres(false); }}
                  >
                    <Text style={[styles.genreItemText, genre === g.name && styles.genreItemTextActive]}>
                      {g.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Synopsis */}
          <Text style={styles.label}>Synopsis</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Write a short description of your story (max 500 characters)"
            placeholderTextColor={COLORS.textMuted}
            value={description}
            onChangeText={setDescription}
            maxLength={500}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{description.length}/500</Text>

          {/* Create Button */}
          <TouchableOpacity
            style={[styles.createBtn, creating && styles.createBtnDisabled]}
            onPress={handleCreate}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator color={COLORS.black} />
            ) : (
              <>
                <BookPlus color={COLORS.black} size={22} />
                <Text style={styles.createBtnText}>Create & Start Writing</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.hint}>
            After creating, you'll be taken to the Story Manager where you can write chapters, upload or change your cover, and publish chapter by chapter ΓÇö just like Wattpad.
          </Text>

          <BrandedFooter compact />
          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.lg },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.xl, marginBottom: SPACING.lg },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  homeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(212,168,67,0.12)',
    borderWidth: 1, borderColor: 'rgba(212,168,67,0.3)',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 8,
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.secondary, fontFamily: FONTS.display },
  headerSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8, marginTop: 20 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: RADIUS.md, padding: SPACING.md,
    color: COLORS.white, fontSize: 16,
  },
  textArea: { minHeight: 120 },
  charCount: { fontSize: 12, color: COLORS.textMuted, textAlign: 'right', marginTop: 4 },
  coverRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  coverPicker: {
    width: 110, height: 165, borderRadius: RADIUS.md, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(212,168,67,0.25)', borderStyle: 'dashed',
  },
  coverPreview: { width: '100%', height: '100%', borderRadius: RADIUS.md },
  coverEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(212,168,67,0.06)' },
  coverEmptyText: { fontSize: 11, color: COLORS.secondary, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  coverHint: { fontSize: 9, color: COLORS.textMuted, marginTop: 4, textAlign: 'center' },
  removeCover: {
    position: 'absolute', left: 78, top: -6, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(239,68,68,0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
  },
  removeCoverText: { fontSize: 11, color: '#ef4444', fontWeight: '600' },
  coverTips: { flex: 1, paddingTop: 4 },
  tipTitle: { fontSize: 13, fontWeight: '700', color: COLORS.white, marginBottom: 8 },
  tipText: { fontSize: 12, color: COLORS.textMuted, lineHeight: 20 },
  genreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: RADIUS.md, padding: SPACING.md,
  },
  genreText: { fontSize: 16, color: COLORS.white },
  genrePlaceholder: { fontSize: 16, color: COLORS.textMuted },
  genreList: {
    backgroundColor: 'rgba(20,20,30,0.98)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: RADIUS.md, marginTop: 4, overflow: 'hidden',
  },
  genreItem: { paddingVertical: 12, paddingHorizontal: SPACING.md, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  genreItemActive: { backgroundColor: 'rgba(212,168,67,0.15)' },
  genreItemText: { fontSize: 15, color: COLORS.textSecondary },
  genreItemTextActive: { color: COLORS.secondary, fontWeight: '600' },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.secondary,
    paddingVertical: 16, borderRadius: RADIUS.md, marginTop: 32, gap: 10,
    shadowColor: '#d4a843', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText: { color: COLORS.black, fontSize: 17, fontWeight: 'bold' },
  hint: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', marginTop: 16, lineHeight: 20 },
});

export default NewStoryScreen;