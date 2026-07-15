// © 2026 WiamApp. Powered by WiamLabs
// screens/CustomerEditProfileScreen.js
// Real profile editing for customers — name, phone, city, avatar, cover photo.

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar,
  ScrollView, Image, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Colors } from '../constants/colors';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { uploadImage } from '../lib/api/uploads';
import { confirmLocationSetup } from '../lib/locationWarning';
import { reverseGeocodePlace } from '../lib/reverseGeocode';
import GoldAvatar from '../components/ui/GoldAvatar';

const PAD = Colors.screenPad;

function FieldGroup({ label, icon, children, locked, note }) {
  return (
    <View style={s.fieldGroup}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={[s.fieldBox, locked && s.fieldBoxLocked]}>
        {icon ? <Ionicons name={icon} size={15} color={Colors.gold} /> : null}
        {children}
      </View>
      {note ? <Text style={s.lockNote}>{note}</Text> : null}
    </View>
  );
}

export default function CustomerEditProfileScreen({ navigation }) {
  const { user, refreshUser } = useAuth();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [city, setCity] = useState(user?.city || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || null);
  const [coverUrl, setCoverUrl] = useState(user?.cover_url || null);
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const pickAndUpload = async (aspect, setLocalUrl, setUploading, folder) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to change your photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setUploading(true);
    try {
      const url = await uploadImage(result.assets[0].uri, folder);
      setLocalUrl(url);
    } catch (e) {
      Alert.alert('Could not upload your photo', 'Check your internet connection and try again.');
      console.warn('Upload error:', e.message);
    } finally {
      setUploading(false);
    }
  };

  const useMyLocation = async () => {
    const ok = await confirmLocationSetup('customer');
    if (!ok) return;
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Enable location in phone Settings, or type your city.');
        return;
      }
      await Location.enableNetworkProviderAsync().catch(() => {});
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        mayShowUserSettingsDialog: true,
      });
      const { latitude, longitude, accuracy } = pos.coords;
      setCoords({ latitude, longitude });
      const place = await reverseGeocodePlace(latitude, longitude, { countryCode: 'GH' });
      const cityLabel = place.city || place.district || place.landmark || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      setCity(
        place.digitalAddress ? `${cityLabel} (${place.digitalAddress})` : cityLabel,
      );
      if (typeof accuracy === 'number' && accuracy > 150) {
        Alert.alert('Weak GPS', 'Location accuracy is low. Edit the city if it looks wrong.');
      }
    } catch {
      Alert.alert('Location failed', 'Turn on GPS and try again, or type your city.');
    } finally {
      setLocating(false);
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Required', 'Please enter your name.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          city: city.trim() || null,
          avatar_url: avatarUrl,
          cover_url: coverUrl,
          ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
        })
        .eq('id', user.id);

      if (error) throw error;
      if (refreshUser) await refreshUser();
      Alert.alert('Saved', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Could not save', e.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color={Colors.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Edit Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <TouchableOpacity
          style={s.avatarEdit}
          onPress={() => pickAndUpload([1, 1], setAvatarUrl, setUploadingAvatar, 'avatars')}
          activeOpacity={0.85}
        >
          <View style={s.avatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={s.avatarImage} />
            ) : (
              <GoldAvatar name={fullName} size={84} />
            )}
            <View style={s.camBadge}>
              {uploadingAvatar ? (
                <ActivityIndicator color={Colors.navy} size="small" />
              ) : (
                <Ionicons name="camera" size={13} color={Colors.navy} />
              )}
            </View>
          </View>
          <Text style={s.changePhoto}>Change photo</Text>
        </TouchableOpacity>

        <FieldGroup label="Full name" icon="person-outline">
          <TextInput
            style={s.fieldInput}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your name"
            placeholderTextColor={Colors.textFaint}
          />
        </FieldGroup>

        <FieldGroup label="Email address" icon="mail-outline" locked note="Contact support to change your email">
          <Text style={s.disabledText}>{user?.email}</Text>
        </FieldGroup>

        <FieldGroup label="Phone number" icon="call-outline">
          <TextInput
            style={s.fieldInput}
            value={phone}
            onChangeText={setPhone}
            placeholder="+233 XX XXX XXXX"
            placeholderTextColor={Colors.textFaint}
            keyboardType="phone-pad"
          />
        </FieldGroup>

        <FieldGroup label="City / Location" icon="location-outline">
          <TextInput
            style={s.fieldInput}
            value={city}
            onChangeText={setCity}
            placeholder="e.g. Accra"
            placeholderTextColor={Colors.textFaint}
          />
        </FieldGroup>

        <TouchableOpacity style={s.locBtn} onPress={useMyLocation} disabled={locating}>
          <Ionicons name={coords ? 'checkmark-circle' : 'locate-outline'} size={16} color={coords ? Colors.success : Colors.gold} />
          <Text style={[s.locBtnText, coords && { color: Colors.success }]}>
            {locating ? 'Getting GPS…' : coords ? 'Service location updated ✓' : 'Use my current location'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.coverBtn}
          onPress={() => pickAndUpload([16, 9], setCoverUrl, setUploadingCover, 'covers')}
        >
          {uploadingCover ? (
            <ActivityIndicator color={Colors.gold} />
          ) : (
            <>
              <Ionicons name="image-outline" size={16} color={Colors.gold} />
              <Text style={s.coverBtnText}>{coverUrl ? 'Change cover photo' : 'Add cover photo (optional)'}</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={s.footerCopy}>© 2026 WiamApp · Powered by WiamLabs</Text>
      </ScrollView>

      <View style={s.saveBar}>
        <TouchableOpacity
          style={[s.saveBtn, (saving || uploadingAvatar || uploadingCover) && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving || uploadingAvatar || uploadingCover}
        >
          {saving ? (
            <ActivityIndicator color={Colors.navy} />
          ) : (
            <Text style={s.saveBtnText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.navy },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: PAD, paddingBottom: 14 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.navyCard, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.white },
  scroll: { paddingHorizontal: PAD, paddingBottom: 110 },
  avatarEdit: { alignItems: 'center', marginBottom: 22 },
  avatarWrap: { position: 'relative', width: 84, height: 84 },
  avatarImage: { width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: Colors.navyLine },
  camBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.gold, borderWidth: 3, borderColor: Colors.navy,
    alignItems: 'center', justifyContent: 'center',
  },
  changePhoto: { fontSize: 12, color: Colors.gold, fontWeight: '600', marginTop: 10 },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#B8B8CC', marginBottom: 8 },
  fieldBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.navyCard, borderWidth: 1, borderColor: Colors.navyLine,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
  },
  fieldBoxLocked: { opacity: 0.6 },
  fieldInput: { flex: 1, color: Colors.white, fontSize: 13 },
  disabledText: { flex: 1, color: Colors.textDim, fontSize: 13 },
  lockNote: { fontSize: 10.5, color: Colors.textFaint, marginTop: 4 },
  locBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: 'rgba(212,160,23,0.35)', backgroundColor: 'rgba(212,160,23,0.08)',
    borderRadius: 14, paddingVertical: 12, marginBottom: 12,
  },
  locBtnText: { color: Colors.gold, fontSize: 13.5, fontWeight: '600' },
  coverBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, marginBottom: 8,
  },
  coverBtnText: { color: Colors.gold, fontSize: 13, fontWeight: '600' },
  footerCopy: { textAlign: 'center', fontSize: 10, color: '#3A3A56', marginTop: 16 },
  saveBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.navySoft, borderTopWidth: 1, borderTopColor: '#1C1C38',
    paddingHorizontal: PAD, paddingVertical: 16,
  },
  saveBtn: {
    backgroundColor: Colors.gold, borderRadius: 16, paddingVertical: 14, alignItems: 'center',
  },
  saveBtnText: { color: Colors.navy, fontSize: 14, fontWeight: '700' },
});
