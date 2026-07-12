// © 2026 WiamApp. Powered by WiamLabs
// screens/ArtistBookingScreen.js — Customer books artist package + deposit

import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar,
  ScrollView, ActivityIndicator, Alert,
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

export default function ArtistBookingScreen({ navigation, route }) {
  const handle = route?.params?.handle;
  const [loading, setLoading] = useState(true);
  const [artist, setArtist] = useState(null);
  const [packages, setPackages] = useState([]);
  const [packageId, setPackageId] = useState(null);
  const [date, setDate] = useState('');
  const [venueType, setVenueType] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [address, setAddress] = useState('');
  const [riderAccepted, setRiderAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BACKEND}/api/artists/by-handle/${encodeURIComponent(handle)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Artist not found');
        setArtist(json.artist);
        setPackages(json.packages || []);
        if (json.packages?.[0]) setPackageId(json.packages[0].id);
      } catch (e) {
        Alert.alert('Error', e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [handle]);

  const selected = packages.find((p) => p.id === packageId);
  const deposit = selected
    ? Math.round((Number(selected.price) * Number(selected.deposit_pct) / 100) * 100) / 100
    : 0;

  const book = async () => {
    if (!packageId || !date.trim()) {
      Alert.alert('Required', 'Choose a package and date (YYYY-MM-DD).');
      return;
    }
    if (!riderAccepted) {
      Alert.alert('Tech rider', 'Please accept the tech rider / booking terms.');
      return;
    }
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Login required', 'Log in as a customer to book.');
        navigation.navigate('Login');
        return;
      }
      const res = await fetch(`${BACKEND}/api/artists/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          artist_id: artist.id,
          package_id: packageId,
          scheduled_date: date.trim(),
          venue_type: venueType,
          guest_count: guestCount,
          address,
          rider_accepted: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Booking failed');

      // Initiate deposit payment
      const payRes = await fetch(`${BACKEND}/api/payments/paystack/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          bookingId: json.booking.id,
          amount: json.deposit_amount,
          currency: json.currency || 'GHS',
          email: session.user.email,
        }),
      });
      const pay = await payRes.json();
      if (payRes.ok && pay.authorizationUrl) {
        navigation.navigate('WebView', { url: pay.authorizationUrl, title: 'Pay deposit' });
      } else {
        Alert.alert(
          'Gig requested',
          `Deposit of ${json.currency} ${json.deposit_amount} is due. Complete payment from Bookings.`,
        );
        navigation.navigate('CustomerApp');
      }
    } catch (e) {
      Alert.alert('Could not book', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator color={GOLD} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (!artist) {
    return (
      <SafeAreaView style={s.safe}>
        <Text style={{ color: WHITE, margin: 20 }}>Artist not found.</Text>
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
        <Text style={s.headerTitle}>Book {artist.stage_name}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.section}>Choose package</Text>
        {packages.map((pkg) => (
          <TouchableOpacity
            key={pkg.id}
            style={[s.pkg, packageId === pkg.id && s.pkgActive]}
            onPress={() => setPackageId(pkg.id)}
          >
            <Text style={s.pkgTitle}>{pkg.title}</Text>
            <Text style={s.pkgMeta}>{pkg.duration_min} min · {pkg.currency} {Number(pkg.price).toLocaleString()}</Text>
          </TouchableOpacity>
        ))}

        <Text style={s.label}>Date (YYYY-MM-DD)</Text>
        <TextInput style={s.input} value={date} onChangeText={setDate} placeholder="2026-08-15" placeholderTextColor={MUTED} autoCapitalize="none" />

        <Text style={s.label}>Venue type</Text>
        <TextInput style={s.input} value={venueType} onChangeText={setVenueType} placeholder="Wedding, church, corporate…" placeholderTextColor={MUTED} />

        <Text style={s.label}>Guest count</Text>
        <TextInput style={s.input} value={guestCount} onChangeText={setGuestCount} keyboardType="number-pad" placeholder="150" placeholderTextColor={MUTED} />

        <Text style={s.label}>Venue address</Text>
        <TextInput style={s.input} value={address} onChangeText={setAddress} placeholder="Where is the gig?" placeholderTextColor={MUTED} />

        <TouchableOpacity style={s.checkRow} onPress={() => setRiderAccepted(!riderAccepted)}>
          <Ionicons name={riderAccepted ? 'checkbox' : 'square-outline'} size={22} color={GOLD} />
          <Text style={s.checkText}>I accept the tech rider and booking terms</Text>
        </TouchableOpacity>

        {selected && (
          <Text style={s.deposit}>
            Deposit due now: {selected.currency} {deposit.toLocaleString()} ({selected.deposit_pct}%)
          </Text>
        )}

        <TouchableOpacity style={s.btn} onPress={book} disabled={submitting}>
          {submitting ? <ActivityIndicator color={NAVY} /> : <Text style={s.btnText}>Request gig & pay deposit</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: NAVY },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: WHITE, fontSize: 16, fontWeight: '700', maxWidth: '70%' },
  body: { padding: 20, paddingBottom: 40 },
  section: { color: GOLD, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 10 },
  pkg: { borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 14, marginBottom: 8 },
  pkgActive: { borderColor: GOLD, backgroundColor: 'rgba(212,160,23,0.1)' },
  pkgTitle: { color: WHITE, fontWeight: '700', fontSize: 15 },
  pkgMeta: { color: MUTED, fontSize: 12, marginTop: 4 },
  label: { color: MUTED, fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: WHITE, fontSize: 15 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  checkText: { color: WHITE, flex: 1, fontSize: 13, lineHeight: 18 },
  deposit: { color: GOLD, fontSize: 14, fontWeight: '700', marginTop: 16 },
  btn: { backgroundColor: GOLD, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 18 },
  btnText: { color: NAVY, fontWeight: '700', fontSize: 15 },
});
