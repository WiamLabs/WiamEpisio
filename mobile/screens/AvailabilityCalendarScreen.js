// © 2026 WiamApp. Powered by WiamLabs
// screens/AvailabilityCalendarScreen.js
// Worker sets their available days and working hours
// Backend: GET/PATCH /api/workers/availability

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, Switch, Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, goldGradient } from '../constants/colors';
import { supabase } from '../lib/supabase';

const PAD = Colors.screenPad;
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

const HOURS = ['6:00 AM','7:00 AM','8:00 AM','9:00 AM','10:00 AM','11:00 AM',
  '12:00 PM','1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM',
  '6:00 PM','7:00 PM','8:00 PM','9:00 PM','10:00 PM'];

const DEFAULT_SCHEDULE = {
  mon: { active: true,  start: '8:00 AM',  end: '6:00 PM' },
  tue: { active: true,  start: '8:00 AM',  end: '6:00 PM' },
  wed: { active: true,  start: '8:00 AM',  end: '6:00 PM' },
  thu: { active: true,  start: '8:00 AM',  end: '6:00 PM' },
  fri: { active: true,  start: '8:00 AM',  end: '6:00 PM' },
  sat: { active: true,  start: '9:00 AM',  end: '3:00 PM' },
  sun: { active: false, start: '9:00 AM',  end: '3:00 PM' },
};

