// © 2026 WiamApp. Powered by WiamLabs
// screens/OnboardingScreen.js — 3-path selector (V2/V3 Plan compliant)

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Dimensions, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BrandLogo from '../components/BrandLogo';

const { height } = Dimensions.get('window');

const BG      = '#0D0D2B';
const GOLD    = '#D4A017';
const WHITE   = '#FFFFFF';
const MUTED   = 'rgba(255,255,255,0.45)';
const GOLD_BG = 'rgba(212,160,23,0.10)';

const OPTIONS = [
  {
    id: 'customer',
    icon: 'search-outline',
    title: 'Find a Worker',
    subtitle: 'Hire trusted professionals near you',
    badge: 'CUSTOMER',
  },
  {
    id: 'worker',
    icon: 'hammer-outline',
    title: 'Offer My Skills',
    subtitle: 'Earn income from your trade or talent',
    badge: 'WORKER',
  },
  {
    id: 'business',
    icon: 'business-outline',
    title: 'Register a Business',
    subtitle: 'Manage a team and hire workers at scale',
    badge: 'BUSINESS',
  },
];

export default function OnboardingScreen({ navigation }) {
  const [selected, setSelected] = useState(null);

  const handleContinue = () => {
    if (!selected) return;
    navigation.navigate('Register', { role: selected });
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <View style={s.container}>

        {/* Logo + name */}
        <View style={s.brand}>
          <BrandLogo size="md" />
          <Text style={s.brandName}>
            <Text style={{ color: WHITE }}>Wiam</Text>
            <Text style={{ color: GOLD }}>App</Text>
          </Text>
          <Text style={s.brandSub}>POWERED BY WIAMLABS</Text>
        </View>

        {/* Question */}
        <Text style={s.question}>
          Africa's trusted service marketplace.{'\n'}What brings you here today?
        </Text>

        {/* Path label */}
        <Text style={s.pathLabel}>CHOOSE YOUR PATH</Text>

        {/* Options */}
        {OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            style={[s.optionCard, selected === opt.id && s.optionCardActive]}
            onPress={() => setSelected(opt.id)}
            activeOpacity={0.85}
          >
            <View style={[s.optionIcon, selected === opt.id && s.optionIconActive]}>
              <Ionicons
                name={opt.icon}
                size={22}
                color={selected === opt.id ? GOLD : 'rgba(255,255,255,0.5)'}
              />
            </View>
            <View style={s.optionContent}>
              <View style={s.optionTop}>
                <Text style={s.optionTitle}>{opt.title}</Text>
                <View style={[s.optionBadge, selected === opt.id && s.optionBadgeActive]}>
                  <Text style={[s.optionBadgeText, selected === opt.id && s.optionBadgeTextActive]}>
                    {opt.badge}
                  </Text>
                </View>
              </View>
              <Text style={s.optionSubtitle}>{opt.subtitle}</Text>
            </View>
            <Ionicons
              name={selected === opt.id ? 'checkmark-circle' : 'chevron-forward'}
              size={18}
              color={selected === opt.id ? GOLD : 'rgba(255,255,255,0.2)'}
            />
          </TouchableOpacity>
        ))}

        {/* Continue button */}
        <TouchableOpacity
          style={[s.continueBtn, !selected && s.continueBtnDisabled]}
          onPress={handleContinue}
          activeOpacity={0.85}
        >
          <Text style={[s.continueBtnText, !selected && s.continueBtnTextDisabled]}>
            Continue
          </Text>
          {selected && <Ionicons name="arrow-forward" size={16} color={BG} style={{ marginLeft: 6 }} />}
        </TouchableOpacity>

        {/* Login link */}
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={s.loginText}>
            Have an account? <Text style={s.loginLink}>Log In</Text>
          </Text>
        </TouchableOpacity>

        <Text style={s.copyright}>© 2026 WiamApp · Powered by WiamLabs</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  container: { flex: 1, paddingHorizontal: 24, paddingBottom: 20 },

  // Brand
  brand: { alignItems: 'center', paddingTop: height * 0.05, paddingBottom: 20 },
  logo: { width: 56, height: 56, marginBottom: 10 },
  brandName: { fontSize: 24, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  brandSub: { color: 'rgba(212,160,23,0.55)', fontSize: 9, fontWeight: '600', letterSpacing: 2.5 },

  // Question
  question: {
    color: MUTED, fontSize: 13, textAlign: 'center',
    lineHeight: 20, marginBottom: 24,
  },
  pathLabel: {
    color: 'rgba(255,255,255,0.3)', fontSize: 10,
    letterSpacing: 2, textAlign: 'center', marginBottom: 12,
  },

  // Option cards
  optionCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 10,
  },
  optionCardActive: {
    borderColor: GOLD,
    backgroundColor: 'rgba(212,160,23,0.07)',
  },
  optionIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
    flexShrink: 0,
  },
  optionIconActive: { backgroundColor: GOLD_BG },
  optionContent: { flex: 1 },
  optionTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  optionTitle: { color: WHITE, fontSize: 14, fontWeight: '600' },
  optionBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  optionBadgeActive: { backgroundColor: GOLD_BG },
  optionBadgeText: { color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  optionBadgeTextActive: { color: GOLD },
  optionSubtitle: { color: MUTED, fontSize: 12 },

  // Continue
  continueBtn: {
    backgroundColor: GOLD, borderRadius: 13,
    paddingVertical: 15, alignItems: 'center',
    marginTop: 14, marginBottom: 12,
    flexDirection: 'row', justifyContent: 'center',
  },
  continueBtnDisabled: { backgroundColor: 'rgba(212,160,23,0.25)' },
  continueBtnText: { color: BG, fontSize: 15, fontWeight: '700' },
  continueBtnTextDisabled: { color: 'rgba(255,255,255,0.3)' },

  // Login
  loginText: { color: MUTED, fontSize: 13, textAlign: 'center', marginBottom: 16 },
  loginLink: { color: GOLD, fontWeight: '600' },

  copyright: { color: 'rgba(212,160,23,0.3)', fontSize: 10, textAlign: 'center', letterSpacing: 0.5 },
});
