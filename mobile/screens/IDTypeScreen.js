// © 2026 WiamApp. Powered by WiamLabs
// screens/IDTypeScreen.js
// Worker selects their ID type — auto-determines if back side is needed
// Fix: Continue button now correctly navigates to IDUploadScreen with all params

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BrandLogo from '../components/BrandLogo';
import { Colors } from '../constants/colors';

const NAVY  = Colors.navyDeep;
const GOLD  = Colors.gold;
const WHITE = Colors.white;
const MUTED = 'rgba(255,255,255,0.45)';
const BORDER= 'rgba(255,255,255,0.09)';

// requiresBack = true means we ask for both front AND back photos
const ID_TYPES = [
  {
    id:           'ghana_card',
    label:        'Ghana Card',
    icon:         'id-card-outline',
    requiresBack: true,
    note:         'Front + Back (QR code on back is required)',
  },
  {
    id:           'driver_license',
    label:        'Driver License',
    icon:         'car-outline',
    requiresBack: true,
    note:         'Front + Back (vehicle categories on back)',
  },
  {
    id:           'passport',
    label:        'Passport',
    icon:         'book-outline',
    requiresBack: false,
    note:         'Photo page only (back is blank)',
  },
  {
    id:           'voter_id',
    label:        'Voter ID',
    icon:         'people-outline',
    requiresBack: false,
    note:         'Front only (back is blank)',
  },
  {
    id:           'nin_card',
    label:        'NIN Card',
    icon:         'id-card-outline',
    requiresBack: false,
    note:         'Front only (all information is on front)',
  },
  {
    id:           'nhis_card',
    label:        'NHIS Card',
    icon:         'medical-outline',
    requiresBack: true,
    note:         'Front + Back (both sides have important data)',
  },
];

export default function IDTypeScreen({ navigation, route }) {
  // Accept params passed from WorkerVerifyIntroScreen or LoginScreen
  const { email, token, userId } = route?.params || {};
  const [selected, setSelected] = useState(null);

  const handleContinue = () => {
    if (!selected) return;
    const idType = ID_TYPES.find(t => t.id === selected);
    if (!idType) return;

    // ✅ FIX: Navigate with all required params for IDUploadScreen
    navigation.navigate('IDUpload', {
      email,
      token,
      userId,
      idType:       idType.id,
      idLabel:      idType.label,
      requiresBack: idType.requiresBack,
    });
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <ScrollView
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={WHITE} />
        </TouchableOpacity>

        {/* Logo */}
        <View style={s.brand}>
          <BrandLogo size="md" />
        </View>

        {/* Progress bar — step 2 of 4 */}
        <View style={s.progress}>
          <View style={[s.step, s.stepDone]} />
          <View style={[s.step, s.stepActive]} />
          <View style={s.step} />
          <View style={s.step} />
        </View>
        <Text style={s.progressLabel}>Step 2 of 4 — Choose ID type</Text>

        <Text style={s.title}>Select your ID type</Text>
        <Text style={s.subtitle}>
          Choose the government-issued ID you want to use. WiamApp accepts all major Ghana IDs.
        </Text>

        {/* ID type cards */}
        {ID_TYPES.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={[s.card, selected === type.id && s.cardActive]}
            onPress={() => setSelected(type.id)}
            activeOpacity={0.8}
          >
            <View style={[s.cardIcon, selected === type.id && s.cardIconActive]}>
              <Ionicons
                name={type.icon}
                size={20}
                color={selected === type.id ? GOLD : MUTED}
              />
            </View>

            <View style={s.cardContent}>
              <Text style={[s.cardLabel, selected === type.id && { color: WHITE, fontWeight: '700' }]}>
                {type.label}
              </Text>
              <View style={s.noteRow}>
                <Ionicons
                  name={type.requiresBack ? 'albums-outline' : 'document-outline'}
                  size={11}
                  color={selected === type.id ? GOLD : MUTED}
                />
                <Text style={[s.cardNote, selected === type.id && { color: GOLD }]}>
                  {type.note}
                </Text>
              </View>
            </View>

            {/* Radio button */}
            <View style={[s.radio, selected === type.id && s.radioActive]}>
              {selected === type.id && <View style={s.radioDot} />}
            </View>
          </TouchableOpacity>
        ))}

        {/* Info box */}
        <View style={s.infoBox}>
          <Ionicons name="shield-checkmark-outline" size={16} color={GOLD} />
          <Text style={s.infoText}>
            Your ID is encrypted and stored securely. It is only used for identity verification and is never shared with customers.
          </Text>
        </View>

        {/* Continue button */}
        <TouchableOpacity
          style={[s.btn, !selected && s.btnDisabled]}
          onPress={handleContinue}
          disabled={!selected}
          activeOpacity={0.85}
        >
          <Text style={[s.btnText, !selected && s.btnTextDisabled]}>
            Continue
          </Text>
          {selected && (
            <Ionicons name="arrow-forward" size={16} color={NAVY} style={{ marginLeft: 8 }} />
          )}
        </TouchableOpacity>

        {selected && (
          <Text style={s.selectedHint}>
            Selected: <Text style={{ color: GOLD }}>{ID_TYPES.find(t => t.id === selected)?.label}</Text>
            {' '}·{' '}
            {ID_TYPES.find(t => t.id === selected)?.requiresBack
              ? 'You will upload front & back'
              : 'You will upload front only'}
          </Text>
        )}

        <Text style={s.copy}>© 2026 WiamApp · Powered by WiamLabs</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: NAVY },
  container:     { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 48 },
  backBtn:       { marginTop: 16, marginBottom: 8, width: 40, padding: 4 },
  brand:         { alignItems: 'center', marginBottom: 14 },
  logo:          { width: 44, height: 44 },
  progress:      { flexDirection: 'row', gap: 6, marginBottom: 6 },
  step:          { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)' },
  stepDone:      { backgroundColor: GOLD },
  stepActive:    { backgroundColor: 'rgba(212,160,23,0.45)' },
  progressLabel: { color: MUTED, fontSize: 11, marginBottom: 20 },
  title:         { color: WHITE, fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle:      { color: MUTED, fontSize: 13, lineHeight: 20, marginBottom: 22 },

  card:          { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 14, marginBottom: 10 },
  cardActive:    { borderColor: GOLD, backgroundColor: 'rgba(212,160,23,0.07)' },
  cardIcon:      { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardIconActive:{ backgroundColor: 'rgba(212,160,23,0.12)' },
  cardContent:   { flex: 1 },
  cardLabel:     { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '500', marginBottom: 4 },
  noteRow:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardNote:      { color: MUTED, fontSize: 11 },
  radio:         { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  radioActive:   { borderColor: GOLD },
  radioDot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: GOLD },

  infoBox:       { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: 'rgba(212,160,23,0.07)', borderWidth: 1, borderColor: 'rgba(212,160,23,0.2)', borderRadius: 12, padding: 14, marginTop: 10, marginBottom: 4 },
  infoText:      { flex: 1, color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 18 },

  btn:           { backgroundColor: GOLD, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20, flexDirection: 'row', justifyContent: 'center' },
  btnDisabled:   { backgroundColor: 'rgba(212,160,23,0.2)' },
  btnText:       { color: NAVY, fontSize: 16, fontWeight: '700' },
  btnTextDisabled:{ color: 'rgba(255,255,255,0.25)' },

  selectedHint:  { color: MUTED, fontSize: 12, textAlign: 'center', marginTop: 12 },
  copy:          { color: 'rgba(212,160,23,0.25)', fontSize: 10, textAlign: 'center', marginTop: 20 },
});
