// © 2026 WiamApp. Powered by WiamLabs
// screens/CustomerIDUploadScreen.js
// Smart card type detection — auto shows back side only when needed
// Reuses same R2 Private upload endpoint as worker verification

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Image, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BrandLogo from '../components/BrandLogo';
import * as ImagePicker from 'expo-image-picker';

const BG      = '#0D0D2B';
const GOLD    = '#D4A017';
const WHITE   = '#FFFFFF';
const MUTED   = 'rgba(255,255,255,0.45)';
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

const ID_TYPES = [
  { id: 'ghana_card',     label: 'Ghana Card',     requiresBack: true  },
  { id: 'passport',       label: 'Passport',       requiresBack: false },
  { id: 'driver_license', label: 'Driver License', requiresBack: true  },
  { id: 'voter_id',       label: 'Voter ID',       requiresBack: false },
];

const UploadBox = ({ label, image, onCamera, onGallery, onClear }) => (
  <View style={s.uploadBox}>
    <Text style={s.uploadBoxLabel}>{label}</Text>
    {image ? (
      <View style={s.previewWrap}>
        <Image source={{ uri: image.uri }} style={s.preview} resizeMode="cover" />
        <TouchableOpacity style={s.clearBtn} onPress={onClear}>
          <Ionicons name="close-circle" size={22} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </View>
    ) : (
      <View style={s.emptyBox}>
        <Ionicons name="id-card-outline" size={26} color="rgba(255,255,255,0.18)" style={{ marginBottom: 10 }} />
        <Text style={s.emptyText}>No photo selected</Text>
        <View style={s.uploadActions}>
          <TouchableOpacity style={s.uploadBtn} onPress={onCamera}>
            <Ionicons name="camera-outline" size={15} color={GOLD} />
            <Text style={s.uploadBtnText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.uploadBtn} onPress={onGallery}>
            <Ionicons name="images-outline" size={15} color={GOLD} />
            <Text style={s.uploadBtnText}>Gallery</Text>
          </TouchableOpacity>
        </View>
      </View>
    )}
  </View>
);

