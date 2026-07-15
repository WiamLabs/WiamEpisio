// © 2026 WiamApp. Powered by WiamLabs
// screens/WorkerProfileEditScreen.js
// PRODUCTION — real Supabase data, real photo upload, real sign out
// Worker views their profile, edits name/bio/rate/location, changes avatar

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, TextInput,
  Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import VerifiedBadge from '../components/VerifiedBadge';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../constants/colors';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { uploadAvatar } from '../lib/api/uploads';
import { confirmLocationSetup } from '../lib/locationWarning';
import { reverseGeocodePlace } from '../lib/reverseGeocode';
import GoldAvatar from '../components/ui/GoldAvatar';

const PAD = Colors.screenPad;

function SectionTitle({ title }) {
  return <Text style={s.sectionLabel}>{title}</Text>;
}

function MenuRow({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={s.menuRow} onPress={onPress} activeOpacity={0.7}>
      <View style={s.menuIcon}>
        <Ionicons name={icon} size={17} color={Colors.gold} />
      </View>
      <Text style={s.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={Colors.textFaint} />
    </TouchableOpacity>
  );
}

export default function WorkerProfileEditScreen({ navigation }) {
  const { user, profile, refreshUser } = useAuth();

  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState({ jobs: 0, rating: 0, earnings: 0 });

  const loadData = useCallback(async () => {
    if (!user) return;

    setFullName(user.full_name || '');
    setPhone(user.phone || '');
    setAvatarUrl(user.avatar_url || null);
    setBio(profile?.bio || '');
    setHourlyRate(profile?.hourly_rate ? String(profile.hourly_rate) : '');
    setLocation(profile?.location_name || user.city || '');

    if (profile?.id) {
      try {
        const { data: bookings } = await supabase
          .from('bookings')
          .select('id, agreed_price, status')
          .eq('worker_id', profile.id);

        const completed = (bookings || []).filter((b) => b.status === 'completed');
        const earnings = completed.reduce((sum, b) => sum + parseFloat(b.agreed_price || 0), 0);

        setStats({
          jobs: completed.length,
          rating: profile.average_rating || 0,
          earnings,
        });
      } catch (e) {
        console.warn('Stats load error:', e.message);
      }
    }
  }, [user, profile]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

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
        accuracy: Location.Accuracy.BestForNavigation,
        mayShowUserSettingsDialog: true,
      });
      const { latitude, longitude, accuracy } = pos.coords;
      setCoords({ latitude, longitude });

      const place = await reverseGeocodePlace(latitude, longitude, { countryCode: 'GH' });
      setLocation(
        [place.digitalAddress, place.landmark || place.city, place.region]
          .filter(Boolean)
          .join(', ')
        || place.label
        || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      );
      if (typeof accuracy === 'number' && accuracy > 150) {
        Alert.alert('Weak GPS', 'Location accuracy is low. Edit your base area if the name looks wrong.');
      }
    } catch {
      Alert.alert('Location failed', 'Turn on GPS and try again, or type your base area.');
    } finally {
      setLocating(false);
    }
  };

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
      const { error } = await supabase.from('users').update({ avatar_url: url }).eq('id', user.id);
      if (error) throw error;
      setAvatarUrl(url);
      refreshUser();
      Alert.alert('Done', 'Profile photo updated successfully.');
    } catch (e) {
      Alert.alert('Upload failed', e.message || 'Could not upload photo. Try again.');
    } finally {
      setUploading(false);
    }
  };

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
      const { error: userErr } = await supabase
        .from('users')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          city: location.trim(),
          ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
        })
        .eq('id', user.id);
      if (userErr) throw userErr;

      if (profile?.id) {
        const { error: wpErr } = await supabase
          .from('worker_profiles')
          .update({
            bio: bio.trim(),
            hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
            location_name: location.trim(),
            ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);
        if (wpErr) throw wpErr;
      }

      await refreshUser();
      setEditMode(false);
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not save changes. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try { await supabase.auth.signOut(); } catch (e) { console.warn('Sign out error:', e.message); }
          navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
        },
      },
    ]);
  };

  const menuItems = [
    { icon: 'star-outline', label: 'Star Pro', screen: 'ArtistSetup' },
    { icon: 'images-outline', label: 'Portfolio', screen: 'PortfolioManager' },
    { icon: 'ribbon-outline', label: 'Skills & Categories', screen: 'SkillsManager' },
    { icon: 'megaphone-outline', label: 'Spotlight Posts', screen: 'SpotlightManager' },
    { icon: 'calendar-outline', label: 'Availability', screen: 'AvailabilityCalendar' },
    { icon: 'trophy-outline', label: 'My Rankings', screen: 'WorkerRankings' },
    { icon: 'cash-outline', label: 'Earnings', screen: 'Earnings' },
    { icon: 'card-outline', label: 'Subscription', screen: 'Subscription' },
    { icon: 'shield-outline', label: 'Safety & SOS', screen: 'WorkerSafety' },
    { icon: 'shield-checkmark-outline', label: 'Verification Status', screen: null, action: 'verification' },
    { icon: 'settings-outline', label: 'Settings', screen: 'WorkerSettings' },
  ];

  const openMenuItem = async (item) => {
    if (item.action === 'verification') {
      try {
        const { data: ver } = await supabase
          .from('worker_verifications')
          .select('status')
          .eq('user_id', user?.id)
          .maybeSingle();
        if (ver?.status === 'pending') navigation.navigate('VerificationPending');
        else if (ver?.status === 'rejected') navigation.navigate('VerificationRejected');
        else if (profile?.is_verified) navigation.navigate('VerificationApproved');
        else navigation.navigate('WorkerVerifyIntro');
      } catch {
        navigation.navigate('WorkerVerifyIntro');
      }
      return;
    }
    if (item.screen) navigation.navigate(item.screen);
  };

  const identityStatus = profile?.is_verified ? 'Identity Confirmed' : 'Pending Review';
  const identityColor = profile?.is_verified ? Colors.success : Colors.warning;
  const tierLabel = profile?.subscription_tier
    ? profile.subscription_tier.charAt(0).toUpperCase() + profile.subscription_tier.slice(1)
    : 'Free';

  if (!user) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator color={Colors.gold} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        <View style={s.headerRow}>
          <Text style={s.screenTitle}>My Profile</Text>
          <TouchableOpacity
            style={s.editToggleBtn}
            onPress={() => {
              if (editMode) { loadData(); setEditMode(false); } else setEditMode(true);
            }}
          >
            <Ionicons name={editMode ? 'close' : 'create-outline'} size={18} color={Colors.gold} />
            <Text style={s.editToggleText}>{editMode ? 'Cancel' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <TouchableOpacity style={s.avatarEdit} onPress={handleChangeAvatar} disabled={uploading}>
            <View style={s.avatarWrap}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={s.avatarImage} />
              ) : (
                <GoldAvatar name={fullName} size={84} verified={profile?.verified_badge} />
              )}
              <View style={s.camBadge}>
                {uploading ? (
                  <ActivityIndicator color={Colors.navy} size="small" />
                ) : (
                  <Ionicons name="camera" size={13} color={Colors.navy} />
                )}
              </View>
            </View>
            <Text style={s.changePhoto}>Change photo</Text>
          </TouchableOpacity>

          {editMode ? (
            <TextInput
              style={s.nameInput}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              placeholderTextColor={Colors.textFaint}
              autoCapitalize="words"
            />
          ) : (
            <Text style={s.name}>{fullName || 'Your Name'}</Text>
          )}

          <Text style={s.role}>
            {profile?.worker_categories?.[0]?.categories?.name || 'Worker'} · {location || 'Accra, Ghana'}
          </Text>

          <View style={s.badgesRow}>
            <View style={[s.badge, { borderColor: identityColor }]}>
              <Ionicons
                name={profile?.is_verified ? 'shield-checkmark-outline' : 'time-outline'}
                size={12}
                color={identityColor}
              />
              <Text style={[s.badgeText, { color: identityColor }]}>{identityStatus}</Text>
            </View>
            {profile?.verified_badge ? (
              <View style={[s.badge, { borderColor: Colors.badgeBlue }]}>
                <VerifiedBadge color="blue" size={12} />
                <Text style={[s.badgeText, { color: Colors.badgeBlue }]}>Verified</Text>
              </View>
            ) : null}
            {tierLabel !== 'Free' ? (
              <View style={[s.badge, { borderColor: Colors.gold }]}>
                <Ionicons name="ribbon" size={12} color={Colors.gold} />
                <Text style={[s.badgeText, { color: Colors.gold }]}>{tierLabel} Plan</Text>
              </View>
            ) : null}
          </View>

          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={s.statVal}>{stats.jobs}</Text>
              <Text style={s.statLabel}>Jobs Done</Text>
            </View>
            <View style={s.statDiv} />
            <View style={s.stat}>
              <Text style={[s.statVal, { color: Colors.gold }]}>
                {stats.rating ? stats.rating.toFixed(1) : 'New'}
              </Text>
              <Text style={s.statLabel}>Rating</Text>
            </View>
            <View style={s.statDiv} />
            <View style={s.stat}>
              <Text style={[s.statVal, { color: Colors.gold }]}>
                GHS {stats.earnings >= 1000 ? `${(stats.earnings / 1000).toFixed(1)}k` : Math.round(stats.earnings)}
              </Text>
              <Text style={s.statLabel}>Earned</Text>
            </View>
          </View>

          {editMode ? (
            <View style={s.editForm}>
              <Text style={s.fieldLabel}>About / Bio</Text>
              <View style={s.fieldBox}>
                <TextInput
                  style={[s.fieldInput, s.fieldMulti]}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Tell customers about your experience and specialties..."
                  placeholderTextColor={Colors.textFaint}
                  multiline
                  numberOfLines={4}
                  maxLength={300}
                />
              </View>
              <Text style={s.charCount}>{bio.length}/300</Text>

              <View style={s.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Starting rate (GHS)</Text>
                  <View style={s.fieldBox}>
                    <Ionicons name="wallet-outline" size={15} color={Colors.gold} />
                    <TextInput
                      style={s.fieldInput}
                      value={hourlyRate}
                      onChangeText={setHourlyRate}
                      placeholder="e.g. 80"
                      placeholderTextColor={Colors.textFaint}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>

              <Text style={s.fieldLabel}>Location / Area</Text>
              <View style={s.fieldBox}>
                <Ionicons name="location-outline" size={15} color={Colors.gold} />
                <TextInput
                  style={s.fieldInput}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="e.g. East Legon, Accra"
                  placeholderTextColor={Colors.textFaint}
                />
              </View>
              <TouchableOpacity style={s.locBtn} onPress={useMyLocation} disabled={locating}>
                <Ionicons name={coords ? 'checkmark-circle' : 'locate-outline'} size={16} color={coords ? Colors.success : Colors.gold} />
                <Text style={[s.locBtnText, coords && { color: Colors.success }]}>
                  {locating ? 'Getting GPS…' : coords ? 'Base location updated ✓' : 'Use my current location'}
                </Text>
              </TouchableOpacity>

              <Text style={s.fieldLabel}>Phone Number</Text>
              <View style={s.fieldBox}>
                <Ionicons name="call-outline" size={15} color={Colors.gold} />
                <TextInput
                  style={s.fieldInput}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+233 24 000 0000"
                  placeholderTextColor={Colors.textFaint}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          ) : !editMode && bio ? (
            <View style={s.bioCard}>
              <SectionTitle title="ABOUT ME" />
              <Text style={s.bioText}>{bio}</Text>
              {hourlyRate ? (
                <View style={s.rateRow}>
                  <Ionicons name="cash-outline" size={14} color={Colors.gold} />
                  <Text style={s.rateText}>GHS {hourlyRate}/hr</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <SectionTitle title="MANAGE" />
          <View style={s.menuGroup}>
            {menuItems.map((item, i) => (
              <View key={item.label}>
                {i > 0 ? <View style={s.menuDivider} /> : null}
                <MenuRow icon={item.icon} label={item.label} onPress={() => openMenuItem(item)} />
              </View>
            ))}
          </View>

          <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={18} color={Colors.error} />
            <Text style={s.signOutText}>Sign Out</Text>
          </TouchableOpacity>

          <Text style={s.footerCopy}>© 2026 WiamApp · Powered by WiamLabs</Text>
        </ScrollView>

        {editMode ? (
          <View style={s.saveBar}>
            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={Colors.navy} />
              ) : (
                <Text style={s.saveBtnText}>Save Profile</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.navy },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: PAD, paddingTop: 12, paddingBottom: 8,
  },
  screenTitle: { fontSize: 20, fontWeight: '700', color: Colors.white },
  editToggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(212,160,23,0.1)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(212,160,23,0.3)',
  },
  editToggleText: { fontSize: 13, color: Colors.gold, fontWeight: '600' },
  scroll: { paddingHorizontal: PAD, paddingBottom: 110 },
  avatarEdit: { alignItems: 'center', marginBottom: 12 },
  avatarWrap: { position: 'relative', width: 84, height: 84 },
  avatarImage: { width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: Colors.navyLine },
  camBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.gold, borderWidth: 3, borderColor: Colors.navy,
    alignItems: 'center', justifyContent: 'center',
  },
  changePhoto: { fontSize: 12, color: Colors.gold, fontWeight: '600', marginTop: 10 },
  name: { fontSize: 22, fontWeight: '700', color: Colors.white, textAlign: 'center', marginBottom: 4 },
  nameInput: {
    fontSize: 20, fontWeight: '700', color: Colors.white, textAlign: 'center',
    borderBottomWidth: 1.5, borderBottomColor: Colors.gold, paddingBottom: 4, marginBottom: 6, minWidth: 200,
  },
  role: { fontSize: 14, color: Colors.textDim, textAlign: 'center', marginBottom: 12 },
  badgesRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  badgeText: { fontSize: 12, fontWeight: '500' },
  statsRow: {
    flexDirection: 'row', backgroundColor: Colors.navyCard, borderRadius: 16,
    paddingVertical: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.navyLine,
  },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '800', color: Colors.white, marginBottom: 3 },
  statLabel: { fontSize: 11, color: Colors.textFaint },
  statDiv: { width: 1, backgroundColor: Colors.navyLine, marginVertical: 4 },
  editForm: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#B8B8CC', marginBottom: 8, marginTop: 4 },
  fieldBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.navyCard, borderWidth: 1, borderColor: Colors.navyLine,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
  },
  fieldInput: { flex: 1, color: Colors.white, fontSize: 13 },
  fieldMulti: { minHeight: 90, textAlignVertical: 'top' },
  charCount: { fontSize: 10.5, color: Colors.textFaint, textAlign: 'right', marginTop: 4 },
  row2: { flexDirection: 'row', gap: 10 },
  locBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: 'rgba(212,160,23,0.35)', backgroundColor: 'rgba(212,160,23,0.08)',
    borderRadius: 14, paddingVertical: 12, marginTop: 10, marginBottom: 8,
  },
  locBtnText: { color: Colors.gold, fontSize: 13.5, fontWeight: '600' },
  bioCard: {
    backgroundColor: Colors.navyCard, borderRadius: 16, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: Colors.navyLine,
  },
  bioText: { fontSize: 14, color: Colors.textDim, lineHeight: 22, marginBottom: 10 },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rateText: { fontSize: 14, fontWeight: '700', color: Colors.gold },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: Colors.textFaint,
    textTransform: 'uppercase', marginBottom: 10, marginTop: 4,
  },
  menuGroup: {
    borderRadius: 20, backgroundColor: Colors.navyCard,
    borderWidth: 1, borderColor: Colors.navyLine, overflow: 'hidden', marginBottom: 14,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, paddingHorizontal: 16 },
  menuDivider: { height: 1, backgroundColor: Colors.navyLine, marginLeft: 65 },
  menuIcon: {
    width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(212,160,23,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  menuLabel: { flex: 1, fontSize: 13.5, fontWeight: '500', color: Colors.white },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 16,
    paddingVertical: 14, marginBottom: 16,
  },
  signOutText: { fontSize: 15, color: Colors.error, fontWeight: '600' },
  footerCopy: { textAlign: 'center', fontSize: 10, color: '#3A3A56' },
  saveBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.navySoft, borderTopWidth: 1, borderTopColor: '#1C1C38',
    paddingHorizontal: PAD, paddingVertical: 16,
  },
  saveBtn: {
    backgroundColor: Colors.gold, borderRadius: 16, paddingVertical: 14, alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: Colors.navy },
});
