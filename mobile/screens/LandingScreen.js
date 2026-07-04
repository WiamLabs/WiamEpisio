// © 2026 WiamApp. Powered by WiamLabs
// screens/LandingScreen.js — V3 Plan compliant

import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView,  StatusBar,
  Dimensions, Linking, Animated, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const LOGO   = require('../assets/logo.png');

const BG       = '#0D0D2B';
const CARD     = 'rgba(255,255,255,0.05)';
const BORDER   = 'rgba(255,255,255,0.08)';
const GOLD     = '#D4A017';
const WHITE    = '#FFFFFF';
const MUTED    = 'rgba(255,255,255,0.45)';
const GOLD_BG  = 'rgba(212,160,23,0.10)';
const GOLD_BDR = 'rgba(212,160,23,0.22)';
const DIVIDER  = 'rgba(255,255,255,0.07)';

const STATS = [
  { value: '500+', label: 'Verified\nWorkers' },
  { value: '12',   label: 'Service\nCategories' },
  { value: '100%', label: 'Secure\nPayments' },
  { value: '24hr', label: 'ID\nVerified' },
];

const STEPS = [
  { num: '1', icon: 'search-outline',          title: 'Search',   desc: 'Find verified workers near you across 12 categories' },
  { num: '2', icon: 'chatbubbles-outline',      title: 'Chat',     desc: 'Talk directly and agree on price before booking' },
  { num: '3', icon: 'shield-checkmark-outline', title: 'Pay Safe', desc: 'Money held in escrow — released when job is done right' },
];

const FOR_CUSTOMERS = [
  { icon: 'shield-checkmark-outline', text: 'Every worker verified with real Ghana Card' },
  { icon: 'lock-closed-outline',      text: 'Escrow payment — your money is protected' },
  { icon: 'star-outline',             text: 'Only real customers can leave reviews' },
  { icon: 'flash-outline',            text: 'Emergency mode for urgent help' },
  { icon: 'location-outline',         text: 'Find workers closest to your location' },
];

const FOR_WORKERS = [
  { icon: 'trending-up-outline', text: 'Build a verified reputation that earns trust' },
  { icon: 'wallet-outline',      text: 'Get paid safely after every job' },
  { icon: 'people-outline',      text: 'Steady stream of customers near you' },
  { icon: 'ribbon-outline',      text: 'Earn badges that make you stand out' },
  { icon: 'megaphone-outline',   text: 'Spotlight your skills to more customers' },
];

const FOR_BUSINESS = [
  { icon: 'checkmark-circle-outline', text: 'Gold Checkmark — highest trust badge' },
  { icon: 'people-circle-outline',    text: 'Manage your entire team in one place' },
  { icon: 'analytics-outline',        text: 'Full analytics and spending reports' },
  { icon: 'rocket-outline',           text: 'Priority placement above all workers' },
  { icon: 'globe-outline',            text: 'Enterprise tools as your company scales' },
];

const CATEGORIES = [
  { emoji: '🧱', name: 'Building' },
  { emoji: '🚰', name: 'Plumbing' },
  { emoji: '⚡', name: 'Electrical' },
  { emoji: '🚗', name: 'Automotive' },
  { emoji: '🎨', name: 'Painting' },
  { emoji: '🧹', name: 'Cleaning' },
  { emoji: '💈', name: 'Beauty' },
  { emoji: '🍽️', name: 'Catering' },
  { emoji: '📸', name: 'Media' },
  { emoji: '🚴', name: 'Delivery' },
  { emoji: '📚', name: 'Education' },
  { emoji: '🎉', name: 'Events' },
];

const TRUST = [
  { icon: 'id-card-outline',          title: 'Identity Verified',  desc: 'Every worker and customer verified with a real government ID' },
  { icon: 'lock-closed-outline',      title: 'Payment Protected',  desc: 'Escrow holds your money until the job is confirmed done right' },
  { icon: 'star-outline',             title: 'Genuine Reviews',    desc: 'Only customers who completed a booking can leave a review' },
  { icon: 'shield-checkmark-outline', title: 'Fraud Traceable',    desc: 'Ghana Card on file — if fraud occurs we can trace and report' },
];