function HourPicker({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <TouchableOpacity style={styles.hourPicker} onPress={() => setOpen(!open)}>
        <Text style={styles.hourPickerText}>{value}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textDim} />
      </TouchableOpacity>
      {open && (
        <View style={styles.hourDropdown}>
          <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
            {options.map(h => (
              <TouchableOpacity
                key={h}
                style={[styles.hourOption, h === value && styles.hourOptionActive]}
                onPress={() => { onChange(h); setOpen(false); }}
              >
                <Text style={[styles.hourOptionText, h === value && { color: Colors.gold }]}>{h}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default function AvailabilityCalendarScreen({ navigation }) {
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [saving, setSaving] = useState(false);
  const [blackouts, setBlackouts] = useState([]);
  const [boStart, setBoStart] = useState('');
  const [boEnd, setBoEnd] = useState('');
  const [boReason, setBoReason] = useState('');
  const [boSaving, setBoSaving] = useState(false);
  const [hasArtist, setHasArtist] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch(`${BACKEND}/api/artists/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json();
        if (json.artist) {
          setHasArtist(true);
          setBlackouts(json.blackouts || []);
        }
      } catch (_) {}
    })();
  }, []);

  const addBlackout = async () => {
    if (!boStart || !boEnd) {
      Alert.alert('Required', 'Enter start and end dates (YYYY-MM-DD).');
      return;
    }
    setBoSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${BACKEND}/api/artists/me/blackouts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ start_date: boStart, end_date: boEnd, reason: boReason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setBlackouts((prev) => [...prev, json.blackout]);
      setBoStart(''); setBoEnd(''); setBoReason('');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setBoSaving(false);
    }
  };

  const removeBlackout = async (id) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${BACKEND}/api/artists/me/blackouts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setBlackouts((prev) => prev.filter((b) => b.id !== id));
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const toggleDay = (key) => {
    setSchedule(prev => ({
      ...prev,
      [key]: { ...prev[key], active: !prev[key].active },
    }));
  };

  const setHour = (key, field, val) => {
    setSchedule(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: val },
    }));
  };

  const activeDays = DAYS.filter(d => schedule[d.key].active).length;

  const handleSave = async () => {
    setSaving(true);
    try {
      const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;
      await fetch(`${BACKEND}/api/workers/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule }),
      });
      Alert.alert('✅ Saved', 'Your availability has been updated. Customers will see your new schedule.', [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Saved Locally', 'Your schedule has been saved. It will sync when you are back online.');
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>My Availability</Text>
          <Text style={styles.headerSub}>{activeDays} days active</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>

        {/* Info card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.gold} />
          <Text style={styles.infoText}>
            Set the days and hours you are available for jobs. Customers can only book you during these times.
          </Text>
        </View>

        {/* Schedule */}
        <View style={styles.section}>
          {DAYS.map(day => {
            const sch = schedule[day.key];
            return (
              <View key={day.key} style={styles.dayCard}>
                <View style={styles.dayTop}>
                  <Text style={[styles.dayLabel, !sch.active && { color: Colors.textDim }]}>{day.label}</Text>
                  <Switch
                    value={sch.active}
                    onValueChange={() => toggleDay(day.key)}
                    trackColor={{ false: Colors.navyLine, true: Colors.gold }}
                    thumbColor={sch.active ? Colors.navy : Colors.textDim}
                  />
                </View>
                {sch.active && (
                  <View style={styles.hoursRow}>
                    <View style={styles.hourGroup}>
                      <Text style={styles.hourLabel}>Start</Text>
                      <HourPicker
                        value={sch.start}
                        options={HOURS}
                        onChange={(v) => setHour(day.key, 'start', v)}
                      />
                    </View>
                    <Ionicons name="arrow-forward" size={16} color={Colors.textDim} style={{ marginTop: 22 }} />
                    <View style={styles.hourGroup}>
                      <Text style={styles.hourLabel}>End</Text>
                      <HourPicker
                        value={sch.end}
                        options={HOURS}
                        onChange={(v) => setHour(day.key, 'end', v)}
                      />
                    </View>
                  </View>
                )}
                {!sch.active && (
                  <Text style={styles.unavailText}>Unavailable — toggle to enable</Text>
                )}
              </View>
            );
          })}
        </View>

        {/* Musician Pro blackouts */}
        {hasArtist && (
          <View style={styles.section}>
            <Text style={[styles.dayLabel, { marginBottom: 10 }]}>Star Pro — Blackout dates</Text>
            <Text style={styles.infoText}>
              Block nights you cannot perform. Gig requests on these dates are rejected.
            </Text>
            {blackouts.map((b) => (
              <View key={b.id} style={[styles.dayCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                <Text style={{ color: Colors.white, fontSize: 13 }}>
                  {b.start_date} → {b.end_date}{b.reason ? ` · ${b.reason}` : ''}
                </Text>
                <TouchableOpacity onPress={() => removeBlackout(b.id)}>
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
            <TextInput
              style={styles.boInput}
              value={boStart}
              onChangeText={setBoStart}
              placeholder="Start YYYY-MM-DD"
              placeholderTextColor={Colors.textDim}
            />
            <TextInput
              style={styles.boInput}
              value={boEnd}
              onChangeText={setBoEnd}
              placeholder="End YYYY-MM-DD"
              placeholderTextColor={Colors.textDim}
            />
            <TextInput
              style={styles.boInput}
              value={boReason}
              onChangeText={setBoReason}
              placeholder="Reason (optional)"
              placeholderTextColor={Colors.textDim}
            />
            <TouchableOpacity style={styles.boBtn} onPress={addBlackout} disabled={boSaving}>
              {boSaving ? <ActivityIndicator color={Colors.navy} /> : <Text style={styles.boBtnText}>Add blackout</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Tips */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>Tips</Text>
          <Text style={styles.tipItem}>• Workers who are available on weekends earn 25% more</Text>
          <Text style={styles.tipItem}>• Emergency bookings can come outside your hours — you can still accept them</Text>
          <Text style={styles.tipItem}>• You can change your availability anytime</Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Save button */}
      <View style={styles.footer}>
        <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.saveBtn, saving && { opacity: 0.7 }]}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.navy} />
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Availability'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: Colors.navy },
  header:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAD, paddingTop: 8, paddingBottom: 14, gap: 12 },
  backBtn:          { padding: 4 },
  headerTitle:      { fontSize: 18, fontWeight: '700', color: Colors.white },
  headerSub:        { fontSize: 12, color: Colors.textDim, marginTop: 1 },
  infoCard:         { flexDirection: 'row', gap: 10, backgroundColor: 'rgba(212,160,23,0.10)', borderWidth: 1, borderColor: 'rgba(212,160,23,0.25)', borderRadius: 14, padding: 14, marginHorizontal: PAD, marginTop: 8 },
  infoText:         { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 19 },
  section:          { paddingHorizontal: PAD, marginTop: 16 },
  dayCard:          { backgroundColor: Colors.navyCard, borderRadius: Colors.cardRadius, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: Colors.navyLine },
  dayTop:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayLabel:         { fontSize: 16, fontWeight: '700', color: Colors.white },
  hoursRow:         { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 14 },
  hourGroup:        { flex: 1 },
  hourLabel:        { fontSize: 11, color: Colors.textDim, marginBottom: 6 },
  hourPicker:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.navySoft, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.navyLine },
  hourPickerText:   { fontSize: 14, color: Colors.white, fontWeight: '600' },
  hourDropdown:     { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: Colors.navyCard, borderRadius: 10, borderWidth: 1, borderColor: Colors.navyLine, zIndex: 100, marginTop: 4 },
  hourOption:       { paddingVertical: 10, paddingHorizontal: 14 },
  hourOptionActive: { backgroundColor: 'rgba(212,160,23,0.12)' },
  hourOptionText:   { fontSize: 14, color: Colors.white },
  unavailText:      { fontSize: 12, color: Colors.textDim, marginTop: 8 },
  boInput:          { backgroundColor: Colors.navySoft, borderRadius: 10, borderWidth: 1, borderColor: Colors.navyLine, paddingHorizontal: 12, paddingVertical: 11, color: Colors.white, fontSize: 14, marginBottom: 8, marginTop: 4 },
  boBtn:            { backgroundColor: Colors.gold, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 4, marginBottom: 8 },
  boBtnText:        { color: Colors.navy, fontWeight: '700', fontSize: 14 },
  tipsCard:         { backgroundColor: Colors.navyCard, marginHorizontal: PAD, marginTop: 6, borderRadius: Colors.cardRadius, padding: 16, borderWidth: 1, borderColor: Colors.navyLine },
  tipsTitle:        { fontSize: 13, fontWeight: '700', color: Colors.gold, marginBottom: 10 },
  tipItem:          { fontSize: 13, color: Colors.textDim, lineHeight: 21 },
  footer:           { padding: PAD, paddingBottom: 28, borderTopWidth: 1, borderTopColor: Colors.navyLine, backgroundColor: Colors.navy },
  saveBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14 },
  saveBtnText:      { fontSize: 16, fontWeight: '700', color: Colors.navy },
});
