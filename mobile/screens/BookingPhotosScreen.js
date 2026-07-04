// © 2026 WiamApp. Powered by WiamLabs
// screens/BookingPhotosScreen.js
// Before/after completion photos — proof of work, dispute protection,
// and free portfolio content for the worker.
// Backend: GET/POST /api/bookings/:id/photos

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getBookingPhotos, uploadBookingPhoto } from '../lib/api/disputes';

const NAVY    = '#0D0D2B';
const NAVY2   = '#12123A';
const GOLD    = '#D4A017';
const GOLD_BD = 'rgba(212,160,23,0.25)';
const WHITE   = '#FFFFFF';
const MUTED   = 'rgba(255,255,255,0.45)';
const BORDER  = 'rgba(255,255,255,0.08)';

export default function BookingPhotosScreen({ navigation, route }) {
  const { bookingId } = route.params || {};
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(null); // 'before' | 'after' | null

  const load = useCallback(async () => {
    try {
      const data = await getBookingPhotos(bookingId);
      setPhotos(data || []);
    } catch { } finally { setLoading(false); }
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  const addPhoto = async (phase) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera permission needed', 'Please allow camera access to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;

    setUploading(phase);
    try {
      await uploadBookingPhoto(bookingId, phase, result.assets[0].uri);
      await load();
    } catch (err) {
      Alert.alert('Upload failed', err.message);
    } finally {
      setUploading(null);
    }
  };

  const before = photos.filter((p) => p.phase === 'before');
  const after  = photos.filter((p) => p.phase === 'after');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={WHITE} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Job Photos</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={styles.noticeCard}>
          <Ionicons name="camera-outline" size={18} color={GOLD} />
          <Text style={styles.noticeText}>
            A quick before/after photo protects both sides if there's ever a disagreement,
            and doubles as portfolio proof of your work.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={GOLD} style={{ marginTop: 30 }} />
        ) : (
          <>
            <PhotoSection
              title="Before" photos={before} phase="before"
              uploading={uploading === 'before'} onAdd={() => addPhoto('before')}
            />
            <PhotoSection
              title="After" photos={after} phase="after"
              uploading={uploading === 'after'} onAdd={() => addPhoto('after')}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PhotoSection({ title, photos, uploading, onAdd }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.photoRow}>
        {photos.map((p) => (
          <Image key={p.id} source={{ uri: p.photo_url }} style={styles.photoThumb} />
        ))}
        <TouchableOpacity style={styles.addPhotoBtn} onPress={onAdd} disabled={uploading}>
          {uploading
            ? <ActivityIndicator color={GOLD} size="small" />
            : <Ionicons name="camera-outline" size={22} color={GOLD} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: WHITE, fontSize: 17, fontWeight: '700' },
  noticeCard: {
    flexDirection: 'row', gap: 10, backgroundColor: 'rgba(212,160,23,0.08)',
    borderWidth: 1, borderColor: GOLD_BD, borderRadius: 12, padding: 14, marginBottom: 24,
  },
  noticeText: { color: WHITE, fontSize: 12.5, flex: 1, lineHeight: 18 },
  sectionTitle: { color: WHITE, fontSize: 15, fontWeight: '700', marginBottom: 10 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoThumb: { width: 90, height: 90, borderRadius: 10, backgroundColor: NAVY2 },
  addPhotoBtn: {
    width: 90, height: 90, borderRadius: 10, borderWidth: 1, borderColor: GOLD_BD,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
  },
});
