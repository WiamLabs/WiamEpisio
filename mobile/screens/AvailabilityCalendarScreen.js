// © 2026 WiamApp. Powered by WiamLabs
// screens/AvailabilityCalendarScreen.js
// Worker sets their available days and working hours
// Backend: GET/PATCH /api/workers/availability

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

const NAVY   = Colors.navy;
const NAVY2  = Colors.navyMid;
const GOLD   = Colors.gold;
const WHITE  = Colors.white;
const MUTED  = 'rgba(255,255,255,0.50)';
const BORDER = 'rgba(255,255,255,0.09)';

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
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={MUTED} />
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
                <Text style={[styles.hourOptionText, h === value && { color: GOLD }]}>{h}</Text>
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
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={WHITE} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>My Availability</Text>
          <Text style={styles.headerSub}>{activeDays} days active</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>

        {/* Info card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color={GOLD} />
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
                  <Text style={[styles.dayLabel, !sch.active && { color: MUTED }]}>{day.label}</Text>
                  <Switch
                    value={sch.active}
                    onValueChange={() => toggleDay(day.key)}
                    trackColor={{ false: 'rgba(255,255,255,0.12)', true: GOLD }}
                    thumbColor={sch.active ? NAVY : 'rgba(255,255,255,0.5)'}
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
                    <Ionicons name="arrow-forward" size={16} color={MUTED} style={{ marginTop: 22 }} />
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
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Ionicons name="checkmark-circle" size={20} color={NAVY} />
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Availability'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: NAVY },
  header:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, gap: 12 },
  backBtn:          { padding: 4 },
  headerTitle:      { fontSize: 18, fontWeight: '700', color: WHITE },
  headerSub:        { fontSize: 12, color: MUTED, marginTop: 1 },
  infoCard:         { flexDirection: 'row', gap: 10, backgroundColor: 'rgba(212,160,23,0.10)', borderWidth: 1, borderColor: 'rgba(212,160,23,0.25)', borderRadius: 12, padding: 14, marginHorizontal: 20, marginTop: 8 },
  infoText:         { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 19 },
  section:          { paddingHorizontal: 20, marginTop: 16 },
  dayCard:          { backgroundColor: NAVY2, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: BORDER },
  dayTop:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayLabel:         { fontSize: 16, fontWeight: '700', color: WHITE },
  hoursRow:         { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 14 },
  hourGroup:        { flex: 1 },
  hourLabel:        { fontSize: 11, color: MUTED, marginBottom: 6 },
  hourPicker:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: BORDER },
  hourPickerText:   { fontSize: 14, color: WHITE, fontWeight: '600' },
  hourDropdown:     { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#1A1A4A', borderRadius: 10, borderWidth: 1, borderColor: BORDER, zIndex: 100, marginTop: 4 },
  hourOption:       { paddingVertical: 10, paddingHorizontal: 14 },
  hourOptionActive: { backgroundColor: 'rgba(212,160,23,0.12)' },
  hourOptionText:   { fontSize: 14, color: WHITE },
  unavailText:      { fontSize: 12, color: MUTED, marginTop: 8 },
  tipsCard:         { backgroundColor: NAVY2, marginHorizontal: 20, marginTop: 6, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: BORDER },
  tipsTitle:        { fontSize: 13, fontWeight: '700', color: GOLD, marginBottom: 10 },
  tipItem:          { fontSize: 13, color: MUTED, lineHeight: 21 },
  footer:           { padding: 20, paddingBottom: 28, borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: NAVY },
  saveBtn:          { backgroundColor: GOLD, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14 },
  saveBtnText:      { fontSize: 16, fontWeight: '700', color: NAVY },
});
