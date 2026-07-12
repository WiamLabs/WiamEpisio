// © 2026 WiamApp. Powered by WiamLabs
// screens/ArtistPackagesScreen.js — Musician Pro packages CRUD

import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;
const NAVY = '#0D0D2B';
const GOLD = '#D4A017';
const WHITE = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.45)';
const BORDER = 'rgba(255,255,255,0.1)';

export default function ArtistPackagesScreen({ navigation }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('60');
  const [depositPct, setDepositPct] = useState('30');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${BACKEND}/api/artists/me`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      setPackages((json.packages || []).filter((p) => p.is_active !== false));
    } catch (e) {
      console.warn(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addPackage = async () => {
    if (!title.trim() || !price) {
      Alert.alert('Required', 'Title and price are required.');
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${BACKEND}/api/artists/me/packages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description,
          duration_min: duration,
          price,
          deposit_pct: depositPct,
          currency: 'GHS',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setTitle(''); setPrice(''); setDescription('');
      await load();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const archive = async (id) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${BACKEND}/api/artists/me/packages/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      await load();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={WHITE} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Packages</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? <ActivityIndicator color={GOLD} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={s.body}>
          {packages.map((pkg) => (
            <View key={pkg.id} style={s.card}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{pkg.title}</Text>
                <Text style={s.cardMeta}>{pkg.duration_min} min · {pkg.deposit_pct}% deposit</Text>
                <Text style={s.cardPrice}>{pkg.currency} {Number(pkg.price).toLocaleString()}</Text>
              </View>
              <TouchableOpacity onPress={() => archive(pkg.id)}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}

          <Text style={s.section}>New package</Text>
          <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="e.g. Wedding 3 hours" placeholderTextColor={MUTED} />
          <TextInput style={s.input} value={description} onChangeText={setDescription} placeholder="What's included" placeholderTextColor={MUTED} />
          <TextInput style={s.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="Price (GHS)" placeholderTextColor={MUTED} />
          <TextInput style={s.input} value={duration} onChangeText={setDuration} keyboardType="number-pad" placeholder="Duration minutes" placeholderTextColor={MUTED} />
          <TextInput style={s.input} value={depositPct} onChangeText={setDepositPct} keyboardType="decimal-pad" placeholder="Deposit %" placeholderTextColor={MUTED} />

          <TouchableOpacity style={s.btn} onPress={addPackage} disabled={saving}>
            {saving ? <ActivityIndicator color={NAVY} /> : <Text style={s.btnText}>Add package</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: NAVY },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: WHITE, fontSize: 17, fontWeight: '700' },
  body: { padding: 20, paddingBottom: 40 },
  card: { flexDirection: 'row', gap: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 14, marginBottom: 10 },
  cardTitle: { color: WHITE, fontSize: 16, fontWeight: '700' },
  cardMeta: { color: MUTED, fontSize: 12, marginTop: 4 },
  cardPrice: { color: GOLD, fontSize: 15, fontWeight: '700', marginTop: 6 },
  section: { color: GOLD, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 20, marginBottom: 10 },
  input: { backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: WHITE, fontSize: 15, marginBottom: 10 },
  btn: { backgroundColor: GOLD, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  btnText: { color: NAVY, fontWeight: '700', fontSize: 15 },
});
