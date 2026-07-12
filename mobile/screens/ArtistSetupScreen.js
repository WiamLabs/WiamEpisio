// © 2026 WiamApp. Powered by WiamLabs
// screens/ArtistSetupScreen.js — Star / Talent Pro (any bookable celebrity)

import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar,
  ScrollView, ActivityIndicator, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;
const NAVY = '#0D0D2B';
const GOLD = '#D4A017';
const WHITE = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.45)';
const BORDER = 'rgba(255,255,255,0.1)';

const TALENT_TYPES = [
  { id: 'musician', label: 'Musician / Band' },
  { id: 'actor', label: 'Actor / Actress' },
  { id: 'director', label: 'Director / Producer' },
  { id: 'dj', label: 'DJ' },
  { id: 'comedian', label: 'Comedian' },
  { id: 'dancer', label: 'Dancer / Choreographer' },
  { id: 'influencer', label: 'Influencer / Creator' },
  { id: 'speaker', label: 'Speaker / Host' },
  { id: 'model', label: 'Model' },
  { id: 'athlete', label: 'Athlete / Sports Star' },
  { id: 'specialty', label: 'Specialty Act' },
  { id: 'other', label: 'Other star / talent' },
];

export default function ArtistSetupScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [handle, setHandle] = useState('');
  const [stageName, setStageName] = useState('');
  const [talentType, setTalentType] = useState('musician');
  const [genres, setGenres] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [bandSize, setBandSize] = useState('1');
  const [isPublic, setIsPublic] = useState(true);
  const [paSystem, setPaSystem] = useState('');
  const [stageSize, setStageSize] = useState('');
  const [riderNotes, setRiderNotes] = useState('');
  const [publicUrl, setPublicUrl] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${BACKEND}/api/artists/me`, {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        const json = await res.json();
        if (json.artist) {
          const a = json.artist;
          setHandle(a.handle || '');
          setStageName(a.stage_name || '');
          setTalentType(a.talent_type || 'musician');
          setGenres((a.genres || []).join(', '));
          setBio(a.bio || '');
          setCity(a.city || '');
          setBandSize(String(a.band_size || 1));
          setIsPublic(a.is_public !== false);
          setPaSystem(a.rider_json?.pa_system || '');
          setStageSize(a.rider_json?.stage_size || '');
          setRiderNotes(a.rider_json?.notes || '');
          setPublicUrl(`https://wiamapp.com/m/${a.handle}`);
        }
      } catch (e) {
        console.warn(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${BACKEND}/api/artists/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          handle,
          stage_name: stageName,
          talent_type: talentType,
          genres,
          bio,
          city,
          band_size: bandSize,
          is_public: isPublic,
          rider_json: {
            pa_system: paSystem,
            stage_size: stageSize,
            notes: riderNotes,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      setPublicUrl(`https://wiamapp.com/m/${json.artist.handle}`);
      Alert.alert('Saved', 'Your Star Pro booking page is ready. Put the link in your bio.');
    } catch (e) {
      Alert.alert('Could not save', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator color={GOLD} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={WHITE} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Star Pro</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={s.tip}>
          For any bookable star — musicians, actors, directors, influencers, comedians, speakers and more.
          Fans stay on social; bookers pay deposits on WiamApp. Works worldwide.
        </Text>

        <Text style={s.label}>I am a…</Text>
        <View style={s.chips}>
          {TALENT_TYPES.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[s.chip, talentType === t.id && s.chipOn]}
              onPress={() => setTalentType(t.id)}
            >
              <Text style={[s.chipText, talentType === t.id && s.chipTextOn]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>Public handle</Text>
        <TextInput style={s.input} value={handle} onChangeText={setHandle} autoCapitalize="none" placeholder="e.g. yourname" placeholderTextColor={MUTED} />

        <Text style={s.label}>Stage / public name</Text>
        <TextInput style={s.input} value={stageName} onChangeText={setStageName} placeholder="Name on posters & bookings" placeholderTextColor={MUTED} />

        <Text style={s.label}>Tags (comma-separated)</Text>
        <TextInput style={s.input} value={genres} onChangeText={setGenres} placeholder="e.g. Afrobeats, Drama, Keynote, Fashion" placeholderTextColor={MUTED} />

        <Text style={s.label}>City / base (anywhere in the world)</Text>
        <TextInput style={s.input} value={city} onChangeText={setCity} placeholder="City, Country" placeholderTextColor={MUTED} />

        <Text style={s.label}>Team / band size</Text>
        <TextInput style={s.input} value={bandSize} onChangeText={setBandSize} keyboardType="number-pad" placeholderTextColor={MUTED} />

        <Text style={s.label}>Bio</Text>
        <TextInput style={[s.input, { height: 100, textAlignVertical: 'top' }]} value={bio} onChangeText={setBio} multiline placeholder="Short public bio" placeholderTextColor={MUTED} />

        <Text style={s.section}>Rider / hospitality</Text>
        <Text style={s.label}>Tech / set needs</Text>
        <TextInput style={s.input} value={paSystem} onChangeText={setPaSystem} placeholder="PA, cameras, lighting, green room…" placeholderTextColor={MUTED} />
        <Text style={s.label}>Stage / space size</Text>
        <TextInput style={s.input} value={stageSize} onChangeText={setStageSize} placeholder="e.g. 4x3m or studio day" placeholderTextColor={MUTED} />
        <Text style={s.label}>Other notes</Text>
        <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]} value={riderNotes} onChangeText={setRiderNotes} multiline placeholder="Load-in, power, travel, call sheet…" placeholderTextColor={MUTED} />

        <View style={s.row}>
          <Text style={s.rowLabel}>Public page visible</Text>
          <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: GOLD }} />
        </View>

        {!!publicUrl && (
          <Text style={s.url}>{publicUrl}</Text>
        )}

        <TouchableOpacity style={s.btn} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color={NAVY} /> : <Text style={s.btnText}>Save Star Pro page</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={s.linkBtn} onPress={() => navigation.navigate('ArtistPackages')}>
          <Text style={s.linkText}>Manage packages →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.linkBtn} onPress={() => navigation.navigate('AvailabilityCalendar')}>
          <Text style={s.linkText}>Availability & blackouts →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: NAVY },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: WHITE, fontSize: 17, fontWeight: '700' },
  body: { padding: 20, paddingBottom: 48 },
  tip: { color: MUTED, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  label: { color: MUTED, fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  section: { color: GOLD, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 22, marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { borderWidth: 1, borderColor: BORDER, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, marginBottom: 8 },
  chipOn: { backgroundColor: GOLD, borderColor: GOLD },
  chipText: { color: MUTED, fontSize: 12, fontWeight: '600' },
  chipTextOn: { color: NAVY },
  input: { backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: WHITE, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  rowLabel: { color: WHITE, fontSize: 14 },
  url: { color: GOLD, fontSize: 12, marginTop: 14 },
  btn: { backgroundColor: GOLD, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  btnText: { color: NAVY, fontWeight: '700', fontSize: 15 },
  linkBtn: { paddingVertical: 14 },
  linkText: { color: GOLD, fontSize: 14, fontWeight: '600' },
});
