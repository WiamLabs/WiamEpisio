// © 2026 WiamApp. Powered by WiamLabs
// screens/CustomerSafetyScreen.js
// SOS setup, emergency contact, live location sharing during active jobs
// Backend: GET/PUT /api/safety/customer

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet,  StatusBar,
  ScrollView, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const BG      = '#FFFFFF';
const NAVY    = '#0D0D2B';
const GOLD    = '#D4A017';
const GOLD_BG = 'rgba(212,160,23,0.10)';
const GOLD_BD = 'rgba(212,160,23,0.25)';
const RED     = '#EF4444';
const BORDER  = '#EBEBEB';
const MUTED   = '#888899';
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function CustomerSafetyScreen({ navigation }) {
  const [contactName,    setContactName]    = useState('');
  const [contactPhone,   setContactPhone]   = useState('');
  const [contactRelation,setContactRelation]= useState('');
  const [shareLocation,  setShareLocation]  = useState(true);
  const [notifyOnBooking,setNotifyOnBooking]= useState(true);
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [saved,          setSaved]          = useState(false);
  const [error,          setError]          = useState('');

  useEffect(() => {
    const fetchSafety = async () => {
      try {
        const res  = await fetch(`${BACKEND}/api/safety/customer`);
        const data = await res.json();
        if (data.data) {
          setContactName(data.data.emergency_contact_name || '');
          setContactPhone(data.data.emergency_contact_phone || '');
          setContactRelation(data.data.emergency_contact_relation || '');
          setShareLocation(data.data.share_location ?? true);
          setNotifyOnBooking(data.data.notify_on_booking ?? true);
        }
      } catch { } finally { setLoading(false); }
    };
    fetchSafety();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND}/api/safety/customer`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          emergency_contact_name:     contactName,
          emergency_contact_phone:    contactPhone,
          emergency_contact_relation: contactRelation,
          share_location:             shareLocation,
          notify_on_booking:          notifyOnBooking,
        }),
      });
      if (!res.ok) throw new Error('Could not save settings.');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <ActivityIndicator color={GOLD} style={{ marginTop: 60 }} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={NAVY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Safety Settings</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {/* SOS explanation */}
        <View style={s.sosCard}>
          <View style={s.sosIconWrap}>
            <Ionicons name="shield-checkmark-outline" size={28} color={GOLD} />
          </View>
          <View style={s.sosInfo}>
            <Text style={s.sosTitle}>WiamApp Safety System</Text>
            <Text style={s.sosDesc}>
              During active jobs, your emergency contact is alerted instantly if you tap SOS.
              They receive your GPS location and the worker's verified ID details.
            </Text>
          </View>
        </View>

        {/* Emergency contact */}
        <Text style={s.sectionTitle}>EMERGENCY CONTACT</Text>
        <Text style={s.sectionDesc}>
          This person will be notified with your location and the worker's details if you trigger SOS.
        </Text>

        <Text style={s.label}>Full name</Text>
        <View style={s.inputWrap}>
          <Ionicons name="person-outline" size={17} color={MUTED} style={s.inputIcon} />
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="Emergency contact's name"
            placeholderTextColor={MUTED}
            value={contactName}
            onChangeText={setContactName}
          />
        </View>

        <Text style={s.label}>Phone number</Text>
        <View style={s.inputWrap}>
          <Ionicons name="call-outline" size={17} color={MUTED} style={s.inputIcon} />
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="+233 XX XXX XXXX"
            placeholderTextColor={MUTED}
            value={contactPhone}
            onChangeText={setContactPhone}
            keyboardType="phone-pad"
          />
        </View>

        <Text style={s.label}>Relationship</Text>
        <View style={s.inputWrap}>
          <Ionicons name="people-outline" size={17} color={MUTED} style={s.inputIcon} />
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="e.g. Spouse, Parent, Friend"
            placeholderTextColor={MUTED}
            value={contactRelation}
            onChangeText={setContactRelation}
          />
        </View>

        {/* Safety toggles */}
        <Text style={s.sectionTitle}>SAFETY PREFERENCES</Text>

        <View style={s.toggleCard}>
          <View style={s.toggleRow}>
            <View style={s.toggleInfo}>
              <View style={s.toggleIconWrap}>
                <Ionicons name="location-outline" size={17} color={GOLD} />
              </View>
              <View style={s.toggleText}>
                <Text style={s.toggleTitle}>Share location during jobs</Text>
                <Text style={s.toggleDesc}>Worker can see your location when job is active</Text>
              </View>
            </View>
            <Switch
              value={shareLocation}
              onValueChange={setShareLocation}
              trackColor={{ false: '#DDD', true: GOLD }}
              thumbColor={BG}
            />
          </View>

          <View style={[s.toggleRow, s.toggleRowBorder]}>
            <View style={s.toggleInfo}>
              <View style={s.toggleIconWrap}>
                <Ionicons name="notifications-outline" size={17} color={GOLD} />
              </View>
              <View style={s.toggleText}>
                <Text style={s.toggleTitle}>Notify contact on booking</Text>
                <Text style={s.toggleDesc}>Your emergency contact gets a message when you book</Text>
              </View>
            </View>
            <Switch
              value={notifyOnBooking}
              onValueChange={setNotifyOnBooking}
              trackColor={{ false: '#DDD', true: GOLD }}
              thumbColor={BG}
            />
          </View>
        </View>

        {/* How SOS works */}
        <View style={s.howCard}>
          <Text style={s.howTitle}>HOW SOS WORKS</Text>
          {[
            'During an active job, a red SOS button is always visible',
            'Tap it once — your contact receives an alert with your GPS location',
            'The worker\'s verified name, photo, and ID number are included',
            'WiamApp operations team is also notified immediately',
          ].map((item, i) => (
            <View key={i} style={s.howRow}>
              <View style={s.howNum}><Text style={s.howNumText}>{i + 1}</Text></View>
              <Text style={s.howText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Error */}
        {error ? (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={14} color={RED} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Save button */}
        <TouchableOpacity
          style={[s.saveBtn, saved && s.saveBtnDone]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color={NAVY} />
            : <>
                <Ionicons
                  name={saved ? 'checkmark-circle' : 'save-outline'}
                  size={17}
                  color={NAVY}
                />
                <Text style={s.saveBtnText}>
                  {saved ? 'Settings Saved!' : 'Save Safety Settings'}
                </Text>
              </>
          }
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: BORDER,
  },
  headerTitle: { color: NAVY, fontSize: 17, fontWeight: '700' },
  container:   { flexGrow: 1, padding: 20 },

  sosCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: GOLD_BG, borderRadius: 14,
    borderWidth: 0.5, borderColor: GOLD_BD,
    padding: 16, marginBottom: 24,
  },
  sosIconWrap: {
    width: 50, height: 50, borderRadius: 14,
    backgroundColor: 'rgba(212,160,23,0.15)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  sosInfo:  { flex: 1 },
  sosTitle: { color: NAVY, fontSize: 15, fontWeight: '700', marginBottom: 5 },
  sosDesc:  { color: MUTED, fontSize: 12, lineHeight: 18 },

  sectionTitle: { color: MUTED, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6, marginTop: 8 },
  sectionDesc:  { color: MUTED, fontSize: 13, lineHeight: 19, marginBottom: 14 },

  label: { color: MUTED, fontSize: 12, fontWeight: '500', marginBottom: 7, marginTop: 12, letterSpacing: 0.3 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F5F8', borderRadius: 12,
    borderWidth: 0.5, borderColor: BORDER,
    paddingHorizontal: 13, paddingVertical: 13,
  },
  inputIcon: { marginRight: 10 },
  input:     { color: NAVY, fontSize: 14 },

  toggleCard: {
    backgroundColor: '#F8F8FB', borderRadius: 14,
    borderWidth: 0.5, borderColor: BORDER,
    marginTop: 10, marginBottom: 20, overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 14,
  },
  toggleRowBorder: { borderTopWidth: 0.5, borderTopColor: BORDER },
  toggleInfo:      { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 10 },
  toggleIconWrap:  { width: 36, height: 36, borderRadius: 10, backgroundColor: GOLD_BG, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  toggleText:      { flex: 1 },
  toggleTitle:     { color: NAVY, fontSize: 14, fontWeight: '500', marginBottom: 2 },
  toggleDesc:      { color: MUTED, fontSize: 11, lineHeight: 16 },

  howCard: {
    backgroundColor: '#F8F8FB', borderRadius: 14,
    borderWidth: 0.5, borderColor: BORDER,
    padding: 16, marginBottom: 20, gap: 12,
  },
  howTitle: { color: MUTED, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  howRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  howNum:   { width: 22, height: 22, borderRadius: 11, backgroundColor: RED, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  howNumText:{ color: BG, fontSize: 11, fontWeight: '700' },
  howText:  { color: NAVY, fontSize: 13, flex: 1, lineHeight: 19 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 10, padding: 12, marginBottom: 14,
  },
  errorText: { color: RED, fontSize: 12, flex: 1 },

  saveBtn: {
    backgroundColor: GOLD, borderRadius: 13, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  },
  saveBtnDone: { backgroundColor: '#22C55E' },
  saveBtnText: { color: NAVY, fontSize: 15, fontWeight: '700' },
});
