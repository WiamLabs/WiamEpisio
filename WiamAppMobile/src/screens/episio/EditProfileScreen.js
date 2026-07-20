/**
 * Watcher / creator personal profile editor — avatar + bio via Cloudinary.
 * Creators also manage channel banner in Studio Settings.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, FONTS } from '../../constants/theme';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import authApi from '../../api/auth';
import useAuthStore from '../../store/useAuthStore';
import resolveUrl from '../../utils/resolveUrl';
import apiClient from '../../api/client';

const EditProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const patchUser = useAuthStore((s) => s.patchUser);
  const [displayName, setDisplayName] = useState(user?.display_name || user?.first_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState(resolveUrl(user?.avatar_url));
  const [busy, setBusy] = useState(false);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photos', 'Allow photo access to change your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setBusy(true);
    try {
      const data = await authApi.uploadAvatar(result.assets[0].uri);
      const url = resolveUrl(data?.avatar_url);
      setAvatar(url);
      await patchUser({ avatar_url: data?.avatar_url });
      Alert.alert('Updated', 'Profile photo saved.');
    } catch (e) {
      Alert.alert('Upload', e?.message || e || 'Could not upload');
    } finally {
      setBusy(false);
    }
  };

  const deleteAvatar = async () => {
    setBusy(true);
    try {
      await apiClient.delete('/auth/avatar');
      setAvatar(null);
      await patchUser({ avatar_url: null });
    } catch (e) {
      Alert.alert('Delete', e?.response?.data?.error || 'Could not delete photo');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const data = await authApi.updateProfile({
        firstName: displayName.trim(),
        bio: bio.trim(),
      });
      if (data?.user) await patchUser(data.user);
      else await patchUser({ display_name: displayName.trim(), bio: bio.trim() });
      Alert.alert('Saved', 'Your profile was updated.');
      if (navigation.canGoBack()) navigation.goBack();
    } catch (e) {
      Alert.alert('Save', e?.message || e || 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <ChevronLeft size={17} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.h1}>Edit profile</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <TouchableOpacity style={styles.avatar} onPress={pickAvatar} disabled={busy}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarLetter}>{(displayName || 'U')[0]?.toUpperCase()}</Text>
          )}
          <Text style={styles.changePhoto}>Change photo</Text>
        </TouchableOpacity>
        {avatar ? (
          <TouchableOpacity onPress={deleteAvatar} disabled={busy}>
            <Text style={styles.deletePhoto}>Remove photo</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.label}>Display name</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholderTextColor={COLORS.textFaint}
        />
        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.multi]}
          value={bio}
          onChangeText={setBio}
          multiline
          placeholder="Tell watchers about you"
          placeholderTextColor={COLORS.textFaint}
        />
        {user?.is_creator ? (
          <Text style={styles.hint}>
            Channel banner + public creator card are in WiamStudio → Settings.
          </Text>
        ) : null}
        {busy ? <ActivityIndicator color={COLORS.gold} style={{ marginVertical: 16 }} /> : null}
        <EpisioGoldButton label="Save profile" onPress={save} disabled={busy} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingBottom: 12,
  },
  back: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  h1: { fontSize: 17, fontFamily: FONTS.bold, color: '#fff' },
  avatar: { alignItems: 'center', marginBottom: 8 },
  avatarImg: { width: 96, height: 96, borderRadius: 24 },
  avatarLetter: {
    width: 96, height: 96, borderRadius: 24, backgroundColor: COLORS.gold,
    textAlign: 'center', lineHeight: 96, fontSize: 36, fontFamily: FONTS.extraBold, color: COLORS.navy,
    overflow: 'hidden',
  },
  changePhoto: { marginTop: 10, color: COLORS.gold, fontFamily: FONTS.semi, fontSize: 13 },
  deletePhoto: {
    textAlign: 'center', color: '#EF4444', fontFamily: FONTS.medium, fontSize: 12, marginBottom: 18,
  },
  label: { color: COLORS.textDim, fontFamily: FONTS.semi, fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.navyCard, borderRadius: 12, borderWidth: 1, borderColor: COLORS.navyLine,
    color: '#fff', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14, fontFamily: FONTS.regular,
  },
  multi: { minHeight: 100, textAlignVertical: 'top' },
  hint: { color: COLORS.textFaint, fontSize: 12, marginBottom: 16, fontFamily: FONTS.regular, lineHeight: 17 },
});

export default EditProfileScreen;
