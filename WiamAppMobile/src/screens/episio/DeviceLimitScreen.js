/**
 * WiamEpisio-Device-Limit.html — too many signed-in devices.
 * Devices come from route.params.devices only (no fake sample rows).
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Smartphone, Monitor, Tablet } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';

const iconForType = (type) => {
  if (type === 'tv') return Monitor;
  if (type === 'tablet') return Tablet;
  return Smartphone;
};

const DeviceLimitScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const devices = Array.isArray(route.params?.devices) ? route.params.devices : [];
  const deviceLimit = route.params?.deviceLimit || 2;

  const signOutOthers = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const upgradeVip = () => {
    navigation.navigate('Member');
  };

  return (
    <EpisioScreenShell
      title="Device Limit Reached"
      footer={(
        <EpisioGoldButton
          label="Sign Out Other Devices"
          onPress={signOutOthers}
        />
      )}
    >
      <View style={styles.hero}>
        <View style={styles.iconWrap}>
          <Smartphone size={26} color={COLORS.gold} />
        </View>
        <Text style={styles.heroTitle}>Too many devices signed in</Text>
        <Text style={styles.heroSub}>
          Your plan allows <Text style={styles.bold}>{deviceLimit} devices</Text> at once.
          Sign out of one below to continue watching here.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Signed-in devices</Text>

      {devices.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No devices loaded</Text>
          <Text style={styles.emptySub}>
            Device list was not passed to this screen. Use Sign Out Other Devices below,
            or contact support@wiamapp.com if this keeps happening.
          </Text>
        </View>
      ) : (
        devices.map((device) => {
          const Icon = iconForType(device.type);
          return (
            <View key={device.id || device.name} style={styles.deviceRow}>
              <View style={styles.deviceIcon}>
                <Icon size={17} color={COLORS.textDim} />
              </View>
              <View style={styles.deviceBody}>
                <View style={styles.nameRow}>
                  <Text style={styles.deviceName} numberOfLines={1}>
                    {device.name || 'Device'}
                    {device.isCurrent ? ' — This Device' : ''}
                  </Text>
                  {device.isCurrent ? <View style={styles.liveDot} /> : null}
                </View>
                <Text style={styles.deviceSub}>
                  {[device.location, device.lastActive].filter(Boolean).join(' · ') || 'Active'}
                </Text>
              </View>
              {!device.isCurrent ? (
                <TouchableOpacity onPress={signOutOthers} hitSlop={8}>
                  <Text style={styles.signOut}>Sign Out</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })
      )}

      <TouchableOpacity style={styles.upgradeCard} onPress={upgradeVip} activeOpacity={0.9}>
        <Text style={styles.upgradeTitle}>Need more devices?</Text>
        <Text style={styles.upgradeText}>
          VIP membership raises your limit to 4 simultaneous devices, plus removes ads and
          unlocks VIP-exclusive series.
        </Text>
      </TouchableOpacity>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 22,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(212,160,23,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontFamily: FONTS.extraBold,
    fontSize: 17,
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textDim,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 290,
  },
  bold: { fontFamily: FONTS.bold, color: '#fff' },
  sectionTitle: {
    fontFamily: FONTS.extraBold,
    fontSize: 12,
    color: COLORS.textDim,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  emptyTitle: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#fff',
    marginBottom: 6,
  },
  emptySub: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textDim,
    lineHeight: 17,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  deviceIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.navySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceBody: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  deviceName: { fontFamily: FONTS.bold, fontSize: 12.5, color: '#fff', flexShrink: 1 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3BB273' },
  deviceSub: { fontFamily: FONTS.regular, fontSize: 10.5, color: COLORS.textFaint },
  signOut: { fontFamily: FONTS.bold, fontSize: 11, color: '#E4573D' },
  upgradeCard: {
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(212,160,23,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.28)',
  },
  upgradeTitle: {
    fontFamily: FONTS.extraBold,
    fontSize: 12.5,
    color: '#fff',
    marginBottom: 6,
  },
  upgradeText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#D9C89A',
    lineHeight: 17,
  },
});

export default DeviceLimitScreen;
