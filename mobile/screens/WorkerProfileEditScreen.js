// © 2026 WiamApp. Powered by WiamLabs
// screens/WorkerProfileEditScreen.js
// PRODUCTION — real Supabase data, real photo upload, real sign out
// Worker views their profile, edits name/bio/rate/location, changes avatar

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, TextInput,
  Image, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import VerifiedBadge from '../components/VerifiedBadge';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../constants/colors';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { uploadAvatar } from '../lib/api/uploads';
import { confirmLocationSetup } from '../lib/locationWarning';

const NAVY  = Colors.navyDeep;
const NAVY2 = Colors.navyMid;
const GOLD  = Colors.gold;
const WHITE = Colors.white;
const MUTED = 'rgba(255,255,255,0.45)';
const BORDER= 'rgba(255,255,255,0.09)';
const GOLD_BG = 'rgba(212,160,23,0.10)';
const GOLD_BD = 'rgba(212,160,23,0.25)';

export default function WorkerProfileEditScreen({ navigation }) {
  const { user, profile, refreshUser } = useAuth();

  // ── Editable fields ───────────────────────────────────────
  const [fullName,    setFullName]    = useState('');
  const [bio,         setBio]         = useState('');
  const [hourlyRate,  setHourlyRate]  = useState('');
  const [location,    setLocation]    = useState('');
  const [phone,       setPhone]       = useState('');
  const [avatarUrl,   setAvatarUrl]   = useState(null);
  const [coords,      setCoords]      = useState(null);
  const [locating,    setLocating]    = useState(false);

  // ── UI State ──────────────────────────────────────────────
  const [editMode,    setEditMode]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [stats,       setStats]       = useState({ jobs: 0, rating: 0, earnings: 0 });

  // ── Load real data on focus ───────────────────────────────
  const loadData = useCallback(async () => {
    if (!user) return;

    // Populate fields from AuthContext (already loaded)
    setFullName(user.full_name   || '');
    setPhone(user.phone          || '');
    setAvatarUrl(user.avatar_url || null);
    setBio(profile?.bio          || '');
    setHourlyRate(profile?.hourly_rate ? String(profile.hourly_rate) : '');
    setLocation(profile?.location_name || user.city || '');

    // Load real stats
    if (profile?.id) {
      try {
        const { data: bookings } = await supabase
          .from('bookings')
          .select('id, agreed_price, status')
          .eq('worker_id', profile.id);

        const completed = (bookings || []).filter(b => b.status === 'completed');
        const earnings  = completed.reduce((s, b) => s + parseFloat(b.agreed_price || 0), 0);

        setStats({
          jobs:     completed.length,
          rating:   profile.average_rating || 0,
          earnings: earnings,
        });
      } catch (e) {
        console.warn('Stats load error:', e.message);
      }
    }
  }, [user, profile]);

  useFocusEffect(loadData);

  const useMyLocation = async () => {
    const ok = await confirmLocationSetup('worker');
    if (!ok) return;
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Enable location in phone Settings, or type your base area.');
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
        const region = addr.state || '';
        setLocation([cityName, region].filter(Boolean).join(', ') || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      } catch {
        setLocation(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      }
    } catch {
      Alert.alert('Location failed', 'Turn on GPS and try again, or type your base area.');
    } finally {
      setLocating(false);
    }
  };

  // ── Change avatar ─────────────────────────────────────────
  const handleChangeAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to change your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;

    const uri = result.assets[0].uri;
    setUploading(true);
    try {
      const url = await uploadAvatar(uri);
      // Save to users table
      const { error } = await supabase
        .from('users')
        .update({ avatar_url: url })
        .eq('id', user.id);
      if (error) throw error;
      setAvatarUrl(url);
      refreshUser();
      Alert.alert('✅ Done', 'Profile photo updated successfully.');
    } catch (e) {
      Alert.alert('Upload failed', e.message || 'Could not upload photo. Try again.');
    } finally {
      setUploading(false);
    }
  };

  // ── Save profile edits ────────────────────────────────────
  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Required', 'Full name cannot be empty.');
      return;
    }
    if (hourlyRate && isNaN(parseFloat(hourlyRate))) {
      Alert.alert('Invalid rate', 'Hourly rate must be a number.');
      return;
    }
    setSaving(true);
    try {
      // 1. Update users table
      const { error: userErr } = await supabase
        .from('users')
        .update({
          full_name: fullName.trim(),
          phone:     phone.trim(),
          city:      location.trim(),
          ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
        })
        .eq('id', user.id);
      if (userErr) throw userErr;

      // 2. Update worker_profiles table
      if (profile?.id) {
        const { error: wpErr } = await supabase
          .from('worker_profiles')
          .update({
            bio:           bio.trim(),
            hourly_rate:   hourlyRate ? parseFloat(hourlyRate) : null,
            location_name: location.trim(),
            ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
            updated_at:    new Date().toISOString(),
          })
          .eq('id', profile.id);
        if (wpErr) throw wpErr;
      }

      // 3. Refresh AuthContext so name shows everywhere
      await refreshUser();

      setEditMode(false);
      Alert.alert('✅ Saved', 'Your profile has been updated.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not save changes. Try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Sign out ──────────────────────────────────────────────
  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await supabase.auth.signOut();           // ✅ Real sign out
          } catch (e) {
            console.warn('Sign out error:', e.message);
          }
          navigation.reset({ index: 0, routes: [{ name: 'Landing' }] }); // ✅ Correct screen
        },
      },
    ]);
  };

  // ── Navigation helpers ────────────────────────────────────
  const menuItems = [
    { icon: 'images-outline',           label: 'Portfolio',           screen: 'PortfolioManager' },
    { icon: 'ribbon-outline',           label: 'Skills & Categories', screen: 'SkillsManager' },
    { icon: 'megaphone-outline',        label: 'Spotlight Posts',     screen: 'SpotlightManager' },
    { icon: 'calendar-outline',         label: 'Availability',        screen: 'AvailabilityCalendar' },
    { icon: 'trophy-outline',           label: 'My Rankings',         screen: 'WorkerRankings' },
    { icon: 'cash-outline',             label: 'Earnings',            screen: 'Earnings' },
    { icon: 'card-outline',             label: 'Subscription',        screen: 'Subscription' },
    { icon: 'shield-outline',           label: 'Safety & SOS',        screen: 'WorkerSafety' },
    { icon: 'shield-checkmark-outline', label: 'Verification Status', screen: 'VerificationPending' },
    { icon: 'settings-outline',         label: 'Settings',            screen: 'WorkerSettings' },
  ];

  const identityStatus = profile?.is_verified ? 'Identity Confirmed' : 'Pending Review';
  const identityColor  = profile?.is_verified ? Colors.success : Colors.warning;
  const tierLabel      = profile?.subscription_tier
    ? profile.subscription_tier.charAt(0).toUpperCase() + profile.subscription_tier.slice(1)
    : 'Free';

  if (!user) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator color={GOLD} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* ── Header ── */}
          <View style={s.headerRow}>
            <Text style={s.screenTitle}>My Profile</Text>
            <TouchableOpacity
              style={s.editToggleBtn}
              onPress={() => {
                if (editMode) {
                  // Cancel — reload from DB
                  loadData();
                  setEditMode(false);
                } else {
                  setEditMode(true);
                }
              }}
            >
              <Ionicons name={editMode ? 'close' : 'create-outline'} size={18} color={GOLD} />
              <Text style={s.editToggleText}>{editMode ? 'Cancel' : 'Edit'}</Text>
            </TouchableOpacity>
          </View>

          {/* ── Avatar + Name ── */}
          <View style={s.profileArea}>
            <TouchableOpacity style={s.avatarWrap} onPress={handleChangeAvatar} disabled={uploading}>
              {avatarUrl
                ? <Image source={{ uri: avatarUrl }} style={s.avatar} />
                : (
                  <View style={[s.avatar, s.avatarFallback]}>
                    <Text style={s.avatarInitial}>
                      {(fullName || 'W')[0].toUpperCase()}
                    </Text>
                  </View>
                )
              }
              <View style={s.cameraBtn}>
                {uploading
                  ? <ActivityIndicator size="small" color={WHITE} />
                  : <Ionicons name="camera" size={13} color={WHITE} />
                }
              </View>
            </TouchableOpacity>

            {editMode ? (
              <TextInput
                style={s.nameInput}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your full name"
                placeholderTextColor={MUTED}
                autoCapitalize="words"
              />
            ) : (
              <Text style={s.name}>{fullName || 'Your Name'}</Text>
            )}

            <Text style={s.role}>
              {profile?.worker_categories?.[0]?.categories?.name || 'Worker'} · {location || 'Accra, Ghana'}
            </Text>

            {/* Identity check, earned badge, and tier are three
                separate facts (Section 4B) — never collapsed into
                one pill, and the word "Verified" only ever appears
                next to the real earned badge. */}
            <View style={s.badgesRow}>
              <View style={[s.badge, { borderColor: identityColor }]}>
                <Ionicons
                  name={profile?.is_verified ? 'shield-checkmark-outline' : 'time-outline'}
                  size={12}
                  color={identityColor}
                />
                <Text style={[s.badgeText, { color: identityColor }]}>{identityStatus}</Text>
              </View>
              {profile?.verified_badge && (
                <View style={[s.badge, { borderColor: Colors.badgeBlue }]}>
                  <VerifiedBadge color="blue" size={12} />
                  <Text style={[s.badgeText, { color: Colors.badgeBlue }]}>Verified</Text>
                </View>
              )}
              {tierLabel !== 'Free' && (
                <View style={[s.badge, { borderColor: GOLD }]}>
                  <Ionicons name="ribbon" size={12} color={GOLD} />
                  <Text style={[s.badgeText, { color: GOLD }]}>{tierLabel} Plan</Text>
                </View>
              )}
            </View>
          </View>

          {/* ── Stats ── */}
          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={s.statVal}>{stats.jobs}</Text>
              <Text style={s.statLabel}>Jobs Done</Text>
            </View>
            <View style={s.statDiv} />
            <View style={s.stat}>
              <Text style={[s.statVal, { color: GOLD }]}>
                {stats.rating ? stats.rating.toFixed(1) : 'New'}
              </Text>
              <Text style={s.statLabel}>Rating</Text>
            </View>
            <View style={s.statDiv} />
            <View style={s.stat}>
              <Text style={[s.statVal, { color: GOLD }]}>
                GHS {stats.earnings >= 1000
                  ? `${(stats.earnings / 1000).toFixed(1)}k`
                  : Math.round(stats.earnings)}
              </Text>
              <Text style={s.statLabel}>Earned</Text>
            </View>
          </View>

          {/* ── Edit Form (only in edit mode) ── */}
          {editMode && (
            <View style={s.editForm}>
              <Text style={s.sectionLabel}>EDIT PROFILE</Text>

              <Text style={s.fieldLabel}>Bio</Text>
              <TextInput
                style={[s.input, s.inputMulti]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell customers about your experience and specialties..."
                placeholderTextColor={MUTED}
                multiline
                numberOfLines={4}
                maxLength={300}
              />
              <Text style={s.charCount}>{bio.length}/300</Text>

              <Text style={s.fieldLabel}>Hourly Rate (GHS)</Text>
              <TextInput
                style={s.input}
                value={hourlyRate}
                onChangeText={setHourlyRate}
                placeholder="e.g. 80"
                placeholderTextColor={MUTED}
                keyboardType="numeric"
              />

              <Text style={s.fieldLabel}>Location / Area</Text>
              <TextInput
                style={s.input}
                value={location}
                onChangeText={setLocation}
                placeholder="e.g. East Legon, Accra"
                placeholderTextColor={MUTED}
              />
              <TouchableOpacity
                style={s.locBtn}
                onPress={useMyLocation}
                disabled={locating}
              >
                <Ionicons name={coords ? 'checkmark-circle' : 'locate-outline'} size={16} color={coords ? '#22C55E' : GOLD} />
                <Text style={[s.locBtnText, coords && { color: '#22C55E' }]}>
                  {locating ? 'Getting GPS…' : coords ? 'Base location updated ✓' : 'Use my current location'}
                </Text>
              </TouchableOpacity>

              <Text style={s.fieldLabel}>Phone Number</Text>
              <TextInput
                style={s.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+233 24 000 0000"
                placeholderTextColor={MUTED}
                keyboardType="phone-pad"
              />

              <TouchableOpacity
                style={[s.saveBtn, saving && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color={NAVY} />
                  : <>
                      <Ionicons name="checkmark-circle" size={18} color={NAVY} />
                      <Text style={s.saveBtnText}>Save Changes</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* ── Bio display (when not editing) ── */}
          {!editMode && bio ? (
            <View style={s.bioCard}>
              <Text style={s.sectionLabel}>ABOUT ME</Text>
              <Text style={s.bioText}>{bio}</Text>
              {hourlyRate ? (
                <View style={s.rateRow}>
                  <Ionicons name="cash-outline" size={14} color={GOLD} />
                  <Text style={s.rateText}>GHS {hourlyRate}/hr</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* ── Quick links menu ── */}
          <Text style={s.sectionLabel} >MANAGE</Text>
          <View style={s.menu}>
            {menuItems.map((item, i) => (
              <TouchableOpacity
                key={item.label}
                style={[s.menuRow, i === menuItems.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => navigation.navigate(item.screen)}
              >
                <View style={s.menuIconBox}>
                  <Ionicons name={item.icon} size={18} color={GOLD} />
                </View>
                <Text style={s.menuLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={MUTED} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Sign out ── */}
          <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={18} color={Colors.error} />
            <Text style={s.signOutText}>Sign Out</Text>
          </TouchableOpacity>

          <Text style={s.copy}>© 2026 WiamApp · Powered by WiamLabs</Text>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: NAVY },

  // Header
  headerRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  screenTitle:   { fontSize: 20, fontWeight: '700', color: WHITE },
  editToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(212,160,23,0.1)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 0.5, borderColor: 'rgba(212,160,23,0.3)' },
  editToggleText:{ fontSize: 13, color: GOLD, fontWeight: '600' },

  // Avatar
  profileArea:   { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },
  avatarWrap:    { position: 'relative', marginBottom: 14 },
  avatar:        { width: 88, height: 88, borderRadius: 44, borderWidth: 2.5, borderColor: GOLD },
  avatarFallback:{ backgroundColor: 'rgba(212,160,23,0.12)', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 32, fontWeight: '800', color: GOLD },
  cameraBtn:     { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: NAVY },
  name:          { fontSize: 22, fontWeight: '700', color: WHITE, marginBottom: 4 },
  nameInput:     { fontSize: 20, fontWeight: '700', color: WHITE, textAlign: 'center', borderBottomWidth: 1.5, borderBottomColor: GOLD, paddingBottom: 4, marginBottom: 6, minWidth: 200 },
  role:          { fontSize: 14, color: MUTED, marginBottom: 12 },
  badgesRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  badge:         { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText:     { fontSize: 12, fontWeight: '500' },

  // Stats
  statsRow:      { flexDirection: 'row', backgroundColor: NAVY2, marginHorizontal: 20, borderRadius: 16, paddingVertical: 16, marginBottom: 16, borderWidth: 1, borderColor: BORDER },
  stat:          { flex: 1, alignItems: 'center' },
  statVal:       { fontSize: 18, fontWeight: '800', color: WHITE, marginBottom: 3 },
  statLabel:     { fontSize: 11, color: MUTED },
  statDiv:       { width: 1, backgroundColor: BORDER, marginVertical: 4 },

  // Edit form
  editForm:      { backgroundColor: NAVY2, marginHorizontal: 20, borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: BORDER },
  fieldLabel:    { fontSize: 12, fontWeight: '600', color: MUTED, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:         { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: WHITE, borderWidth: 1, borderColor: BORDER },
  locBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: GOLD_BD, backgroundColor: GOLD_BG,
    borderRadius: 10, paddingVertical: 12, marginTop: 10,
  },
  locBtnText: { color: GOLD, fontSize: 13.5, fontWeight: '600' },
  inputMulti:    { height: 90, textAlignVertical: 'top' },
  charCount:     { fontSize: 11, color: MUTED, textAlign: 'right', marginTop: 4 },
  saveBtn:       { backgroundColor: GOLD, borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 },
  saveBtnText:   { fontSize: 15, fontWeight: '700', color: NAVY },

  // Bio display
  bioCard:       { backgroundColor: NAVY2, marginHorizontal: 20, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: BORDER },
  bioText:       { fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 22, marginBottom: 10 },
  rateRow:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rateText:      { fontSize: 14, fontWeight: '700', color: GOLD },

  // Section label
  sectionLabel:  { fontSize: 11, fontWeight: '700', color: MUTED, letterSpacing: 1.2, marginHorizontal: 20, marginBottom: 8, marginTop: 4 },

  // Menu
  menu:          { backgroundColor: NAVY2, marginHorizontal: 20, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: BORDER, marginBottom: 14 },
  menuRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15, gap: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  menuIconBox:   { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(212,160,23,0.1)', alignItems: 'center', justifyContent: 'center' },
  menuLabel:     { fontSize: 15, color: WHITE, fontWeight: '400' },

  // Sign out
  signOutBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 20, borderWidth: 1.5, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 14, paddingVertical: 14, marginBottom: 16 },
  signOutText:   { fontSize: 15, color: Colors.error, fontWeight: '600' },

  copy:          { color: 'rgba(212,160,23,0.25)', fontSize: 10, textAlign: 'center', marginBottom: 4 },
});
