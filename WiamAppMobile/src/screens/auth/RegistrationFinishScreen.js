import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
  Switch,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import authApi from '../../api/auth';
import useAuthStore from '../../store/useAuthStore';
import CircularCropModal from '../../components/common/CircularCropModal';
import BrandToast from '../../components/common/BrandToast';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';

const STEPS = 2;

const RegistrationFinishScreen = () => {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const patchUser = useAuthStore((s) => s.patchUser);
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState(1);
  const [localPreview, setLocalPreview] = useState(null);
  const [cropUri, setCropUri] = useState(null);
  const [showCrop, setShowCrop] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState('');

  const [bio, setBio] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [showPronouns, setShowPronouns] = useState(false);
  const [saving, setSaving] = useState(false);

  const serverAvatar = user?.avatar_url || null;
  const hasAvatar = !!(serverAvatar || localPreview);

  const persistAvatarOnUser = async (absoluteUrl) => {
    if (!absoluteUrl || !token) return;
    await setAuth({ ...user, avatar_url: absoluteUrl }, token);
  };

  const pickAndCrop = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setToast('Photo access is needed to set your profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
    });
    if (result.canceled) return;
    const uri = result.assets?.[0]?.uri;
    if (!uri) return;
    setCropUri(uri);
    setShowCrop(true);
  };

  const onCropSave = async (croppedUri) => {
    setShowCrop(false);
    setCropUri(null);
    setLocalPreview(croppedUri);
    setUploading(true);
    try {
      const res = await authApi.uploadAvatar(croppedUri);
      const url = res?.avatar_url;
      if (url) await persistAvatarOnUser(url);
    } catch (e) {
      setLocalPreview(null);
      setToast(typeof e === 'string' ? e : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const goNextFromAvatar = () => {
    if (!hasAvatar) {
      setToast('Add a profile photo to continue.');
      return;
    }
    setStep(2);
  };

  const finish = async () => {
    if (!hasAvatar) {
      setToast('Add a profile photo first.');
      return;
    }
    setSaving(true);
    try {
      const res = await authApi.updateProfile({
        bio: (bio || '').trim(),
        pronouns: (pronouns || '').trim(),
        showPronouns,
      });
      if (res?.user) await patchUser(res.user);
      const done = await authApi.completeRegistration();
      if (done?.user) await patchUser(done.user);
    } catch (e) {
      setToast(typeof e === 'string' ? e : 'Could not finish. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient
        colors={[
          'rgba(212, 168, 67, 0.16)',
          'rgba(114, 47, 55, 0.12)',
          COLORS.background,
        ]}
        style={styles.glow}
        pointerEvents="none"
      />

      <View style={styles.topRow}>
        <View style={styles.stepDots}>
          {Array.from({ length: STEPS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i + 1 === step ? styles.dotActive : null,
                i + 1 < step ? styles.dotDone : null,
              ]}
            />
          ))}
        </View>
        <Text style={styles.stepLabel}>
          Almost there · Step {step} of {STEPS}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 ? (
            <View>
              <Text style={styles.eyebrow}>Profile photo</Text>
              <Text style={styles.title}>Put a face to your reading</Text>
              <Text style={styles.subtitle}>
                Readers see this on your comments and profile. You can change it any time.
              </Text>

              <View style={styles.avatarWrap}>
                <TouchableOpacity
                  style={styles.avatarTouch}
                  onPress={pickAndCrop}
                  disabled={uploading}
                  activeOpacity={0.85}
                >
                  {localPreview || serverAvatar ? (
                    <Image
                      source={{ uri: localPreview || serverAvatar }}
                      style={styles.avatarImg}
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Camera size={36} color={COLORS.textMuted} />
                    </View>
                  )}
                  {uploading ? (
                    <View style={styles.uploadOverlay}>
                      <ActivityIndicator color={COLORS.secondary} />
                    </View>
                  ) : null}
                </TouchableOpacity>
                <Text style={styles.avatarHint}>Tap to choose · JPG or PNG</Text>
              </View>
            </View>
          ) : null}

          {step === 2 ? (
            <View>
              <Text style={styles.eyebrow}>About you</Text>
              <Text style={styles.title}>A few words about your taste</Text>
              <Text style={styles.subtitle}>
                Optional. Skip anything you would rather keep private.
              </Text>

              <View style={styles.formCard}>
                <Text style={styles.fieldLabel}>Bio</Text>
                <TextInput
                  style={[styles.input, styles.bioInput]}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="What kinds of stories do you love most?"
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                />

                <Text style={styles.fieldLabel}>Pronouns</Text>
                <TextInput
                  style={styles.input}
                  value={pronouns}
                  onChangeText={setPronouns}
                  placeholder="e.g. she/her, he/him, they/them"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="none"
                />

                {Platform.OS === 'ios' ? (
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Show pronouns on my profile</Text>
                    <Switch
                      value={showPronouns}
                      onValueChange={setShowPronouns}
                      trackColor={{ true: COLORS.secondary }}
                    />
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.switchRow}
                    onPress={() => setShowPronouns((v) => !v)}
                  >
                    <Text style={styles.switchLabel}>Show pronouns on my profile</Text>
                    <Text style={styles.switchValue}>{showPronouns ? 'On' : 'Off'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {step > 1 ? (
            <TouchableOpacity
              onPress={() => setStep(1)}
              hitSlop={10}
              style={styles.backBtn}
            >
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 64 }} />
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, !hasAvatar && step === 1 && styles.primaryBtnDisabled]}
            onPress={step === 1 ? goNextFromAvatar : finish}
            disabled={(step === 1 && !hasAvatar) || saving}
            activeOpacity={0.9}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.black} />
            ) : (
              <Text style={styles.primaryBtnText}>
                {step === 1 ? 'Continue' : 'Finish and continue'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <CircularCropModal
        visible={showCrop}
        imageUri={cropUri}
        onCancel={() => {
          setShowCrop(false);
          setCropUri(null);
        }}
        onSave={onCropSave}
      />
      <BrandToast message={toast} onClear={() => setToast('')} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 360 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  stepDots: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 22,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  dotActive: { backgroundColor: COLORS.secondary, width: 28 },
  dotDone: { backgroundColor: 'rgba(212,168,67,0.5)' },
  stepLabel: { color: COLORS.textMuted, fontSize: 12 },
  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  eyebrow: {
    color: COLORS.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  title: {
    color: COLORS.text,
    fontFamily: FONTS.display,
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  avatarWrap: { alignItems: 'center', marginTop: SPACING.lg },
  avatarTouch: {
    width: 144,
    height: 144,
    borderRadius: 72,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(212, 168, 67, 0.45)',
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarHint: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: SPACING.sm,
  },
  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginTop: SPACING.lg,
  },
  fieldLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: SPACING.md,
  },
  bioInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  switchLabel: { color: COLORS.text, fontSize: 14, flex: 1, marginRight: 12 },
  switchValue: { color: COLORS.secondary, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    paddingTop: SPACING.sm,
    gap: SPACING.md,
  },
  backBtn: { paddingVertical: 10, paddingRight: 8 },
  backText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '600' },
  primaryBtn: {
    flex: 1,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.secondary,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.55 },
  primaryBtnText: { color: COLORS.black, fontWeight: '700', fontSize: 15 },
});

export default RegistrationFinishScreen;
