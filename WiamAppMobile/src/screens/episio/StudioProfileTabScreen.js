/**
 * Creator-mood Profile tab — channel tools + switch back to Watcher.
 * Edit channel lives here (not under Apply on watcher Profile).
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  Settings, User, Eye, HelpCircle, Shield, LogOut, Clapperboard,
} from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import useAuthStore from '../../store/useAuthStore';
import useAppModeStore from '../../store/useAppModeStore';

const Row = ({ icon: Icon, title, sub, onPress }) => (
  <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
    <View style={styles.iconBox}>
      <Icon size={16} color={COLORS.gold} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.rowTitle}>{title}</Text>
      {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
    </View>
    <Text style={styles.chev}>›</Text>
  </TouchableOpacity>
);

const StudioProfileTabScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setMode = useAppModeStore((s) => s.setMode);
  const channel = user?.channel_name || user?.creator_name || user?.display_name || 'Your channel';

  const switchToWatcher = async () => {
    await setMode('watcher');
    navigation.navigate('CreatorViewerSwitch', {
      target: 'Main',
      direction: 'watcher',
      studioName: channel,
    });
  };

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top + 8 }]}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
    >
      <Text style={styles.brand}>Wiam<Text style={styles.brandGold}>Studio</Text></Text>
      <Text style={styles.channel}>{String(channel).toUpperCase()}</Text>

      <TouchableOpacity style={styles.switchCard} onPress={switchToWatcher} activeOpacity={0.85}>
        <View style={styles.switchIcon}>
          <Eye size={18} color={COLORS.navy} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchTitle}>Switch to Watcher Mood</Text>
          <Text style={styles.switchSub}>Back to Home, Discover, coins & watching</Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.section}>Channel</Text>
      <View style={styles.group}>
        <Row
          icon={User}
          title="Edit channel profile"
          sub="Banner, photo, bio, socials"
          onPress={() => navigation.navigate('StudioSettings')}
        />
        <Row
          icon={Clapperboard}
          title="Public channel preview"
          sub="How watchers see you"
          onPress={() => navigation.navigate('CreatorPublicProfile', {
            creatorId: user?.wiam_id || user?.id,
          })}
        />
        <Row
          icon={Shield}
          title="Trust tier"
          onPress={() => navigation.navigate('CreatorTrustTier')}
        />
      </View>

      <Text style={styles.section}>Studio</Text>
      <View style={styles.group}>
        <Row
          icon={Settings}
          title="Studio settings"
          onPress={() => navigation.navigate('StudioSettings')}
        />
        <Row
          icon={HelpCircle}
          title="Quality help"
          onPress={() => navigation.navigate('StudioHelpQuality')}
        />
      </View>

      <TouchableOpacity style={styles.signOut} onPress={() => logout()}>
        <LogOut size={16} color="#EF4444" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  brand: { fontFamily: FONTS.extraBold, fontSize: 20, color: '#fff' },
  brandGold: { color: COLORS.gold },
  channel: {
    marginTop: 4, marginBottom: 18, fontFamily: FONTS.semi, fontSize: 10,
    color: COLORS.textFaint, letterSpacing: 0.4,
  },
  switchCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16,
    backgroundColor: 'rgba(212,160,23,0.12)', borderWidth: 1, borderColor: 'rgba(212,160,23,0.35)',
    marginBottom: 22,
  },
  switchIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  switchTitle: { fontFamily: FONTS.extraBold, fontSize: 14, color: '#fff' },
  switchSub: { marginTop: 2, fontFamily: FONTS.regular, fontSize: 11.5, color: COLORS.textDim },
  section: {
    fontFamily: FONTS.bold, fontSize: 11, color: COLORS.textFaint, letterSpacing: 0.6,
    textTransform: 'uppercase', marginBottom: 8,
  },
  group: {
    backgroundColor: COLORS.navyCard, borderRadius: 16, borderWidth: 1,
    borderColor: COLORS.navyLine, marginBottom: 18, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.navyLine,
  },
  iconBox: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.navySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  rowTitle: { fontFamily: FONTS.bold, fontSize: 13.5, color: '#fff' },
  rowSub: { marginTop: 2, fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textDim },
  chev: { fontSize: 22, color: COLORS.textFaint, marginTop: -2 },
  signOut: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 8, padding: 14,
  },
  signOutText: { fontFamily: FONTS.bold, color: '#EF4444', fontSize: 14 },
});

export default StudioProfileTabScreen;
