import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import useAuthStore from '../../store/useAuthStore';

const CreatorApplyScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const inviteCode = route.params?.inviteCode || '';
  const openForm = !!route.params?.openForm;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const patchUser = useAuthStore((s) => s.patchUser);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || openForm || user?.is_creator) return;
    studioEpisioApi.getApply().then((d) => {
      if (d?.invite_only) {
        navigation.replace('CreatorApplyInviteOnly');
      }
    }).catch(() => {});
  }, [isAuthenticated, openForm, user?.is_creator, navigation]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const [form, setForm] = useState({
    legal_name: '',
    country: '',
    phone: '',
    channel_name: '',
    bio: '',
    genres: 'Drama',
    pitch: '',
    planned_episode_count: '20',
    sample_url: '',
    sample_type: 'link',
    rights_attested: false,
    complete_series_attested: false,
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  if (!isAuthenticated) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.empty}>Sign in to apply as a creator.</Text>
        <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.ctaText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (done) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={COLORS.gold} />
      </View>
    );
  }

  const next = async () => {
    setError(null);
    if (step === 0) {
      if (!form.channel_name.trim() || !form.legal_name.trim()) {
        setError('Name and channel required');
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      if ((form.pitch || '').trim().length < 10) {
        setError('Pitch must be at least 10 characters');
        return;
      }
      if (Number(form.planned_episode_count) < 20) {
        setError('Plan at least 20 episodes for your first series');
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!form.sample_url.trim()) {
        setError('Sample URL or past-work link required');
        return;
      }
      setStep(3);
      return;
    }
    if (!form.rights_attested || !form.complete_series_attested) {
      setError('You must accept both attestations');
      return;
    }
    setBusy(true);
    try {
      const data = await studioEpisioApi.submitApply({
        ...form,
        invite_code: inviteCode || undefined,
        planned_episode_count: Number(form.planned_episode_count) || 20,
        genres: form.genres.split(',').map((g) => g.trim()).filter(Boolean).slice(0, 3),
      });
      if (data.user) await patchUser(data.user);
      setDone(data.application || { status: 'pending' });
      navigation.replace('CreatorApplyAccepted', {
        status: data.application?.status || 'pending',
        message: data.message,
      });
    } catch (e) {
      setError(e?.message || 'Submit failed');
    } finally {
      setBusy(false);
    }
  };

  const stepLabels = ['Identity', 'Your Story', 'Sample Work', 'Rights'];

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top + 8 }]}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity style={styles.back} onPress={() => (step > 0 ? setStep(step - 1) : navigation.goBack())}>
        <ChevronLeft size={20} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={styles.stepLabel}>Step {step + 1} of 4 — {stepLabels[step]}</Text>
      <View style={styles.stepTrack}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.stepSeg, i <= step && styles.stepDone]} />
        ))}
      </View>
      <Text style={styles.title}>Become a Creator</Text>
      <Text style={styles.sub}>Quality-first. 9:16 · complete series required. Tell African stories — earn from every episode.</Text>

      {step === 0 ? (
        <>
          <Field label="Legal name" value={form.legal_name} onChangeText={(v) => set('legal_name', v)} />
          <Field label="Country" value={form.country} onChangeText={(v) => set('country', v)} />
          <Field label="Phone" value={form.phone} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" />
          <Field label="Channel name" value={form.channel_name} onChangeText={(v) => set('channel_name', v)} />
          <Field label="Bio" value={form.bio} onChangeText={(v) => set('bio', v)} multiline />
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Field label="Genres (comma, up to 3)" value={form.genres} onChangeText={(v) => set('genres', v)} />
          <Field label="First series pitch" value={form.pitch} onChangeText={(v) => set('pitch', v)} multiline />
          <Field label="Planned episodes (min 20)" value={form.planned_episode_count} onChangeText={(v) => set('planned_episode_count', v)} keyboardType="number-pad" />
          <Text style={styles.hint}>Each episode should run 4–5 minutes. Anything under 3 or over 6 minutes won't pass quality review.</Text>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Text style={styles.hint}>Paste a sample clip link, past work, or trailer draft (60–180s preferred). Must be 9:16 when you upload in Studio.</Text>
          <Field label="Sample URL" value={form.sample_url} onChangeText={(v) => set('sample_url', v)} autoCapitalize="none" />
        </>
      ) : null}

      {step === 3 ? (
        <>
          <ToggleRow
            label="I own or have rights to this content"
            value={form.rights_attested}
            onValueChange={(v) => set('rights_attested', v)}
          />
          <ToggleRow
            label="I will finish all planned episodes before public live"
            value={form.complete_series_attested}
            onValueChange={(v) => set('complete_series_attested', v)}
          />
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={styles.cta} onPress={next} disabled={busy}>
        {busy ? <ActivityIndicator color={COLORS.navy} /> : (
          <Text style={styles.ctaText}>{step === 3 ? 'Submit application' : `Next: ${stepLabels[step + 1] || 'Continue'}`}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const Field = ({ label, ...props }) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, props.multiline && { minHeight: 80, textAlignVertical: 'top' }]}
      placeholderTextColor={COLORS.textFaint}
      {...props}
    />
  </View>
);

const ToggleRow = ({ label, value, onValueChange }) => (
  <View style={styles.toggleRow}>
    <Text style={styles.toggleLabel}>{label}</Text>
    <Switch value={value} onValueChange={onValueChange} trackColor={{ true: COLORS.goldDark, false: COLORS.navyLine }} thumbColor={value ? COLORS.gold : '#888'} />
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  back: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  title: { fontSize: 22, fontFamily: FONTS.extraBold, color: COLORS.text },
  stepLabel: { fontSize: 11, fontFamily: FONTS.bold, color: COLORS.textFaint, marginBottom: 8 },
  stepTrack: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  stepSeg: { flex: 1, height: 4, borderRadius: 99, backgroundColor: COLORS.navyLine },
  stepDone: { backgroundColor: COLORS.gold },
  sub: { marginTop: 6, marginBottom: 18, color: COLORS.textDim, fontFamily: FONTS.regular, fontSize: 13 },
  label: { color: COLORS.textDim, fontFamily: FONTS.semi, fontSize: 11.5, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 12, padding: 13, color: COLORS.text, fontFamily: FONTS.regular,
  },
  hint: { color: COLORS.textDim, fontFamily: FONTS.regular, fontSize: 12.5, marginBottom: 12, lineHeight: 18 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14,
    backgroundColor: COLORS.navyCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  toggleLabel: { flex: 1, color: COLORS.text, fontFamily: FONTS.medium, fontSize: 13 },
  cta: { marginTop: 10, backgroundColor: COLORS.gold, borderRadius: 14, padding: 15, alignItems: 'center' },
  ctaText: { fontFamily: FONTS.bold, color: COLORS.navy },
  error: { color: COLORS.error, marginBottom: 8, fontFamily: FONTS.medium },
  empty: { color: COLORS.textFaint, fontFamily: FONTS.medium, textAlign: 'center' },
  link: { marginTop: 16, color: COLORS.gold, fontFamily: FONTS.semi },
});

export default CreatorApplyScreen;
