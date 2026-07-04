// © 2026 WiamApp. Powered by WiamLabs
// screens/SkillsManagerScreen.js
// Worker manages skill tags shown on their profile
// Backend: GET/PUT /api/workers/skills

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView,
  ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const NAVY    = '#0D0D2B';
const NAVY2   = '#12123A';
const GOLD    = '#D4A017';
const GOLD_BG = 'rgba(212,160,23,0.10)';
const GOLD_BD = 'rgba(212,160,23,0.25)';
const WHITE   = '#FFFFFF';
const MUTED   = 'rgba(255,255,255,0.45)';
const BORDER  = 'rgba(255,255,255,0.08)';
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

const SUGGESTED_SKILLS = {
  'Electrician':    ['Wiring', 'Solar Installation', 'Generator Repair', 'CCTV Installation', 'AC Installation', 'Lighting', 'Panel Boards', 'Inverter Setup'],
  'Plumber':        ['Pipe Fitting', 'Borehole', 'Ceiling Leaks', 'Bathroom Fitting', 'Water Pumps', 'Drainage', 'Tiles'],
  'Carpenter':      ['Furniture', 'Wardrobes', 'Doors & Windows', 'Flooring', 'Ceiling', 'Roofing'],
  'Painter':        ['Interior Painting', 'Exterior Painting', 'Wallpaper', 'Texture Painting', 'Epoxy Flooring'],
  'Cleaner':        ['Deep Cleaning', 'Post-Construction', 'Office Cleaning', 'Carpet Cleaning', 'Fumigation'],
  'default':        ['Installation', 'Repair', 'Maintenance', 'Inspection', 'Consultation', 'Emergency Service'],
};

export default function SkillsManagerScreen({ navigation, route }) {
  const category  = route?.params?.category || 'default';
  const suggested = SUGGESTED_SKILLS[category] || SUGGESTED_SKILLS.default;

  const [skills,   setSkills]   = useState([]);
  const [custom,   setCustom]   = useState('');
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res  = await fetch(`${BACKEND}/api/workers/skills`);
        const data = await res.json();
        setSkills(data.data || []);
      } catch { } finally { setLoading(false); }
    };
    fetch_();
  }, []);

  const toggleSkill = (skill) => {
    setSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const addCustom = () => {
    const trimmed = custom.trim();
    if (!trimmed || skills.includes(trimmed)) return;
    setSkills(prev => [...prev, trimmed]);
    setCustom('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`${BACKEND}/api/workers/skills`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skills }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={WHITE} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Skills</Text>
        <Text style={s.skillCount}>{skills.length} selected</Text>
      </View>

      {loading ? <ActivityIndicator color={GOLD} style={{ marginTop: 60 }} /> : (
        <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

          <Text style={s.intro}>
            Skills appear on your profile. Customers search by skill — the more accurate, the better.
          </Text>

          {/* Selected skills */}
          {skills.length > 0 && (
            <>
              <Text style={s.sectionLabel}>YOUR SKILLS ({skills.length})</Text>
              <View style={s.tagsWrap}>
                {skills.map(skill => (
                  <TouchableOpacity key={skill} style={s.tagSelected} onPress={() => toggleSkill(skill)}>
                    <Text style={s.tagSelectedText}>{skill}</Text>
                    <Ionicons name="close" size={13} color={NAVY} />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Suggested */}
          <Text style={s.sectionLabel}>SUGGESTED FOR {category.toUpperCase()}</Text>
          <View style={s.tagsWrap}>
            {suggested.filter(s => !skills.includes(s)).map(skill => (
              <TouchableOpacity key={skill} style={s.tagSuggested} onPress={() => toggleSkill(skill)}>
                <Ionicons name="add" size={13} color={GOLD} />
                <Text style={s.tagSuggestedText}>{skill}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Add custom */}
          <Text style={s.sectionLabel}>ADD YOUR OWN</Text>
          <View style={s.customRow}>
            <TextInput
              style={s.customInput}
              placeholder="Type a skill..."
              placeholderTextColor={MUTED}
              value={custom}
              onChangeText={setCustom}
              onSubmitEditing={addCustom}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[s.addBtn, !custom.trim() && s.addBtnDisabled]}
              onPress={addCustom}
              disabled={!custom.trim()}
            >
              <Text style={s.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[s.saveBtn, saved && s.saveBtnDone]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={NAVY} />
              : <>
                  <Ionicons name={saved ? 'checkmark-circle' : 'save-outline'} size={17} color={NAVY} />
                  <Text style={s.saveBtnText}>{saved ? 'Skills Saved!' : 'Save Skills'}</Text>
                </>
            }
          </TouchableOpacity>
          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: NAVY },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle: { color: WHITE, fontSize: 17, fontWeight: '700' },
  skillCount:  { color: GOLD, fontSize: 13, fontWeight: '600' },
  container:   { flexGrow: 1, padding: 20 },
  intro:       { color: MUTED, fontSize: 13, lineHeight: 20, marginBottom: 20 },
  sectionLabel:{ color: GOLD, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 12, marginTop: 8 },
  tagsWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tagSelected: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: GOLD, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  tagSelectedText: { color: NAVY, fontSize: 13, fontWeight: '600' },
  tagSuggested: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: GOLD_BG, borderWidth: 0.5, borderColor: GOLD_BD,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
  },
  tagSuggestedText: { color: GOLD, fontSize: 13 },
  customRow:  { flexDirection: 'row', gap: 8, marginBottom: 24 },
  customInput:{
    flex: 1, backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12, borderWidth: 0.5, borderColor: BORDER,
    padding: 13, color: WHITE, fontSize: 14,
  },
  addBtn:         { backgroundColor: GOLD, borderRadius: 12, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  addBtnDisabled: { backgroundColor: 'rgba(212,160,23,0.25)' },
  addBtnText:     { color: NAVY, fontSize: 14, fontWeight: '700' },
  saveBtn: {
    backgroundColor: GOLD, borderRadius: 13, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  saveBtnDone: { backgroundColor: '#22C55E' },
  saveBtnText: { color: NAVY, fontSize: 15, fontWeight: '700' },
});
