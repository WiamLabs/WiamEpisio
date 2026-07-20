/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import useAuthStore from '../../store/useAuthStore';
import { ChevronLeft, ShieldCheck, Lock, Eye, Trash2, Download } from 'lucide-react-native';

const AccountSafetyScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [twoFactor, setTwoFactor] = useState(false);
  const [loginAlerts, setLoginAlerts] = useState(true);

  const goToDeleteAccountFlow = () => {
    // Deletion is fully implemented in Profile settings where password confirmation exists.
    navigation.navigate('Main', { screen: 'MainTabs', params: { screen: 'Profile' } });
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Account Safety</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Status */}
        <View style={s.statusCard}>
          <ShieldCheck size={32} color="#4ade80" />
          <Text style={s.statusTitle}>Your account is secure</Text>
          <Text style={s.statusSub}>
            Signed in as {user?.email || 'unknown'} via {user?.auth_provider || 'email'}
          </Text>
        </View>

        {/* Security Options */}
        <Text style={s.secTitle}>Security</Text>
        <View style={s.card}>
          <View style={s.row}>
            <Lock size={18} color={COLORS.secondary} />
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>Two-Factor Authentication</Text>
              <Text style={s.rowSub}>Add extra security to your account</Text>
            </View>
            <Switch
              value={twoFactor}
              onValueChange={() => Alert.alert('Coming soon', 'Two-factor authentication setup will be enabled in a future update.')}
              trackColor={{ true: COLORS.secondary }}
            />
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <Eye size={18} color="#60a5fa" />
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>Login Alerts</Text>
              <Text style={s.rowSub}>Get notified of new logins</Text>
            </View>
            <Switch
              value={loginAlerts}
              onValueChange={() => Alert.alert('Coming soon', 'Login alert settings sync will be enabled in a future update.')}
              trackColor={{ true: COLORS.secondary }}
            />
          </View>
        </View>

        {/* Data & Privacy */}
        <Text style={s.secTitle}>Data & Privacy</Text>
        <View style={s.card}>
          <TouchableOpacity style={s.row} onPress={() => Alert.alert('Download Data', 'Data export request endpoint is being finalized. Please use Support > Help Center for now.')}>
            <Download size={18} color="#a78bfa" />
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>Download My Data</Text>
              <Text style={s.rowSub}>Get a copy of your WiamApp data</Text>
            </View>
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity style={s.row} onPress={() => Alert.alert(
            'Delete Account',
            'To delete your account securely, continue to Profile settings where password confirmation is required.',
            [{ text: 'Cancel', style: 'cancel' }, { text: 'Go to Profile Settings', onPress: goToDeleteAccountFlow }]
          )}>
            <Trash2 size={18} color="#f87171" />
            <View style={{ flex: 1 }}>
              <Text style={[s.rowTitle, { color: '#f87171' }]}>Delete Account</Text>
              <Text style={s.rowSub}>Permanently delete your account and data</Text>
            </View>
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
  statusCard: { alignItems: 'center', paddingVertical: 28, backgroundColor: 'rgba(74,222,128,0.06)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(74,222,128,0.15)', marginBottom: 24, gap: 8 },
  statusTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  statusSub: { fontSize: 12, color: COLORS.textMuted },
  secTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 10, marginTop: 8 },
  card: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 20, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  rowSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.04)' },
});

export default AccountSafetyScreen;
