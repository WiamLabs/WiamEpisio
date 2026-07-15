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
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, goldGradient } from '../constants/colors';

import { searchWiamAppSkills, resolveWiamAppSkill } from '../constants/skills';

const PAD = Colors.screenPad;
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
  const [showTip,  setShowTip]  = useState(true);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [matches,  setMatches]  = useState([]);
  const [skillError, setSkillError] = useState('');

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
    const resolved = resolveWiamAppSkill(trimmed);
    if (!resolved) {
      setSkillError('That skill is not on WiamApp. Pick from the suggestions.');
      return;
    }
    setSkills(prev => [...prev, resolved.skillName]);
    setCustom('');
    setMatches([]);
    setSkillError('');
    setShowTip(false);
  };

  const onCustomChange = (text) => {
    setCustom(text);
    if (text.trim()) setShowTip(false);
    else setShowTip(true);
    setSkillError('');
    setMatches(searchWiamAppSkills(text, 6));
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
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Skills & Categories</Text>
        <Text style={s.skillCount}>{skills.length} selected</Text>
      </View>

      {loading ? <ActivityIndicator color={Colors.gold} style={{ marginTop: 60 }} /> : (
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
                    <Ionicons name="close" size={13} color={Colors.navy} />
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
                <Ionicons name="add" size={13} color={Colors.gold} />
                <Text style={s.tagSuggestedText}>{skill}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Add custom — must match WiamApp skills */}
          <Text style={s.sectionLabel}>ADD A WIAMAPP SKILL</Text>
          {showTip && (
            <View style={s.tipBox}>
              <Ionicons name="information-circle-outline" size={15} color={Colors.gold} />
              <Text style={s.tipText}>
                Type a skill WiamApp offers (e.g. Electrician, Barber). The tip disappears when you type — pick a suggestion so customers can find you.
              </Text>
            </View>
          )}
          <View style={s.customRow}>
            <TextInput
              style={s.customInput}
              placeholder="Type a skill..."
              placeholderTextColor={Colors.textDim}
              value={custom}
              onChangeText={onCustomChange}
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
          {!!skillError && <Text style={s.errText}>{skillError}</Text>}
          {matches.length > 0 && (
            <View style={s.matchList}>
              {matches.map((m) => (
                <TouchableOpacity
                  key={m.name}
                  style={s.matchRow}
                  onPress={() => {
                    setCustom(m.name);
                    setMatches([]);
                    setShowTip(false);
                    setSkillError('');
                  }}
                >
                  <Text style={s.matchName}>{m.name}</Text>
                  <Text style={s.matchCat}>{m.category}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

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
                    <Text style={s.saveBtnText}>{saved ? 'Skills Saved!' : 'Save Skills'}</Text>
                  </>
              }
            </LinearGradient>
          </TouchableOpacity>
          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.navy },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PAD, paddingVertical: 14 },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.navyCard, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.white, fontSize: 17, fontWeight: '700', flex: 1, marginLeft: 12 },
  skillCount:  { color: Colors.gold, fontSize: 13, fontWeight: '600' },
  container:   { flexGrow: 1, padding: PAD },
  intro:       { color: Colors.textDim, fontSize: 13, lineHeight: 20, marginBottom: 20 },
  sectionLabel:{ color: Colors.gold, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 12, marginTop: 8 },
  tagsWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tagSelected: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.gold, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  tagSelectedText: { color: Colors.navy, fontSize: 13, fontWeight: '600' },
  tagSuggested: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(212,160,23,0.10)', borderWidth: 1, borderColor: 'rgba(212,160,23,0.25)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
  },
  tagSuggestedText: { color: Colors.gold, fontSize: 13 },
  customRow:  { flexDirection: 'row', gap: 8, marginBottom: 24 },
  customInput:{
    flex: 1, backgroundColor: Colors.navySoft,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.navyLine,
    padding: 13, color: Colors.white, fontSize: 14,
  },
  addBtn:         { backgroundColor: Colors.gold, borderRadius: 12, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  addBtnDisabled: { backgroundColor: 'rgba(212,160,23,0.25)' },
  addBtnText:     { color: Colors.navy, fontSize: 14, fontWeight: '700' },
  tipBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: 'rgba(212,160,23,0.10)', borderWidth: 1, borderColor: 'rgba(212,160,23,0.25)',
    borderRadius: 14, padding: 12, marginBottom: 10,
  },
  tipText: { flex: 1, color: Colors.textDim, fontSize: 12.5, lineHeight: 18 },
  errText: { color: Colors.error, fontSize: 12, marginBottom: 8 },
  matchList: {
    backgroundColor: Colors.navyCard, borderRadius: 12, borderWidth: 1, borderColor: Colors.navyLine,
    marginBottom: 16, overflow: 'hidden',
  },
  matchRow: {
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.navyLine,
  },
  matchName: { color: Colors.white, fontSize: 14, fontWeight: '600' },
  matchCat: { color: Colors.textDim, fontSize: 11, marginTop: 2 },
  saveBtn: {
    borderRadius: 14, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  saveBtnText: { color: Colors.navy, fontSize: 15, fontWeight: '700' },
});
