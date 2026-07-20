/**
 * Layout: WiamStudio-Revision-Request.html (Wave 2)
 * LIVE only · legal / rights / factual — not quality
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Alert, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Lock, Upload } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';

const CATS = [
  { id: 'legal', label: 'Legal' },
  { id: 'rights', label: 'Rights' },
  { id: 'factual', label: 'Factual' },
];

const StudioRevisionRequestScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const scrollRef = useRef(null);
  const seriesId = useRoute().params?.seriesId;
  const [data, setData] = useState(null);
  const [past, setPast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState(null);
  const [category, setCategory] = useState('rights');
  const [reason, setReason] = useState('');
  const [fileName, setFileName] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!seriesId) return;
    setLoading(true);
    try {
      const d = await studioEpisioApi.getSeries(seriesId);
      setData(d);
      try {
        const rev = await studioEpisioApi.listRevisionRequests(seriesId);
        setPast(rev?.requests || rev?.revision_requests || []);
      } catch {
        setPast([]);
      }
    } finally {
      setLoading(false);
    }
  }, [seriesId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const series = data?.series;
  const eps = data?.episodes || [];
  const live = ['published', 'ongoing', 'complete', 'approved'].includes(series?.status)
    || series?.pipeline_state === 'live';

  const pickFile = async () => {
    const { pickVideo } = await import('../../utils/pickMedia');
    const asset = await pickVideo();
    if (!asset) return;
    setFileName(asset.fileName || asset.uri.split('/').pop() || 'corrected.mp4');
  };

  const submit = async () => {
    if (!live) {
      Alert.alert(
        'Not live yet',
        'Revision Requests are only after the WiamEpisio team has published your series. Before live, fix Needs Changes and resubmit the full series.',
      );
      return;
    }
    if (!target) {
      Alert.alert('Pick one piece', 'Select the trailer or one episode to revise.');
      return;
    }
    if (reason.trim().length < 12) {
      Alert.alert('Explain the fix', 'Tell our team what’s wrong and what you’re changing.');
      return;
    }
    setBusy(true);
    try {
      const res = await studioEpisioApi.createRevisionRequest(seriesId, {
        target_kind: target.kind,
        episode_id: target.episodeId,
        episode_number: target.episodeNumber,
        category,
        reason: reason.trim(),
        replacement_storage_key: target.kind === 'episode'
          ? `stub/revision_ep_${target.episodeId || target.episodeNumber}`
          : `stub/revision_trailer_${seriesId}`,
        replacement_filename: fileName || undefined,
      });
      Alert.alert('Sent to our team', res?.message || 'Only that piece is re-reviewed. The rest stays live.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Could not submit', e?.data?.message || e?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  };

  const scrollToEnd = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 120);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={15} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Request a Revision</Text>
          <Text style={styles.sub}>
            {series?.title || 'Series'}
            {series?.season_locked ? ' — Locked' : ''}
          </Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 24) }}
      >
      {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
        <>
          <View style={styles.lockNote}>
            <Lock size={16} color={COLORS.gold} />
            <Text style={styles.lockText}>
              Revision Requests are for{' '}
              <Text style={styles.bold}>LIVE series only</Text> — legal, rights, or factual fixes after publish.
              Before go-live, use <Text style={styles.bold}>Needs Changes</Text> and resubmit the full unit.
            </Text>
          </View>

          {!live ? (
            <Text style={styles.warn}>
              Not live yet. Use Needs Changes + full resubmit. Revision Requests open after the WiamEpisio team publishes you.
            </Text>
          ) : null}

          <Text style={styles.section}>What needs a fix?</Text>
          <TouchableOpacity
            style={[styles.item, target?.kind === 'trailer' && styles.itemOn]}
            onPress={() => setTarget({ kind: 'trailer', title: 'Trailer' })}
          >
            <View style={styles.thumb} />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>Trailer</Text>
              <Text style={styles.itemSub}>QA: {series?.trailer_qa_status || '—'}</Text>
            </View>
          </TouchableOpacity>
          {eps.map((ep) => (
            <TouchableOpacity
              key={ep.id}
              style={[styles.item, target?.episodeId === ep.id && styles.itemOn]}
              onPress={() => setTarget({
                kind: 'episode',
                episodeId: ep.id,
                episodeNumber: ep.episode_number,
                title: `Episode ${ep.episode_number}`,
              })}
            >
              <View style={styles.thumb} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>EP {ep.episode_number} — {ep.title || 'Untitled'}</Text>
                <Text style={styles.itemSub}>{ep.published ? 'Live' : 'Not published'}</Text>
              </View>
            </TouchableOpacity>
          ))}

          <Text style={styles.section}>Why does this need to change?</Text>
          <View style={styles.cats}>
            {CATS.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.cat, category === c.id && styles.catOn]}
                onPress={() => setCategory(c.id)}
              >
                <Text style={[styles.catText, category === c.id && { color: COLORS.navy }]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.reason}
            multiline
            value={reason}
            onChangeText={setReason}
            onFocus={scrollToEnd}
            placeholder="e.g. Legal music swap — replacing licensed track in Episode 14"
            placeholderTextColor={COLORS.textFaint}
          />

          <TouchableOpacity style={styles.uploadSlot} onPress={pickFile} activeOpacity={0.85}>
            <Upload size={16} color={COLORS.gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.uploadTitle}>Upload corrected file</Text>
              <Text style={styles.uploadSub}>
                {fileName
                  ? fileName
                  : target
                    ? `Replaces ${target.title} once approved`
                    : 'Optional — attach the replacement media'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.scope}>
            <Text style={styles.scopeText}>
              <Text style={styles.bold}>Scoped review:</Text> only {target?.title || 'the selected piece'} goes back through review.
              The rest of your series stays live and untouched.
            </Text>
          </View>

          {past.length ? (
            <>
              <Text style={[styles.section, { marginTop: 18 }]}>Recent requests</Text>
              {past.slice(0, 5).map((r) => (
                <View key={r.id || r.created_at} style={styles.pastRow}>
                  <Text style={styles.pastTitle}>{r.target_kind || r.category || 'Revision'}</Text>
                  <Text style={styles.pastSub}>{r.status || 'pending'} · {r.reason?.slice?.(0, 60) || ''}</Text>
                </View>
              ))}
            </>
          ) : null}

          <TouchableOpacity
            style={[styles.submitBtn, (!live || busy) && styles.submitBtnDisabled]}
            onPress={submit}
            disabled={!live || busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator color={COLORS.navy} />
            ) : (
              <Text style={styles.submitBtnText}>Submit Revision Request</Text>
            )}
          </TouchableOpacity>
        </>
      )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  h1: { fontFamily: FONTS.extraBold, color: '#fff', fontSize: 16 },
  sub: { fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 11.5, marginTop: 2 },
  lockNote: {
    flexDirection: 'row', gap: 10, backgroundColor: 'rgba(212,160,23,0.1)',
    borderRadius: 14, padding: 12, borderWidth: 1, borderColor: 'rgba(212,160,23,0.35)', marginBottom: 16,
  },
  lockText: { flex: 1, fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 12, lineHeight: 18 },
  bold: { fontFamily: FONTS.bold, color: '#fff' },
  warn: { color: '#E0A79A', fontFamily: FONTS.medium, marginBottom: 14, lineHeight: 18 },
  section: { fontFamily: FONTS.bold, color: COLORS.textDim, fontSize: 12, marginBottom: 10, marginTop: 6 },
  item: {
    flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: COLORS.navyCard,
    borderRadius: 14, padding: 11, marginBottom: 8, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  itemOn: { borderColor: COLORS.gold },
  thumb: { width: 40, height: 56, borderRadius: 8, backgroundColor: COLORS.navySoft },
  itemTitle: { fontFamily: FONTS.bold, color: '#fff', fontSize: 12.5 },
  itemSub: { marginTop: 3, fontFamily: FONTS.regular, color: COLORS.textFaint, fontSize: 11 },
  cats: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  cat: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  catOn: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  catText: { fontFamily: FONTS.bold, color: COLORS.text, fontSize: 12 },
  reason: {
    minHeight: 90, backgroundColor: COLORS.navyCard, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: COLORS.navyLine, color: COLORS.text, fontFamily: FONTS.regular,
    textAlignVertical: 'top', marginBottom: 14,
  },
  uploadSlot: {
    flexDirection: 'row', gap: 12, alignItems: 'center',
    backgroundColor: COLORS.navyCard, borderRadius: 14, padding: 14, marginBottom: 14,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.navyLine,
  },
  uploadTitle: { fontFamily: FONTS.bold, color: '#fff', fontSize: 12.5 },
  uploadSub: { marginTop: 3, fontFamily: FONTS.regular, color: COLORS.textFaint, fontSize: 11 },
  scope: {
    backgroundColor: 'rgba(61,220,151,0.08)', borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: 'rgba(61,220,151,0.25)',
  },
  scopeText: { fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 12, lineHeight: 18 },
  pastRow: {
    backgroundColor: COLORS.navyCard, borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  pastTitle: { fontFamily: FONTS.bold, color: '#fff', fontSize: 12 },
  pastSub: { marginTop: 3, fontFamily: FONTS.regular, color: COLORS.textFaint, fontSize: 11 },
  submitBtn: {
    marginTop: 18, paddingVertical: 16, borderRadius: 16, backgroundColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { fontFamily: FONTS.extraBold, color: COLORS.navy, fontSize: 15 },
});

export default StudioRevisionRequestScreen;
