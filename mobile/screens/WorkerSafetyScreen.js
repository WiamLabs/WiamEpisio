// © 2026 WiamApp. Powered by WiamLabs
// screens/WorkerSafetyScreen.js
// SOS, GPS check-in/out, emergency contact, location sharing
// Backend: GET/PUT /api/safety/worker

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet,  StatusBar,
  ScrollView, ActivityIndicator, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, goldGradient } from '../constants/colors';
import * as Location from 'expo-location';

const PAD = Colors.screenPad;
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function WorkerSafetyScreen({ navigation }) {
  const [contactName,     setContactName]     = useState('');
  const [contactPhone,    setContactPhone]    = useState('');
  const [contactRelation, setContactRelation] = useState('');
  const [shareLocation,   setShareLocation]   = useState(true);
  const [autoCheckin,     setAutoCheckin]     = useState(false);
  const [loading,         setLoading]         = useState(true);
  const [saving,          setSaving]          = useState(false);
  const [saved,           setSaved]           = useState(false);

  useEffect(() => {
    const fetchSafety = async () => {
      try {
        const res  = await fetch(`${BACKEND}/api/safety/worker`);
        const data = await res.json();
        if (data.data) {
          setContactName(data.data.emergency_contact_name || '');
          setContactPhone(data.data.emergency_contact_phone || '');
          setContactRelation(data.data.emergency_contact_relation || '');
          setShareLocation(data.data.share_location ?? true);
          setAutoCheckin(data.data.auto_checkin ?? false);
        }
      } catch { } finally { setLoading(false); }
    };
    fetchSafety();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`${BACKEND}/api/safety/worker`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emergency_contact_name:     contactName,
          emergency_contact_phone:    contactPhone,
          emergency_contact_relation: contactRelation,
          share_location:             shareLocation,
          auto_checkin:               autoCheckin,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { } finally { setSaving(false); }
  };

  const testSOS = async () => {
    Alert.alert(
      'Test SOS Alert',
      'This will send a test alert to your emergency contact. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Test',
          onPress: async () => {
            try {
              const { status } = await Location.requestForegroundPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission needed', 'Allow location access to use SOS.');
                return;
              }
              const loc = await Location.getCurrentPositionAsync({});
              await fetch(`${BACKEND}/api/safety/worker/sos-test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  latitude:  loc.coords.latitude,
                  longitude: loc.coords.longitude,
                }),
              });
              Alert.alert('Test Sent', 'Your emergency contact received a test alert.');
            } catch {
              Alert.alert('Error', 'Could not send test. Make sure your contact is saved.');
            }
          },
        },
      ]
    );
  };

  if (loading) return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />
      <ActivityIndicator color={Colors.gold} style={{ marginTop: 60 }} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Safety & SOS</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {/* SOS card */}
        <View style={s.sosCard}>
          <View style={s.sosTop}>
            <View style={s.sosIconWrap}>
              <Ionicons name="alert-circle-outline" size={28} color={Colors.error} />
            </View>
            <View style={s.sosInfo}>
              <Text style={s.sosTitle}>SOS Emergency Button</Text>
              <Text style={s.sosDesc}>
                During active jobs, tap SOS to instantly alert your emergency contact with your GPS location and the customer's verified ID details.
              </Text>
            </View>
          </View>
          <TouchableOpacity style={s.testBtn} onPress={testSOS}>
            <Ionicons name="radio-outline" size={15} color={Colors.error} />
            <Text style={s.testBtnText}>Send Test Alert</Text>
          </TouchableOpacity>
        </View>

        {/* Emergency contact */}
        <Text style={s.sectionLabel}>EMERGENCY CONTACT</Text>

        <Text style={s.label}>Full name</Text>
        <View style={s.inputWrap}>
          <Ionicons name="person-outline" size={17} color={Colors.textDim} style={s.inputIcon} />
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="Contact's full name"
            placeholderTextColor={Colors.textDim}
            value={contactName}
            onChangeText={setContactName}
          />
        </View>

        <Text style={s.label}>Phone number</Text>
        <View style={s.inputWrap}>
          <Ionicons name="call-outline" size={17} color={Colors.textDim} style={s.inputIcon} />
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="+233 XX XXX XXXX"
            placeholderTextColor={Colors.textDim}
            value={contactPhone}
            onChangeText={setContactPhone}
            keyboardType="phone-pad"
          />
        </View>

        <Text style={s.label}>Relationship</Text>
        <View style={s.inputWrap}>
          <Ionicons name="people-outline" size={17} color={Colors.textDim} style={s.inputIcon} />
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="e.g. Spouse, Parent, Friend"
            placeholderTextColor={Colors.textDim}
            value={contactRelation}
            onChangeText={setContactRelation}
          />
        </View>

        {/* Toggles */}
        <Text style={s.sectionLabel}>SAFETY PREFERENCES</Text>
        <View style={s.toggleCard}>
          <View style={s.toggleRow}>
            <View style={s.toggleLeft}>
              <View style={s.toggleIcon}>
                <Ionicons name="location-outline" size={16} color={Colors.gold} />
              </View>
              <View>
                <Text style={s.toggleTitle}>Share location with customers</Text>
                <Text style={s.toggleDesc}>Customer can track your arrival during active jobs</Text>
              </View>
            </View>
            <Switch
              value={shareLocation}
              onValueChange={setShareLocation}
              trackColor={{ false: Colors.navyLine, true: Colors.gold }}
              thumbColor={Colors.white}
            />
          </View>
          <View style={[s.toggleRow, s.toggleRowBorder]}>
            <View style={s.toggleLeft}>
              <View style={s.toggleIcon}>
                <Ionicons name="navigate-outline" size={16} color={Colors.gold} />
              </View>
              <View>
                <Text style={s.toggleTitle}>Auto GPS check-in on arrival</Text>
                <Text style={s.toggleDesc}>Automatically check in when you reach the job location</Text>
              </View>
            </View>
            <Switch
              value={autoCheckin}
              onValueChange={setAutoCheckin}
              trackColor={{ false: Colors.navyLine, true: Colors.gold }}
              thumbColor={Colors.white}
            />
          </View>
        </View>

        {/* How SOS works */}
        <View style={s.howCard}>
          <Text style={s.howLabel}>HOW SOS WORKS</Text>
          {[
            'A red SOS button is visible on your active job screen',
            'Tap once — your contact receives your live GPS location',
            "Customer's verified ID and photo are sent to your contact",
            'WiamApp operations team is alerted immediately',
            'Your location is tracked every 30 seconds until you cancel',
          ].map((item, i) => (
            <View key={i} style={s.howRow}>
              <View style={s.howNum}><Text style={s.howNumText}>{i + 1}</Text></View>
              <Text style={s.howText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Save */}
        <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          <LinearGradient
            colors={saved ? [Colors.success, Colors.success] : goldGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.saveBtn}
          >
            {saving
              ? <ActivityIndicator color={Colors.navy} />
              : <>
                  <Ionicons name={saved ? 'checkmark-circle' : 'save-outline'} size={17} color={Colors.navy} />
                  <Text style={s.saveBtnText}>{saved ? 'Settings Saved!' : 'Save Safety Settings'}</Text>
                </>
            }
          </LinearGradient>
        </TouchableOpacity>
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.navy },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PAD, paddingVertical: 14 },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.navyCard, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.white, fontSize: 17, fontWeight: '700' },
  container:   { flexGrow: 1, padding: PAD },

  sosCard: {
    backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: Colors.cardRadius,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    padding: 16, marginBottom: 24,
  },
  sosTop:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  sosIconWrap:{ width: 48, height: 48, borderRadius: 13, backgroundColor: 'rgba(239,68,68,0.15)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sosInfo:    { flex: 1 },
  sosTitle:   { color: Colors.white, fontSize: 15, fontWeight: '700', marginBottom: 5 },
  sosDesc:    { color: Colors.textDim, fontSize: 12, lineHeight: 18 },
  testBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)',
  },
  testBtnText: { color: Colors.error, fontSize: 13, fontWeight: '600' },

  sectionLabel: { color: Colors.gold, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 12, marginTop: 8 },
  label:        { color: Colors.textDim, fontSize: 12, fontWeight: '500', marginBottom: 7, marginTop: 12, letterSpacing: 0.3 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.navySoft, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.navyLine,
    paddingHorizontal: 13, paddingVertical: 13,
  },
  inputIcon: { marginRight: 10 },
  input:     { color: Colors.white, fontSize: 14 },

  toggleCard:      { backgroundColor: Colors.navyCard, borderRadius: Colors.cardRadius, borderWidth: 1, borderColor: Colors.navyLine, marginTop: 4, marginBottom: 20, overflow: 'hidden' },
  toggleRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  toggleRowBorder: { borderTopWidth: 1, borderTopColor: Colors.navyLine },
  toggleLeft:      { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 10 },
  toggleIcon:      { width: 34, height: 34, borderRadius: 9, backgroundColor: 'rgba(212,160,23,0.10)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  toggleTitle:     { color: Colors.white, fontSize: 13, fontWeight: '500', marginBottom: 2 },
  toggleDesc:      { color: Colors.textDim, fontSize: 11, lineHeight: 15 },

  howCard:  { backgroundColor: Colors.navyCard, borderRadius: Colors.cardRadius, borderWidth: 1, borderColor: Colors.navyLine, padding: 16, marginBottom: 24, gap: 12 },
  howLabel: { color: Colors.gold, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  howRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  howNum:   { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  howNumText:{ color: Colors.white, fontSize: 11, fontWeight: '700' },
  howText:  { color: Colors.textDim, fontSize: 12, flex: 1, lineHeight: 18 },

  saveBtn:     { borderRadius: 14, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveBtnText: { color: Colors.navy, fontSize: 15, fontWeight: '700' },
});
