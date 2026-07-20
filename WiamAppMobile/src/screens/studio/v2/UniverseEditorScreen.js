/**
 * UniverseEditorScreen — minimal create/edit/delete (Push 9).
 * Backed by /api/v1/universes endpoints.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Globe, Trash2, House } from 'lucide-react-native';
import { COLORS, SPACING } from '../../../constants/theme';
import { STUDIO_COLORS } from '../../../constants/studioTheme';
import studioV2Api from '../../../api/studioV2';

const UniverseEditorScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { mode = 'create', universeId } = route.params || {};
  const editing = mode === 'edit';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing || !universeId) return;
    let cancelled = false;
    studioV2Api.getUniverse(universeId)
      .then((res) => {
        if (cancelled) return;
        const u = res?.universe || {};
        setTitle(u.title || '');
        setDescription(u.description || '');
        setVisibility(u.visibility || 'public');
      })
      .catch((e) => Alert.alert('Could not load', String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [editing, universeId]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please name your universe.');
      return;
    }
    setSaving(true);
    try {
      const payload = { title: title.trim(), description, visibility };
      if (editing) {
        await studioV2Api.updateUniverse(universeId, payload);
      } else {
        await studioV2Api.createUniverse(payload);
      }
      navigation.goBack();
    } catch (e) {
      if (e?.proRequired) {
        navigation.replace('StudioProPaywall', { reason: 'Universe creation' });
      } else {
        Alert.alert('Save failed', typeof e === 'string' ? e : String(e?.message || ''));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete universe',
      'This will not delete the series inside — they will become unattached.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await studioV2Api.deleteUniverse(universeId);
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

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.headBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={COLORS.white} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Main')}>
          <House size={17} color={STUDIO_COLORS.accent} />
        </TouchableOpacity>
        <Text style={styles.headTitle}>{editing ? 'Edit universe' : 'New universe'}</Text>
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
          <Globe size={26} color={STUDIO_COLORS.accent} />
        </View>
        <Text style={styles.helper}>
          Universes hold multiple series. Use them when your stories share a
          world, a magic system, or recurring characters.
        </Text>

        <Field label="Title">
          <TextInput
            style={styles.input}
            placeholder="e.g. The Akan Chronicles"
            placeholderTextColor={COLORS.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={200}
          />
        </Field>

        <Field label="Description">
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="A few sentences describing this universe…"
            placeholderTextColor={COLORS.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            maxLength={2000}
          />
        </Field>

        <Field label="Visibility">
          <View style={styles.pillRow}>
            {['public', 'unlisted', 'private'].map((v) => (
              <TouchableOpacity
                key={`v-${v}`}
                style={[styles.pill, visibility === v && styles.pillActive]}
                onPress={() => setVisibility(v)}
              >
                <Text
                  style={[styles.pillText, visibility === v && styles.pillTextActive]}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.saveBtnText}>{editing ? 'Save changes' : 'Create universe'}</Text>
          )}
        </TouchableOpacity>
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
  helper: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: SPACING.md,
  },
  fieldLabel: { color: COLORS.textSecondary, fontSize: 11, marginBottom: 6 },
  input: {
    backgroundColor: STUDIO_COLORS.card,
    borderColor: STUDIO_COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 14,
  },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  pillRow: { flexDirection: 'row', gap: 6 },
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
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

export default UniverseEditorScreen;
