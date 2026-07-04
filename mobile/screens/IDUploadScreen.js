// © 2026 WiamApp. Powered by WiamLabs
// screens/IDUploadScreen.js
// Worker uploads ID front (and back if required)
// Uploads to Cloudflare R2 Private bucket via backend
// Step 2 of verification flow

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Image, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

const LOGO    = require('../assets/logo.png');
const BG      = '#0D0D2B';
const GOLD    = '#D4A017';
const WHITE   = '#FFFFFF';
const MUTED   = 'rgba(255,255,255,0.45)';
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function IDUploadScreen({ navigation, route }) {
  const { email, token, idType, idLabel, requiresBack } = route?.params || {};

  const [frontImage,  setFrontImage]  = useState(null);
  const [backImage,   setBackImage]   = useState(null);
  const [uploading,   setUploading]   = useState(false);
  const [error,       setError]       = useState('');

  const canContinue = frontImage && (!requiresBack || backImage);

  const pickImage = async (side) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setError('Please allow access to your photo library in Settings.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3],
      });
      if (!result.canceled && result.assets?.[0]) {
        if (side === 'front') setFrontImage(result.assets[0]);
        else setBackImage(result.assets[0]);
        setError('');
      }
    } catch {
      setError('Could not open photo library. Please try again.');
    }
  };

  const takePhoto = async (side) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        setError('Please allow camera access in Settings.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3],
      });
      if (!result.canceled && result.assets?.[0]) {
        if (side === 'front') setFrontImage(result.assets[0]);
        else setBackImage(result.assets[0]);
        setError('');
      }
    } catch {
      setError('Could not open camera. Please try again.');
    }
  };

  const handleContinue = async () => {
    if (!canContinue || uploading) return;
    setUploading(true);
    setError('');
    try {
      // Upload front
      const frontFormData = new FormData();
      frontFormData.append('document', {
        uri:  frontImage.uri,
        type: 'image/jpeg',
        name: `id_front_${Date.now()}.jpg`,
      });
      frontFormData.append('docType', 'id_front');
      frontFormData.append('idType',  idType);

      const frontRes = await fetch(`${BACKEND}/api/verification/upload-document`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    frontFormData,
      });
      const frontData = await frontRes.json();
      if (!frontRes.ok) throw new Error(frontData.error || 'Front upload failed.');

      let backKey = null;
      if (requiresBack && backImage) {
        const backFormData = new FormData();
        backFormData.append('document', {
          uri:  backImage.uri,
          type: 'image/jpeg',
          name: `id_back_${Date.now()}.jpg`,
        });
        backFormData.append('docType', 'id_back');
        backFormData.append('idType',  idType);

        const backRes = await fetch(`${BACKEND}/api/verification/upload-document`, {
          method:  'POST',
          headers: { Authorization: `Bearer ${token}` },
          body:    backFormData,
        });
        const backData = await backRes.json();
        if (!backRes.ok) throw new Error(backData.error || 'Back upload failed.');
        backKey = backData.key;
      }

      navigation.navigate('WorkerSelfie', {
        email, token, idType, idLabel,
        frontKey: frontData.key,
        backKey,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const ImageBox = ({ side, image, label }) => (
    <View style={s.imageBox}>
      <Text style={s.imageBoxLabel}>{label}</Text>
      {image ? (
        <View style={s.imagePreviewWrap}>
          <Image source={{ uri: image.uri }} style={s.imagePreview} resizeMode="cover" />
          <TouchableOpacity style={s.changeBtn} onPress={() => side === 'front' ? setFrontImage(null) : setBackImage(null)}>
            <Text style={s.changeBtnText}>Change</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.imageEmpty}>
          <Ionicons name="id-card-outline" size={28} color="rgba(255,255,255,0.2)" style={{ marginBottom: 12 }} />
          <Text style={s.imageEmptyText}>No image selected</Text>
          <View style={s.imageActions}>
            <TouchableOpacity style={s.imageActionBtn} onPress={() => takePhoto(side)}>
              <Ionicons name="camera-outline" size={16} color={GOLD} />
              <Text style={s.imageActionText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.imageActionBtn} onPress={() => pickImage(side)}>
              <Ionicons name="images-outline" size={16} color={GOLD} />
              <Text style={s.imageActionText}>Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={WHITE} />
        </TouchableOpacity>

        <View style={s.brand}>
          <Image source={LOGO} style={s.logo} resizeMode="contain" />
        </View>

        {/* Progress */}
        <View style={s.progress}>
          <View style={[s.progressStep, s.progressStepDone]} />
          <View style={[s.progressStep, s.progressStepDone]} />
          <View style={[s.progressStep, s.progressStepActive]} />
          <View style={s.progressStep} />
        </View>
        <Text style={s.progressLabel}>Step 2 of 3 — Upload {idLabel}</Text>

        <Text style={s.title}>Upload your {idLabel}</Text>
        <Text style={s.subtitle}>
          Take clear photos in good lighting.
          Make sure all text and numbers are readable.
        </Text>

        {/* Tips */}
        <View style={s.tipsRow}>
          {['Good lighting', 'All 4 corners visible', 'No glare or blur'].map((tip, i) => (
            <View key={i} style={s.tipChip}>
              <Ionicons name="checkmark-circle-outline" size={12} color={GOLD} />
              <Text style={s.tipText}>{tip}</Text>
            </View>
          ))}
        </View>

        {/* Front image */}
        <ImageBox side="front" image={frontImage} label="FRONT SIDE" />

        {/* Back image — only if required */}
        {requiresBack && (
          <ImageBox side="back" image={backImage} label="BACK SIDE" />
        )}

        {/* Error */}
        {error ? (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Continue */}
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
  subtitle: { color: MUTED, fontSize: 13, lineHeight: 20, marginBottom: 14 },

  tipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  tipChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(212,160,23,0.08)',
    borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5,
  },
  tipText: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },

  imageBox:      { marginBottom: 16 },
  imageBoxLabel: { color: MUTED, fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 8 },

  imagePreviewWrap: { borderRadius: 13, overflow: 'hidden', position: 'relative' },
  imagePreview:     { width: '100%', height: 180, borderRadius: 13 },
  changeBtn: {
    position: 'absolute', bottom: 10, right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  changeBtnText: { color: WHITE, fontSize: 12, fontWeight: '600' },

  imageEmpty: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed', borderRadius: 13,
    paddingVertical: 28, alignItems: 'center',
  },
  imageEmptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 13, marginBottom: 14 },
  imageActions:   { flexDirection: 'row', gap: 12 },
  imageActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(212,160,23,0.10)',
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9,
    borderWidth: 0.5, borderColor: 'rgba(212,160,23,0.25)',
  },
  imageActionText: { color: GOLD, fontSize: 13, fontWeight: '500' },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
    marginBottom: 14,
  },
  errorText: { color: '#EF4444', fontSize: 12, flex: 1 },

  continueBtn: {
    backgroundColor: GOLD, borderRadius: 13,
    paddingVertical: 15, alignItems: 'center',
    marginTop: 8, marginBottom: 16,
    flexDirection: 'row', justifyContent: 'center',
  },
  continueBtnDisabled: { backgroundColor: 'rgba(212,160,23,0.25)' },
  continueBtnText:     { color: BG, fontSize: 15, fontWeight: '700' },
  copyright: { color: 'rgba(212,160,23,0.3)', fontSize: 10, textAlign: 'center', letterSpacing: 0.5 },
});
