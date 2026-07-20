/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import {
  ChevronLeft, ChevronRight, HelpCircle, FileText, Shield, Lock, Info, ExternalLink,
} from 'lucide-react-native';

const BASE = 'https://wiamapp.com';

const SECTIONS = [
  { title: 'Help Center', sub: 'FAQ, guides, and support', icon: HelpCircle, color: '#38bdf8', url: '/help' },
  { title: 'Community Guidelines', sub: 'Rules for a safe community', icon: FileText, color: '#a78bfa', url: '/community-guidelines' },
  { title: 'Terms of Service', sub: 'Terms and conditions', icon: FileText, color: '#fbbf24', url: '/terms' },
  { title: 'Privacy Policy', sub: 'How we handle your data', icon: Lock, color: '#4ade80', url: '/privacy' },
  { title: 'About WiamLabs', sub: 'The team behind WiamApp', icon: Info, color: '#d4a843', url: '/about' },
];

const HelpCenterScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Help & Info</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {SECTIONS.map((sec, i) => {
          const Icon = sec.icon;
          return (
            <TouchableOpacity
              key={i}
              style={s.card}
              onPress={() => Linking.openURL(BASE + sec.url)}
            >
              <View style={[s.iconWrap, { backgroundColor: sec.color + '18' }]}>
                <Icon size={20} color={sec.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{sec.title}</Text>
                <Text style={s.cardSub}>{sec.sub}</Text>
              </View>
              <ExternalLink size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          );
        })}

        <View style={s.contact}>
          <Text style={s.contactTitle}>Need more help?</Text>
          <Text style={s.contactSub}>Contact us at support@wiamapp.com</Text>
          <TouchableOpacity
            style={s.contactBtn}
            onPress={() => navigation.navigate('Feedback')}
          >
            <Text style={s.contactBtnText}>Send feedback</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 10 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  cardSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  contact: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  contactTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  contactSub: { fontSize: 13, color: COLORS.textMuted },
  contactBtn: { marginTop: 12, backgroundColor: COLORS.secondary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  contactBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
});

export default HelpCenterScreen;