const Tag = ({ label }) => (
  <View style={s.tag}><Text style={s.tagText}>{label}</Text></View>
);
const Divider = () => <View style={s.divider} />;
const Benefit = ({ icon, text }) => (
  <View style={s.benefitRow}>
    <View style={s.benefitIcon}><Ionicons name={icon} size={15} color={GOLD} /></View>
    <Text style={s.benefitText}>{text}</Text>
  </View>
);

export default function LandingScreen({ navigation }) {
  const fade   = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── HERO ─────────────────────────────────────────── */}
        <Animated.View style={[s.hero, { opacity: fade, transform: [{ translateY: slideY }] }]}>

          {/* Logo centered at top — large */}
          <Image source={LOGO} style={s.heroLogo} resizeMode="contain" />

          {/* WiamApp name — Wiam white App gold */}
          <Text style={s.heroName}>
            <Text style={s.heroNameWiam}>Wiam</Text>
            <Text style={s.heroNameApp}>App</Text>
          </Text>
          <Text style={s.heroPowered}>POWERED BY WIAMLABS</Text>

          {/* Headline */}
          <Text style={s.headline}>
            Africa's Most Trusted{'\n'}Service Marketplace
          </Text>
          <Text style={s.heroSub}>
            Find verified workers. Book safely.{'\n'}Pay securely. Build a reputation.
          </Text>

          {/* CTA Button */}
          <TouchableOpacity
            style={s.btnPrimary}
            onPress={() => navigation.navigate('Register')}
            activeOpacity={0.85}
          >
            <Text style={s.btnPrimaryText}>Find a Worker</Text>
            <Ionicons name="arrow-forward" size={17} color={BG} />
          </TouchableOpacity>

          {/* Login link */}
          <View style={s.loginRow}>
            <Text style={s.loginText}>Have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={s.loginLink}>Log In</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── STATS ────────────────────────────────────────── */}
        <View style={s.statsRow}>
          {STATS.map((st, i) => (
            <React.Fragment key={i}>
              <View style={s.statItem}>
                <Text style={s.statValue}>{st.value}</Text>
                <Text style={s.statLabel}>{st.label}</Text>
              </View>
              {i < STATS.length - 1 && <View style={s.statSep} />}
            </React.Fragment>
          ))}
        </View>

        <Divider />

        {/* ── HOW IT WORKS ─────────────────────────────────── */}
        <View style={s.section}>
          <Tag label="HOW IT WORKS" />
          <Text style={s.sectionTitle}>Three simple steps</Text>
          {STEPS.map((step, i) => (
            <View key={i} style={s.stepCard}>
              <View style={s.stepNum}><Text style={s.stepNumText}>{step.num}</Text></View>
              <View style={s.stepIcon}><Ionicons name={step.icon} size={20} color={GOLD} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.stepTitle}>{step.title}</Text>
                <Text style={s.stepDesc}>{step.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <Divider />

        {/* ── FOR CUSTOMERS ────────────────────────────────── */}
        <View style={s.section}>
          <Tag label="FOR CUSTOMERS" />
          <Text style={s.sectionTitle}>Find trusted help, fast</Text>
          <Text style={s.sectionDesc}>Every worker is verified with a real government ID. Your money is protected until the job is done right.</Text>
          {FOR_CUSTOMERS.map((b, i) => <Benefit key={i} {...b} />)}
        </View>

        <Divider />

        {/* ── FOR WORKERS ──────────────────────────────────── */}
        <View style={s.section}>
          <Tag label="FOR WORKERS" />
          <Text style={s.sectionTitle}>Turn your skills into income</Text>
          <Text style={s.sectionDesc}>Create a verified profile, build your reputation, and get consistent jobs from customers near you.</Text>
          {FOR_WORKERS.map((b, i) => <Benefit key={i} {...b} />)}
        </View>

        <Divider />

        {/* ── FOR BUSINESSES ───────────────────────────────── */}
        <View style={s.section}>
          <Tag label="FOR BUSINESSES" />
          <Text style={s.sectionTitle}>Grow your service company</Text>
          <Text style={s.sectionDesc}>Get the Gold Checkmark badge. Manage your team. Access enterprise tools built for serious companies.</Text>
          {FOR_BUSINESS.map((b, i) => <Benefit key={i} {...b} />)}
        </View>

        <Divider />

        {/* ── CATEGORIES ───────────────────────────────────── */}
        <View style={s.section}>
          <Tag label="SERVICE CATEGORIES" />
          <Text style={s.sectionTitle}>12 categories, 90+ skills</Text>
          <View style={s.catGrid}>
            {CATEGORIES.map((cat, i) => (
              <View key={i} style={s.catChip}>
                <Text style={s.catEmoji}>{cat.emoji}</Text>
                <Text style={s.catName}>{cat.name}</Text>
              </View>
            ))}
          </View>
        </View>

        <Divider />

        {/* ── TRUST ────────────────────────────────────────── */}
        <View style={s.section}>
          <Tag label="SECURITY" />
          <Text style={s.sectionTitle}>Built for trust and safety</Text>
          {TRUST.map((t, i) => (
            <View key={i} style={s.trustCard}>
              <View style={s.trustIcon}><Ionicons name={t.icon} size={18} color={GOLD} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.trustTitle}>{t.title}</Text>
                <Text style={s.trustDesc}>{t.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <Divider />

        {/* ── FINAL CTA ────────────────────────────────────── */}
        <View style={s.ctaSection}>
          <Text style={s.ctaTitle}>Ready to join WiamApp?</Text>
          <Text style={s.ctaDesc}>Join workers and customers across Ghana</Text>
          <TouchableOpacity
            style={s.btnPrimary}
            onPress={() => navigation.navigate('Register')}
            activeOpacity={0.85}
          >
            <Text style={s.btnPrimaryText}>Create Your Account</Text>
            <Ionicons name="arrow-forward" size={17} color={BG} />
          </TouchableOpacity>
        </View>

        {/* ── FOOTER ───────────────────────────────────────── */}
        <View style={s.footer}>
          <Text style={s.footerName}>
            <Text style={{ color: WHITE }}>Wiam</Text>
            <Text style={{ color: GOLD }}>App</Text>
          </Text>
          <Text style={s.footerSub}>Africa's Trusted Service Marketplace</Text>
          <View style={s.footerLinks}>
            {['Careers', 'Terms', 'Privacy', 'Contact'].map((link, i) => (
              <React.Fragment key={i}>
                {i > 0 && <Text style={s.footerDot}>·</Text>}
                <TouchableOpacity onPress={() => Linking.openURL(`https://wiamapp.com/${link.toLowerCase()}`)}>
                  <Text style={s.footerLink}>{link}</Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
          <Text style={s.footerCopy}>© 2026 WiamApp · Powered by WiamLabs</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  // Hero
  hero: { paddingHorizontal: 24, paddingTop: 36, paddingBottom: 36, alignItems: 'center' },
  heroLogo: { width: 90, height: 90, marginBottom: 14 },
  heroName: { fontSize: 28, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  heroNameWiam: { color: WHITE },
  heroNameApp:  { color: GOLD },
  heroPowered: { color: 'rgba(212,160,23,0.55)', fontSize: 9, fontWeight: '600', letterSpacing: 2.5, marginBottom: 24 },
  headline: { color: WHITE, fontSize: 22, fontWeight: '700', textAlign: 'center', lineHeight: 32, marginBottom: 10 },
  heroSub:  { color: MUTED, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 28 },

  // Buttons
  btnPrimary: {
    backgroundColor: GOLD, borderRadius: 13,
    paddingVertical: 15, paddingHorizontal: 28,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    width: '100%', marginBottom: 14,
  },
  btnPrimaryText: { color: BG, fontSize: 15, fontWeight: '700' },
  loginRow: { flexDirection: 'row', alignItems: 'center' },
  loginText: { color: MUTED, fontSize: 13 },
  loginLink: { color: GOLD, fontSize: 13, fontWeight: '600' },

  // Stats
  statsRow: {
    flexDirection: 'row', paddingVertical: 20, paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { color: WHITE, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  statLabel: { color: MUTED, fontSize: 10, textAlign: 'center', lineHeight: 14 },
  statSep:   { width: 0.5, backgroundColor: BORDER, marginVertical: 6 },

  // Divider
  divider: { height: 0.5, backgroundColor: DIVIDER, marginHorizontal: 24 },

  // Sections
  section: { paddingHorizontal: 24, paddingVertical: 28 },
  tag: {
    backgroundColor: GOLD_BG, borderWidth: 0.5, borderColor: GOLD_BDR,
    borderRadius: 20, paddingHorizontal: 11, paddingVertical: 4,
    alignSelf: 'flex-start', marginBottom: 12,
  },
  tagText: { color: GOLD, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  sectionTitle: { color: WHITE, fontSize: 20, fontWeight: '700', marginBottom: 8, lineHeight: 28 },
  sectionDesc:  { color: MUTED, fontSize: 13, lineHeight: 20, marginBottom: 16 },

  // Steps
  stepCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: CARD, borderRadius: 13, borderWidth: 0.5, borderColor: BORDER,
    padding: 13, marginBottom: 10,
  },
  stepNum: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: GOLD,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
  },
  stepNumText: { color: BG, fontSize: 11, fontWeight: '800' },
  stepIcon: {
    width: 36, height: 36, borderRadius: 9, backgroundColor: GOLD_BG,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepTitle: { color: WHITE, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  stepDesc:  { color: MUTED, fontSize: 12, lineHeight: 18 },

  // Benefits
  benefitRow: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: DIVIDER,
  },
  benefitIcon: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: GOLD_BG,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  benefitText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, flex: 1, lineHeight: 19 },

  // Categories
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  catChip: {
    backgroundColor: CARD, borderRadius: 10, borderWidth: 0.5, borderColor: BORDER,
    paddingHorizontal: 12, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  catEmoji: { fontSize: 15 },
  catName:  { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '500' },

  // Trust
  trustCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: CARD, borderRadius: 13, borderWidth: 0.5, borderColor: BORDER,
    padding: 13, marginBottom: 9,
  },
  trustIcon: {
    width: 36, height: 36, borderRadius: 9, backgroundColor: GOLD_BG,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  trustTitle: { color: WHITE, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  trustDesc:  { color: MUTED, fontSize: 12, lineHeight: 17 },

  // CTA
  ctaSection: {
    paddingHorizontal: 24, paddingVertical: 36, alignItems: 'center',
    backgroundColor: 'rgba(212,160,23,0.05)',
    borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: GOLD_BDR,
  },
  ctaTitle: { color: WHITE, fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  ctaDesc:  { color: MUTED, fontSize: 13, textAlign: 'center', marginBottom: 24 },

  // Footer
  footer: {
    paddingHorizontal: 24, paddingVertical: 28, alignItems: 'center',
    borderTopWidth: 0.5, borderTopColor: DIVIDER,
  },
  footerName: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  footerSub:  { color: 'rgba(255,255,255,0.25)', fontSize: 11, marginBottom: 16 },
  footerLinks: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 14, flexWrap: 'wrap', justifyContent: 'center',
  },
  footerLink: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  footerDot:  { color: 'rgba(255,255,255,0.2)', fontSize: 12 },
  footerCopy: { color: 'rgba(212,160,23,0.3)', fontSize: 10, letterSpacing: 0.3 },
});
