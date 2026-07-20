/**
 * SeriesEditorScreen — minimal create/edit/delete (Push 9).
 * Backed by /api/v1/series. Adds a "Books in this series" list when
 * editing, with simple add/remove via the existing creator stories list.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Layers, Trash2, Plus, X, House } from 'lucide-react-native';
import { COLORS, SPACING } from '../../../constants/theme';
import { STUDIO_COLORS } from '../../../constants/studioTheme';
import studioV2Api from '../../../api/studioV2';
import studioApi from '../../../api/studio';

const SeriesEditorScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { mode = 'create', seriesId, universeId } = route.params || {};
  const editing = mode === 'edit';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('ongoing');
  const [books, setBooks] = useState([]);
  const [allStories, setAllStories] = useState([]);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    studioApi.listMyStories()
      .then((res) => {
        if (cancelled) return;
        setAllStories(res?.stories || []);
      })
      .catch(() => {});
    if (!editing || !seriesId) return () => { cancelled = true; };
    studioV2Api.getSeries(seriesId)
      .then((res) => {
        if (cancelled) return;
        const s = res?.series || {};
        setTitle(s.title || '');
        setDescription(s.description || '');
        setStatus(s.status || 'ongoing');
        setBooks(res?.books || []);
      })
      .catch((e) => Alert.alert('Could not load', String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [editing, seriesId]);

  const addBook = (book) => {
    if (!seriesId) return;
    studioV2Api.addBookToSeries(seriesId, book.id)
      .then(() => studioV2Api.getSeries(seriesId))
      .then((res) => setBooks(res?.books || []))
      .catch((e) => Alert.alert('Add failed', String(e)));
  };

  const removeBook = (book) => {
    if (!seriesId) return;
    studioV2Api.removeBookFromSeries(seriesId, book.id)
      .then(() => studioV2Api.getSeries(seriesId))
      .then((res) => setBooks(res?.books || []))
      .catch((e) => Alert.alert('Remove failed', String(e)));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please name your series.');
      return;
    }
    setSaving(true);
    try {
      const payload = { title: title.trim(), description, status };
      if (universeId) payload.universe_id = universeId;
      if (editing) {
        await studioV2Api.updateSeries(seriesId, payload);
      } else {
        await studioV2Api.createSeries(payload);
      }
      navigation.goBack();
    } catch (e) {
      if (e?.proRequired) {
        navigation.replace('StudioProPaywall', { reason: 'Series creation' });
      } else {
        Alert.alert('Save failed', typeof e === 'string' ? e : String(e?.message || ''));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete series',
      'Books will not be deleted, only the grouping.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await studioV2Api.deleteSeries(seriesId);
              navigation.goBack();
            } catch (e) {
              Alert.alert('Delete failed', typeof e === 'string' ? e : String(e?.message || ''));
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={STUDIO_COLORS.accent} />
        </View>
      </View>
    );
  }

  const inSeriesIds = new Set(books.map((b) => b.id));
  const availableStories = allStories.filter((b) => !inSeriesIds.has(b.id));

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.headBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={COLORS.white} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Main')}>
          <House size={17} color={STUDIO_COLORS.accent} />
        </TouchableOpacity>
        <Text style={styles.headTitle}>{editing ? 'Edit series' : 'New series'}</Text>
        {editing ? (
          <TouchableOpacity style={styles.delBtn} onPress={handleDelete}>
            <Trash2 size={16} color={COLORS.error} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.iconWrap}>
          <Layers size={26} color={STUDIO_COLORS.accent} />
        </View>
        <Text style={styles.helper}>
          Series let readers binge multiple books in your intended order. You
          can re-order, lock entries, or set a series-wide cover.
        </Text>

        <Field label="Title">
          <TextInput
            style={styles.input}
            placeholder="e.g. The Awakening Saga"
            placeholderTextColor={COLORS.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={200}
          />
        </Field>

        <Field label="Description">
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="A short blurb shown on the series page."
            placeholderTextColor={COLORS.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            maxLength={2000}
          />
        </Field>

        <Field label="Status">
          <View style={styles.pillRow}>
            {['ongoing', 'complete', 'hiatus', 'archived'].map((s) => (
              <TouchableOpacity
                key={`s-${s}`}
                style={[styles.pill, status === s && styles.pillActive]}
                onPress={() => setStatus(s)}
              >
                <Text style={[styles.pillText, status === s && styles.pillTextActive]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.saveBtnText}>{editing ? 'Save changes' : 'Create series'}</Text>
          )}
        </TouchableOpacity>

        {editing ? (
          <>
            <Text style={styles.subSection}>Books in this series ({books.length})</Text>
            {books.length === 0 ? (
              <Text style={styles.emptyText}>No books yet — add your first below.</Text>
            ) : (
              books.map((b) => (
                <View key={`b-${b.id}`} style={styles.bookRow}>
                  <Text style={styles.bookTitle} numberOfLines={1}>{b.title}</Text>
                  <TouchableOpacity onPress={() => removeBook(b)}>
                    <X size={16} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              ))
            )}

            <Text style={styles.subSection}>Add a book</Text>
            {availableStories.length === 0 ? (
              <Text style={styles.emptyText}>All your stories are already in this series.</Text>
            ) : (
              availableStories.map((b) => (
                <TouchableOpacity
                  key={`a-${b.id}`}
                  style={styles.addRow}
                  onPress={() => addBook(b)}
                >
                  <Plus size={14} color={STUDIO_COLORS.accent} />
                  <Text style={styles.addRowText} numberOfLines={1}>{b.title}</Text>
                </TouchableOpacity>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
};

const Field = ({ label, children }) => (
  <View style={{ marginTop: SPACING.md }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: STUDIO_COLORS.background },
  headBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: STUDIO_COLORS.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headTitle: { color: STUDIO_COLORS.textBright, fontSize: 16, fontWeight: '700' },
  delBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(207,102,121,0.1)',
  },
  scroll: { padding: SPACING.lg, paddingBottom: 120 },
  iconWrap: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: STUDIO_COLORS.accentSoft,
    borderWidth: 1, borderColor: STUDIO_COLORS.accentBorder,
  },
  helper: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginTop: SPACING.md },
  fieldLabel: { color: COLORS.textSecondary, fontSize: 11, marginBottom: 6 },
  input: {
    backgroundColor: STUDIO_COLORS.card,
    borderColor: STUDIO_COLORS.border,
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    color: COLORS.text, fontSize: 14,
  },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  pillRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: STUDIO_COLORS.border,
  },
  pillActive: {
    backgroundColor: STUDIO_COLORS.accentSoft,
    borderColor: STUDIO_COLORS.accentBorder,
  },
  pillText: { color: COLORS.textSecondary, fontSize: 12 },
  pillTextActive: { color: STUDIO_COLORS.accent, fontWeight: '700' },
  saveBtn: {
    marginTop: SPACING.lg,
    backgroundColor: STUDIO_COLORS.accent,
    paddingVertical: 14, borderRadius: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  subSection: {
    color: STUDIO_COLORS.textBright,
    fontSize: 14,
    fontWeight: '700',
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  emptyText: { color: COLORS.textMuted, fontSize: 12 },
  bookRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: STUDIO_COLORS.card,
    borderColor: STUDIO_COLORS.border,
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 6,
  },
  bookTitle: { color: COLORS.text, fontSize: 13, flex: 1 },
  addRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(168, 85, 247, 0.06)',
    borderColor: 'rgba(168, 85, 247, 0.18)',
    borderStyle: 'dashed',
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 6,
  },
  addRowText: { color: COLORS.text, fontSize: 13 },
});

export default SeriesEditorScreen;
