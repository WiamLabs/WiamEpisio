// © 2026 WiamApp. Powered by WiamLabs
// screens/WorkerSelfieScreen.js
// Live camera selfie — face match with ID photo
// Step 3 of verification flow

import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BrandLogo from '../components/BrandLogo';
import { CameraView, useCameraPermissions } from 'expo-camera';

const BG      = '#0D0D2B';
const GOLD    = '#D4A017';
const WHITE   = '#FFFFFF';
const MUTED   = 'rgba(255,255,255,0.45)';
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function WorkerSelfieScreen({ navigation, route }) {
  const { email, token, idType, frontKey, backKey } = route?.params || {};

  const [permission, requestPermission] = useCameraPermissions();
  const [selfieUri,   setSelfieUri]   = useState(null);
  const [uploading,   setUploading]   = useState(false);
  const [error,       setError]       = useState('');
  const [showCamera,  setShowCamera]  = useState(false);
  const cameraRef = useRef(null);

  const takeSelfie = async () => {
    try {
      if (!permission?.granted) {
        const result = await requestPermission();
        if (!result.granted) {
          setError('Camera access required. Please allow it in Settings.');
          return;
        }
      }
      setShowCamera(true);
    } catch {
      setError('Could not open camera. Please try again.');
    }
  };

  const capturePhoto = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
      if (photo) {
        setSelfieUri(photo.uri);
        setShowCamera(false);
        setError('');
      }
    } catch {
      setError('Could not capture photo. Please try again.');
    }
  };

  const handleSubmit = async () => {
    if (!selfieUri || uploading) return;
    setUploading(true);
    setError('');
    try {
      // Upload selfie
      const formData = new FormData();
      formData.append('document', {
        uri:  selfieUri,
        type: 'image/jpeg',
        name: `selfie_${Date.now()}.jpg`,
      });
      formData.append('docType', 'selfie');

      const selfieRes = await fetch(`${BACKEND}/api/verification/upload-document`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    formData,
      });
      const selfieData = await selfieRes.json();
      if (!selfieRes.ok) throw new Error(selfieData.error || 'Selfie upload failed.');

      // Submit full verification to admin queue
      const submitRes = await fetch(`${BACKEND}/api/verification/submit-worker`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({
          idType,
          frontKey,
          backKey,
          selfieKey: selfieData.key,
        }),
      });
      const submitData = await submitRes.json();
      if (!submitRes.ok) throw new Error(submitData.error || 'Submission failed.');

      navigation.replace('VerificationPending', { email, role: 'worker' });
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Camera view
  if (showCamera) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing="front"
        >
          {/* Oval face guide */}
          <View style={s.cameraOverlay}>
            <View style={s.faceGuide} />
            <Text style={s.cameraInstruction}>
              Look straight at the camera{'\n'}Keep your face inside the oval
            </Text>
            <TouchableOpacity style={s.captureBtn} onPress={capturePhoto}>
              <View style={s.captureBtnInner} />
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelCamera} onPress={() => setShowCamera(false)}>
              <Text style={s.cancelCameraText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <View style={s.container}>

        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={WHITE} />
        </TouchableOpacity>

        <View style={s.brand}>
          <BrandLogo size="md" />
        </View>

        {/* Progress */}
        <View style={s.progress}>
          {[0,1,2,3].map(i => (
            <View key={i} style={[s.progressStep, i < 3 ? s.progressStepDone : s.progressStepActive]} />
          ))}
        </View>
        <Text style={s.progressLabel}>Step 3 of 3 — Take a selfie</Text>

        <Text style={s.title}>Take a live selfie</Text>
        <Text style={s.subtitle}>
          We will compare your face to your ID photo.
          Use the front camera in good lighting.
        </Text>

        {/* Tips */}
        <View style={s.tipsList}>
          {[
            'Remove sunglasses and hats',
            'Face the camera directly',
            'Good natural lighting',
            'No filters or editing',
          ].map((tip, i) => (
            <View key={i} style={s.tipRow}>
              <Ionicons name="checkmark-circle-outline" size={14} color={GOLD} />
              <Text style={s.tipText}>{tip}</Text>
            </View>
          ))}
        </View>

        {/* Selfie preview or placeholder */}
        {selfieUri ? (
          <View style={s.selfiePreviewWrap}>
            <Image source={{ uri: selfieUri }} style={s.selfiePreview} />
            <View style={s.selfieApproved}>
              <Ionicons name="checkmark-circle" size={22} color="#22C55E" />
              <Text style={s.selfieApprovedText}>Selfie captured</Text>
            </View>
            <TouchableOpacity style={s.retakeBtn} onPress={() => setSelfieUri(null)}>
              <Text style={s.retakeBtnText}>Retake</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={s.selfieEmpty} onPress={takeSelfie} activeOpacity={0.8}>
            <View style={s.selfieEmptyFace}>
              <Ionicons name="person-circle-outline" size={48} color="rgba(255,255,255,0.2)" />
            </View>
            <View style={s.selfieEmptyBtn}>
              <Ionicons name="camera-outline" size={18} color={BG} />
              <Text style={s.selfieEmptyBtnText}>Open Camera</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Error */}
        {error ? (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Submit */}
        <TouchableOpacity
          style={[s.submitBtn, (!selfieUri || uploading) && s.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!selfieUri || uploading}
          activeOpacity={0.85}
        >
          {uploading
            ? <ActivityIndicator color={BG} />
            : <>
                <Text style={s.submitBtnText}>Submit for Review</Text>
                {selfieUri && <Ionicons name="arrow-forward" size={16} color={BG} style={{ marginLeft: 6 }} />}
              </>
          }
        </TouchableOpacity>

        <Text style={s.copyright}>© 2026 WiamApp · Powered by WiamLabs</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: BG },
  container: { flex: 1, paddingHorizontal: 24, paddingBottom: 30 },
  backBtn:   { marginTop: 16, marginBottom: 8, width: 40 },
  brand:     { alignItems: 'center', marginBottom: 12 },
  logo:      { width: 44, height: 44 },

  progress:           { flexDirection: 'row', gap: 6, marginBottom: 6 },
  progressStep:       { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)' },
  progressStepDone:   { backgroundColor: GOLD },
  progressStepActive: { backgroundColor: 'rgba(212,160,23,0.5)' },
  progressLabel:      { color: MUTED, fontSize: 11, marginBottom: 16 },

  title:    { color: WHITE, fontSize: 20, fontWeight: '700', marginBottom: 6 },
  subtitle: { color: MUTED, fontSize: 13, lineHeight: 20, marginBottom: 16 },

  tipsList: { marginBottom: 20, gap: 8 },
  tipRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipText:  { color: 'rgba(255,255,255,0.6)', fontSize: 13 },

  selfiePreviewWrap: { alignItems: 'center', marginBottom: 16 },
  selfiePreview: {
    width: 160, height: 160, borderRadius: 80,
    borderWidth: 3, borderColor: GOLD,
  },
  selfieApproved: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, marginBottom: 8,
  },
  selfieApprovedText: { color: '#22C55E', fontSize: 13, fontWeight: '500' },
  retakeBtn: {
    paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 8, borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  retakeBtnText: { color: MUTED, fontSize: 13 },

  selfieEmpty: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed', borderRadius: 14,
    paddingVertical: 28, alignItems: 'center', marginBottom: 16,
  },
  selfieEmptyFace: { marginBottom: 14 },
  selfieEmptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: GOLD, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 11,
  },
  selfieEmptyBtnText: { color: BG, fontSize: 14, fontWeight: '600' },

  // Camera overlay
  cameraOverlay: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  faceGuide: {
    width: 220, height: 280, borderRadius: 110,
    borderWidth: 2, borderColor: GOLD,
    borderStyle: 'dashed', marginBottom: 20,
  },
  cameraInstruction: {
    color: WHITE, fontSize: 14, textAlign: 'center',
    lineHeight: 22, marginBottom: 30,
  },
  captureBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  captureBtnInner: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: WHITE,
  },
  cancelCamera:     { marginTop: 10 },
  cancelCameraText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
    marginBottom: 14,
  },
  errorText: { color: '#EF4444', fontSize: 12, flex: 1 },

  submitBtn: {
    backgroundColor: GOLD, borderRadius: 13,
    paddingVertical: 15, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', marginBottom: 16,
  },
  submitBtnDisabled: { backgroundColor: 'rgba(212,160,23,0.25)' },
  submitBtnText:     { color: BG, fontSize: 15, fontWeight: '700' },
  copyright: { color: 'rgba(212,160,23,0.3)', fontSize: 10, textAlign: 'center', letterSpacing: 0.5 },
});
