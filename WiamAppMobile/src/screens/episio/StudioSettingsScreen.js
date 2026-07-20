/**
 * Layout: WiamStudio-Settings.html (Episio links hub)
 * Team talk · links to Specs, HelpQuality, TrustTier, PayoutKyc, Earnings
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  ChevronLeft, ChevronRight, FileText, HelpCircle, Star, Wallet, Banknote, LogOut,
} from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import useAuthStore from '../../store/useAuthStore';
import studioEpisioApi from '../../api/studioEpisio';

const Row = ({ icon: Icon, label, value, onPress, tag }) => (
  <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress}>
    <View style={styles.rowIcon}>
      <Icon size={15} color={COLORS.textDim} />
    </View>
    <Text style={styles.rowLabel}>{label}</Text>
    {tag ? <Text style={styles.statusTag}>{tag}</Text> : null}
    {value ? <Text style={styles.rowValue}>{value}</Text> : null}
    {onPress ? <ChevronRight size={14} color={COLORS.textFaint} /> : null}
  </TouchableOpacity>
);

const StudioSettingsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [tier, setTier] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    studioEpisioApi.trustTier()
      .then((d) => setTier(d))
      .catch(() => setTier(null))
      .finally(() => setLoading(false));
  }, []));

  const displayName = user?.display_name || user?.username || 'Creator';
  const initial = (displayName[0] || 'C').toUpperCase();
  const tierLabel = {
    new: 'New Creator',
    rising: 'Rising Creator',
    trusted: 'Trusted Creator',
    elite: 'Elite Creator',
  }[tier?.tier || 'new'];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={15} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.h1}>Studio Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        <View style={styles.studioCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName}>{displayName}</Text>
            <Text style={styles.cardSub}>
              @{user?.username || 'creator'} · {tierLabel}
            </Text>
          </View>
        </View>

        <Text style={styles.groupTitle}>Publishing help</Text>
        <View style={styles.rowCard}>
          <Row icon={FileText} label="Specs guide" onPress={() => navigation.navigate('StudioSpecs')} />
          <Row icon={HelpCircle} label="Quality & review help" onPress={() => navigation.navigate('StudioHelpQuality')} />
          <Row icon={Star} label="Creator Trust Tier" value={tierLabel} onPress={() => navigation.navigate('CreatorTrustTier')} />
        </View>
        <Text style={styles.groupNote}>
          The WiamEpisio team reviews your full series — not episode-by-episode drops. These guides explain what we check.
        </Text>

        <Text style={styles.groupTitle}>Payouts</Text>
        <View style={styles.rowCard}>
          <Row
            icon={Wallet}
            label="Payout & KYC"
            tag={user?.is_creator ? 'OPEN' : undefined}
            onPress={() => navigation.navigate('StudioPayoutKyc')}
          />
          <Row
            icon={Banknote}
            label="Earnings overview"
            onPress={() => navigation.navigate('StudioEarnings', {})}
          />
        </View>
        <Text style={styles.groupNote}>
          Earnings start only after our team publishes your complete series. Payouts unlock after identity checks.
        </Text>

        {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 16 }} /> : null}

        <TouchableOpacity
          style={styles.signoutBtn}
          onPress={() => {
            logout();
            navigation.navigate('Main');
          }}
        >
          <LogOut size={16} color="#E4573D" style={{ marginRight: 8 }} />
          <Text style={styles.signoutText}>Exit WiamStudio</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  h1: { fontSize: 18, fontFamily: FONTS.extraBold, color: '#fff' },
  studioCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 16, padding: 14, marginBottom: 18,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 13,
    backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: FONTS.extraBold, fontSize: 19, color: COLORS.navy },
  cardName: { fontSize: 13.5, fontFamily: FONTS.extraBold, color: '#fff' },
  cardSub: { fontSize: 10.5, fontFamily: FONTS.regular, color: COLORS.textFaint, marginTop: 2 },
  groupTitle: {
    fontSize: 11, fontFamily: FONTS.extraBold, color: COLORS.textFaint,
    letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 10,
  },
  groupNote: {
    fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textDim,
    lineHeight: 17, marginBottom: 16, marginTop: -4,
  },
  rowCard: {
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 14, overflow: 'hidden', marginBottom: 8,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: COLORS.navyLine,
  },
  rowIcon: {
    width: 30, height: 30, borderRadius: 9, backgroundColor: COLORS.navySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: 13, fontFamily: FONTS.medium, color: '#E7E7F2' },
  rowValue: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textFaint, marginRight: 4 },
  statusTag: {
    fontSize: 9, fontFamily: FONTS.extraBold, color: '#3BB273',
    backgroundColor: 'rgba(59,178,115,0.16)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  signoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 14, borderRadius: 14, marginTop: 20,
    backgroundColor: 'rgba(228,87,61,0.1)', borderWidth: 1, borderColor: 'rgba(228,87,61,0.3)',
  },
  signoutText: { fontSize: 13, fontFamily: FONTS.bold, color: '#E4573D' },
});

export default StudioSettingsScreen;