export default function CustomerIDUploadScreen({ navigation, route }) {
  const { bookingData, token } = route?.params || {};

  const [selectedType, setSelectedType] = useState(null);
  const [frontImage,   setFrontImage]   = useState(null);
  const [backImage,    setBackImage]    = useState(null);
  const [uploading,    setUploading]    = useState(false);
  const [error,        setError]        = useState('');

  const currentType  = ID_TYPES.find(t => t.id === selectedType);
  const requiresBack = currentType?.requiresBack || false;
  const canContinue  = selectedType && frontImage && (!requiresBack || backImage);

  const pickImage = async (side) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { setError('Allow photo library access in Settings.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85, allowsEditing: true, aspect: [4, 3],
    });
    if (!result.canceled && result.assets?.[0]) {
      side === 'front' ? setFrontImage(result.assets[0]) : setBackImage(result.assets[0]);
      setError('');
    }
  };

  const takePhoto = async (side) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { setError('Allow camera access in Settings.'); return; }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85, allowsEditing: true, aspect: [4, 3],
    });
    if (!result.canceled && result.assets?.[0]) {
      side === 'front' ? setFrontImage(result.assets[0]) : setBackImage(result.assets[0]);
      setError('');
    }
  };

  const handleContinue = async () => {
    if (!canContinue || uploading) return;
    setUploading(true);
    setError('');
    try {
      // Upload front
      const frontForm = new FormData();
      frontForm.append('document', { uri: frontImage.uri, type: 'image/jpeg', name: `cust_id_front_${Date.now()}.jpg` });
      frontForm.append('docType', 'id_front');
      frontForm.append('idType',  selectedType);
      const frontRes = await fetch(`${BACKEND}/api/verification/upload-document`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: frontForm,
      });
      const frontData = await frontRes.json();
      if (!frontRes.ok) throw new Error(frontData.error || 'Front upload failed.');

      navigation.navigate('CustomerSelfie', {
        bookingData, token,
        idType:   selectedType,
        frontKey: frontData.key,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={WHITE} />
        </TouchableOpacity>

        <View style={s.brand}>
          <BrandLogo size="md" />
        </View>

        {/* Progress */}
        <View style={s.progress}>
          <View style={[s.progressStep, s.progressStepDone]} />
          <View style={[s.progressStep, s.progressStepActive]} />
          <View style={s.progressStep} />
        </View>
        <Text style={s.progressLabel}>Step 1 of 2 — Upload your ID</Text>

        <Text style={s.title}>Upload your ID</Text>
        <Text style={s.subtitle}>Choose your ID type then upload clear photos.</Text>

        {/* ID type selector */}
        <Text style={s.label}>SELECT ID TYPE</Text>
        <View style={s.typeGrid}>
          {ID_TYPES.map(type => (
            <TouchableOpacity
              key={type.id}
              style={[s.typeChip, selectedType === type.id && s.typeChipActive]}
              onPress={() => { setSelectedType(type.id); setFrontImage(null); setBackImage(null); }}
            >
              <Text style={[s.typeChipText, selectedType === type.id && s.typeChipTextActive]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Upload boxes — only show after type selected */}
        {selectedType && (
          <>
            <UploadBox
              label="FRONT SIDE"
              image={frontImage}
              onCamera={() => takePhoto('front')}
              onGallery={() => pickImage('front')}
              onClear={() => setFrontImage(null)}
            />
            {requiresBack && (
              <UploadBox
                label="BACK SIDE"
                image={backImage}
                onCamera={() => takePhoto('back')}
                onGallery={() => pickImage('back')}
                onClear={() => setBackImage(null)}
              />
            )}
          </>
        )}

        {error ? (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[s.continueBtn, (!canContinue || uploading) && s.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={!canContinue || uploading}
          activeOpacity={0.85}
        >
          {uploading
            ? <ActivityIndicator color={BG} />
            : <>
                <Text style={s.continueBtnText}>Continue to Selfie</Text>
                {canContinue && <Ionicons name="arrow-forward" size={16} color={BG} style={{ marginLeft: 6 }} />}
              </>
          }
        </TouchableOpacity>

        <Text style={s.copyright}>© 2026 WiamApp · Powered by WiamLabs</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: BG },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  backBtn:   { marginTop: 16, marginBottom: 8, width: 40 },
  brand:     { alignItems: 'center', marginBottom: 12 },
  logo:      { width: 44, height: 44 },

  progress:           { flexDirection: 'row', gap: 6, marginBottom: 6 },
  progressStep:       { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)' },
  progressStepDone:   { backgroundColor: GOLD },
  progressStepActive: { backgroundColor: 'rgba(212,160,23,0.5)' },
  progressLabel:      { color: MUTED, fontSize: 11, marginBottom: 18 },

  title:    { color: WHITE, fontSize: 20, fontWeight: '700', marginBottom: 6 },
  subtitle: { color: MUTED, fontSize: 13, lineHeight: 20, marginBottom: 20 },

  label: { color: MUTED, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10 },

  typeGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  typeChip:          { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  typeChipActive:    { backgroundColor: 'rgba(212,160,23,0.12)', borderColor: GOLD },
  typeChipText:      { color: MUTED, fontSize: 13, fontWeight: '500' },
  typeChipTextActive:{ color: GOLD, fontWeight: '600' },

  uploadBox:      { marginBottom: 16 },
  uploadBoxLabel: { color: MUTED, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },

  previewWrap: { position: 'relative', borderRadius: 13, overflow: 'hidden' },
  preview:     { width: '100%', height: 170, borderRadius: 13 },
  clearBtn:    { position: 'absolute', top: 8, right: 8 },

  emptyBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed', borderRadius: 13,
    paddingVertical: 26, alignItems: 'center',
  },
  emptyText:     { color: 'rgba(255,255,255,0.3)', fontSize: 13, marginBottom: 14 },
  uploadActions: { flexDirection: 'row', gap: 10 },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(212,160,23,0.10)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 0.5, borderColor: 'rgba(212,160,23,0.25)',
  },
  uploadBtnText: { color: GOLD, fontSize: 13, fontWeight: '500' },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 14,
  },
  errorText: { color: '#EF4444', fontSize: 12, flex: 1 },

  continueBtn: {
    backgroundColor: GOLD, borderRadius: 13, paddingVertical: 15,
    alignItems: 'center', marginTop: 8, marginBottom: 16,
    flexDirection: 'row', justifyContent: 'center',
  },
  continueBtnDisabled: { backgroundColor: 'rgba(212,160,23,0.25)' },
  continueBtnText:     { color: BG, fontSize: 15, fontWeight: '700' },
  copyright: { color: 'rgba(212,160,23,0.3)', fontSize: 10, textAlign: 'center', letterSpacing: 0.5 },
});
