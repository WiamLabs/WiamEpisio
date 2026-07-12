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
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { uploadImage } from '../lib/api/uploads';
import { confirmLocationSetup } from '../lib/locationWarning';

const NAVY = '#0D0D2B';
const GOLD = '#D4A017';
const WHITE = '#FFFFFF';
const MUTED = '#888899';
const BORDER = '#EBEBEB';
const GOLD_BG = 'rgba(212,160,23,0.10)';
const GOLD_BD = 'rgba(212,160,23,0.35)';

export default function CustomerEditProfileScreen({ navigation }) {
  const { user, refreshUser } = useAuth();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone,    setPhone]    = useState(user?.phone || '');
  const [city,     setCity]     = useState(user?.city || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || null);
  const [coverUrl,  setCoverUrl]  = useState(user?.cover_url || null);
  const [coords,   setCoords]   = useState(null);
  const [locating, setLocating] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover,  setUploadingCover]  = useState(false);

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
      Alert.alert(
        'Could not upload your photo',
        'Check your internet connection and try again.'
      );
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
        accuracy: Location.Accuracy.Highest,
        mayShowUserSettingsDialog: true,
      });
      const { latitude, longitude } = pos.coords;
      setCoords({ latitude, longitude });
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&zoom=16`;
        const res = await fetch(url, { headers: { 'User-Agent': 'WiamApp/1.0 (support@wiamapp.com)' } });
        const data = await res.json();
        const addr = data?.address || {};
        const cityName = addr.city || addr.town || addr.municipality || addr.village || addr.suburb || '';
        setCity(cityName || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      } catch {
        setCity(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
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
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={WHITE} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Edit Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Cover photo */}
        <TouchableOpacity
          style={s.coverWrap}
          onPress={() => pickAndUpload([16, 9], setCoverUrl, setUploadingCover, 'covers')}
          activeOpacity={0.85}
        >
          {coverUrl
            ? <Image source={{ uri: coverUrl }} style={s.coverImage} />
            : <View style={s.coverPlaceholder} />
          }
          <View style={s.coverEditBadge}>
            {uploadingCover
              ? <ActivityIndicator color={WHITE} size="small" />
              : <Ionicons name="camera" size={16} color={WHITE} />
            }
          </View>

          {/* Avatar overlaps the bottom of the cover */}
          <TouchableOpacity
            style={s.avatarWrap}
            onPress={() => pickAndUpload([1, 1], setAvatarUrl, setUploadingAvatar, 'avatars')}
          >
            {avatarUrl
              ? <Image source={{ uri: avatarUrl }} style={s.avatar} />
              : <View style={[s.avatar, s.avatarFallback]}>
                  <Text style={s.avatarInitial}>{(fullName || 'C')[0]?.toUpperCase()}</Text>
                </View>
            }
            <View style={s.avatarEditBadge}>
              {uploadingAvatar
                ? <ActivityIndicator color={WHITE} size="small" />
                : <Ionicons name="camera" size={13} color={WHITE} />
              }
            </View>
          </TouchableOpacity>
        </TouchableOpacity>

        <View style={s.form}>
          <Text style={s.label}>Full Name *</Text>
          <TextInput style={s.input} value={fullName} onChangeText={setFullName} placeholder="Your name" placeholderTextColor={MUTED} />

          <Text style={s.label}>Phone Number</Text>
          <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder="+233 XX XXX XXXX" placeholderTextColor={MUTED} keyboardType="phone-pad" />

          <Text style={s.label}>City</Text>
          <TextInput style={s.input} value={city} onChangeText={setCity} placeholder="e.g. Accra" placeholderTextColor={MUTED} />
          <TouchableOpacity style={s.locBtn} onPress={useMyLocation} disabled={locating}>
            <Ionicons name={coords ? 'checkmark-circle' : 'locate-outline'} size={16} color={coords ? '#22C55E' : GOLD} />
            <Text style={[s.locBtnText, coords && { color: '#22C55E' }]}>
              {locating ? 'Getting GPS…' : coords ? 'Service location updated ✓' : 'Use my current location'}
            </Text>
          </TouchableOpacity>

          <Text style={s.label}>Email</Text>
          <View style={[s.input, s.inputDisabled]}>
            <Text style={s.disabledText}>{user?.email}</Text>
          </View>
          <Text style={s.hint}>Email can't be changed here. Contact support if you need to update it.</Text>

          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving || uploadingAvatar || uploadingCover}
          >
            {saving
              ? <ActivityIndicator color={NAVY} />
              : <Text style={s.saveBtnText}>Save Changes</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WHITE },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: NAVY, paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { padding: 2 },
  headerTitle: { color: WHITE, fontSize: 17, fontWeight: '700' },

  coverWrap: { height: 150, backgroundColor: '#EAEAEE', position: 'relative', marginBottom: 50 },
  coverImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverPlaceholder: { width: '100%', height: '100%', backgroundColor: NAVY },
  coverEditBadge: {
    position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(13,13,43,0.65)', alignItems: 'center', justifyContent: 'center',
  },
  avatarWrap: {
    position: 'absolute', bottom: -45, left: 20, width: 90, height: 90, borderRadius: 45,
    borderWidth: 4, borderColor: WHITE, backgroundColor: WHITE,
  },
  avatar: { width: '100%', height: '100%', borderRadius: 45, resizeMode: 'cover' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: NAVY },
  avatarInitial: { color: GOLD, fontSize: 30, fontWeight: '700' },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14,
    backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: WHITE,
  },

  form: { paddingHorizontal: 20 },
  label: { fontSize: 12.5, fontWeight: '700', color: NAVY, marginBottom: 7, marginTop: 16 },
  input: { backgroundColor: '#F6F6F8', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: NAVY, borderWidth: 1, borderColor: BORDER },
  locBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: GOLD_BD, backgroundColor: GOLD_BG,
    borderRadius: 10, paddingVertical: 12, marginTop: 10,
  },
  locBtnText: { color: GOLD, fontSize: 13.5, fontWeight: '600' },
  inputDisabled: { backgroundColor: '#F0F0F2' },
  disabledText: { fontSize: 15, color: MUTED },
  hint: { fontSize: 11.5, color: MUTED, marginTop: 6 },

  saveBtn: { backgroundColor: GOLD, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 28 },
  saveBtnText: { color: NAVY, fontSize: 15, fontWeight: '700' },
});
