import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { ChevronLeft, Briefcase, ExternalLink, Bug, ShieldCheck } from 'lucide-react-native';
import useAuthStore from '../../store/useAuthStore';

const CareersScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const isFounder = !!(user?.is_founder || user?.role === 'founder');
  const isOverallBoss = user?.role === 'overall_boss';
  const isQATester = user?.role === 'qa_tester';
  const isTeamMember = !!(user?.is_team_member || isFounder || isOverallBoss || isQATester);

  const openQADashboard = async () => {
    const url = (isFounder || isOverallBoss)
      ? 'https://wiamapp.com/team?view=qa_tester'
      : 'https://wiamapp.com/team';
    try {
      await Linking.openURL(url);
    } catch (_) {
      Alert.alert('Open Failed', 'Could not open the QA Testers Dashboard right now.');
    }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Careers</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={s.hero}>
          <Briefcase size={48} color={COLORS.secondary} />
          <Text style={s.heroTitle}>Join WiamLabs</Text>
          <Text style={s.heroSub}>Help us build the future of storytelling in Africa and beyond.</Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Open Positions</Text>
          <Text style={s.cardSub}>We're always looking for talented people. Check our careers page for the latest openings.</Text>
          <TouchableOpacity
            style={s.btn}
            onPress={() => Linking.openURL('https://wiamapp.com/careers')}
          >
            <ExternalLink size={16} color="#000" />
            <Text style={s.btnText}>View Openings</Text>
          </TouchableOpacity>
        </View>

        <View style={[s.card, { borderColor: 'rgba(239,68,68,0.25)', backgroundColor: 'rgba(239,68,68,0.06)' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Bug size={18} color="#ef4444" />
            <Text style={s.cardTitle}>QA Testers Dashboard</Text>
          </View>
          <Text style={s.cardSub}>
            {isTeamMember
              ? 'Open the QA team dashboard for end-to-end testing, bug verification, and release checks.'
              : 'Apply for QA Tester role and join the quality team dashboard.'}
          </Text>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: isTeamMember ? '#ef4444' : COLORS.secondary }]}
            onPress={isTeamMember ? openQADashboard : () => Linking.openURL('https://wiamapp.com/team/careers/apply/qa_tester')}
          >
            {isFounder ? <ShieldCheck size={16} color="#000" /> : <ExternalLink size={16} color="#000" />}
            <Text style={s.btnText}>
              {isTeamMember ? (isFounder ? 'Founder: Open QA Dashboard' : 'Open QA Dashboard') : 'Apply as QA Tester'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Why WiamLabs?</Text>
          <View style={s.bulletList}>
            <Text style={s.bullet}>• Remote-first team based in Ghana</Text>
            <Text style={s.bullet}>• Building Africa's #1 reading platform</Text>
            <Text style={s.bullet}>• Competitive compensation</Text>
            <Text style={s.bullet}>• Work with cutting-edge technology</Text>
            <Text style={s.bullet}>• Make a real impact on literacy</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  hero: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  heroSub: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: 20 },
  card: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  cardSub: { fontSize: 13, color: COLORS.textMuted, lineHeight: 19 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.secondary, borderRadius: 24, paddingVertical: 12, marginTop: 14 },
  btnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  bulletList: { gap: 6 },
  bullet: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
});

export default CareersScreen;
