// © 2026 WiamApp. Powered by WiamLabs
// screens/DisputeScreen.js
// File a dispute on a booking, attach evidence photos
// Backend: POST /api/disputes, POST /api/disputes/:id/evidence

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView,
  TextInput, Image, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { fileDispute, uploadDisputeEvidence } from '../lib/api/disputes';

const NAVY    = '#0D0D2B';
const NAVY2   = '#12123A';
const GOLD    = '#D4A017';
const GOLD_BD = 'rgba(212,160,23,0.25)';
const WHITE   = '#FFFFFF';
const MUTED   = 'rgba(255,255,255,0.45)';
const BORDER  = 'rgba(255,255,255,0.08)';
const RED     = '#EF4444';

const REASONS = [
  { key: 'work_not_done', label: 'Work wasn\u2019t completed' },
  { key: 'quality',       label: 'Poor quality of work' },
  { key: 'no_show',       label: 'The other side didn\u2019t show up' },
  { key: 'payment',       label: 'Payment issue' },
  { key: 'other',         label: 'Something else' },
];

export default function DisputeScreen({ navigation, route }) {
  const { bookingId } = route.params || {};
  const [reason, setReason] = useState(null);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7, allowsEditing: false,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPhotos((p) => [...p, result.assets[0].uri]);
    }
  };

  const removePhoto = (uri) => setPhotos((p) => p.filter((x) => x !== uri));

  const submit = async () => {
    if (!bookingId) {
      Alert.alert('Missing booking', 'No booking was passed to this screen.');
      return;
    }
    if (!reason) return Alert.alert('Pick a reason', 'Please select what went wrong.');
    if (description.trim().length < 10) {
      return Alert.alert('Add more detail', 'Please describe what happened in a bit more detail.');
    }

    setSubmitting(true);
    try {
      const dispute = await fileDispute({ bookingId, reason, description: description.trim() });
      for (const uri of photos) {
        try { await uploadDisputeEvidence(dispute.id, uri); } catch { /* keep going on partial failure */ }
      }
      Alert.alert(
        'Dispute filed',
        'Payment is on hold and our team will review this booking. We\u2019ll notify you once it\u2019s resolved.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      Alert.alert('Could not file dispute', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={WHITE} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report an Issue</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={styles.noticeCard}>
          <Ionicons name="alert-circle-outline" size={20} color={GOLD} />
          <Text style={styles.noticeText}>
            Filing a dispute pauses the payout for this booking until our team reviews it.
            Please only use this if something genuinely went wrong.
          </Text>
        </View>

        <Text style={styles.label}>What happened?</Text>
        {REASONS.map((r) => (
          <TouchableOpacity
            key={r.key}
            style={[styles.reasonRow, reason === r.key && styles.reasonRowActive]}
            onPress={() => setReason(r.key)}
          >
            <View style={[styles.radio, reason === r.key && styles.radioActive]} />
            <Text style={styles.reasonLabel}>{r.label}</Text>
          </TouchableOpacity>
        ))}

        <Text style={[styles.label, { marginTop: 20 }]}>Describe what happened</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Give as much detail as you can — dates, what was agreed, what actually happened..."
          placeholderTextColor={MUTED}
          multiline
          numberOfLines={6}
          value={description}
          onChangeText={setDescription}
        />

        <Text style={[styles.label, { marginTop: 20 }]}>Evidence (optional but helpful)</Text>
        <View style={styles.photoRow}>
          {photos.map((uri) => (
            <View key={uri} style={styles.photoThumbWrap}>
              <Image source={{ uri }} style={styles.photoThumb} />
              <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removePhoto(uri)}>
                <Ionicons name="close" size={14} color={WHITE} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addPhotoBtn} onPress={pickPhoto}>
            <Ionicons name="camera-outline" size={22} color={GOLD} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={submit}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color={NAVY} />
            : <Text style={styles.submitBtnText}>Submit dispute</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
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
    borderWidth: 1, borderColor: GOLD_BD, borderRadius: 12, padding: 14, marginBottom: 20,
  },
  noticeText: { color: WHITE, fontSize: 12.5, flex: 1, lineHeight: 18 },
  label: { color: WHITE, fontSize: 14, fontWeight: '700', marginBottom: 10 },
  reasonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: NAVY2, borderWidth: 1, borderColor: BORDER, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13, marginBottom: 8,
  },
  reasonRowActive: { borderColor: GOLD_BD, backgroundColor: 'rgba(212,160,23,0.08)' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: MUTED },
  radioActive: { borderColor: GOLD, backgroundColor: GOLD },
  reasonLabel: { color: WHITE, fontSize: 14 },
  textArea: {
    backgroundColor: NAVY2, borderWidth: 1, borderColor: BORDER, borderRadius: 12,
    padding: 14, color: WHITE, fontSize: 14, minHeight: 120, textAlignVertical: 'top',
  },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoThumbWrap: { position: 'relative' },
  photoThumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: NAVY2 },
  removePhotoBtn: {
    position: 'absolute', top: -6, right: -6, backgroundColor: RED,
    width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  addPhotoBtn: {
    width: 72, height: 72, borderRadius: 10, borderWidth: 1, borderColor: GOLD_BD,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
  },
  submitBtn: {
    backgroundColor: GOLD, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 28,
  },
  submitBtnText: { color: NAVY, fontWeight: '800', fontSize: 15 },
});
