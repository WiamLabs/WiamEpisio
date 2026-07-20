/**
 * WiamEpisio-About.html — About WiamEpisio (mission, soft stats, link rows).
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Bell, Star, Share2, Heart, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS } from '../../constants/theme';

const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.wiamapp.mobile';
const APP_STORE = 'https://apps.apple.com/app/wiamapp/id000000000';
const SITE = 'https://episio.wiamlabs.com';

const AboutScreen = () => {
  const navigation = useNavigation();

  const versionLabel = useMemo(() => {
    const cfg = Constants?.expoConfig || Constants?.manifest || null;
    const version = cfg?.version || Constants?.nativeAppVersion || null;
    const build =
      cfg?.ios?.buildNumber
      || cfg?.android?.versionCode
      || Constants?.nativeBuildVersion
      || null;
    if (!version) return '—';
    return build ? `Version ${version} (Build ${build})` : `Version ${version}`;
  }, []);

  const openStore = () => {
    const url = Platform.select({ ios: APP_STORE, android: PLAY_STORE, default: PLAY_STORE });
    Linking.openURL(url).catch(() => {
      Alert.alert('Rate WiamEpisio', 'Open your app store and leave a rating when ready.');
    });
  };

  const openWhatsNew = () => {
    Alert.alert(
      "What's New",
      'Short drama streaming, coin unlocks, and creator studio tools — refreshed for WiamEpisio.',
      [{ text: 'OK' }],
    );
  };

  const rows = [
    {
      key: 'new',
      label: "What's New in This Version",
      Icon: Bell,
      onPress: openWhatsNew,
    },
    {
      key: 'rate',
      label: 'Rate WiamEpisio',
      Icon: Star,
      onPress: openStore,
    },
    {
      key: 'social',
      label: 'Visit episio.wiamlabs.com',
      Icon: Share2,
      onPress: () => Linking.openURL(SITE).catch(() => {}),
    },
    {
      key: 'creator',
      label: 'Become a Creator',
      Icon: Heart,
      onPress: () => navigation.navigate('CreatorApplyInviteOnly'),
    },
  ];

  return (
    <EpisioScreenShell title="About WiamEpisio">
      <View style={styles.hero}>
        <LinearGradient
          colors={[COLORS.gold, COLORS.goldDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logoBadge}
        >
          <Text style={styles.logoLetter}>W</Text>
        </LinearGradient>
        <Text style={styles.wordmark}>
          Wiam<Text style={styles.wordmarkGold}>Episio</Text>
        </Text>
        <Text style={styles.version}>{versionLabel}</Text>
      </View>

      <View style={styles.missionCard}>
        <Text style={styles.missionTitle}>Our Mission</Text>
        <Text style={styles.missionText}>
          We're building the home for African vertical drama — short, binge-worthy episodes
          made by African creators, for a global audience. Bold stories, told our way.
        </Text>
      </View>

      <View style={styles.statRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>Africa-first</Text>
          <Text style={styles.statLabel}>ORIGIN</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>Growing</Text>
          <Text style={styles.statLabel}>ACROSS AFRICA</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>Global</Text>
          <Text style={styles.statLabel}>AMBITION</Text>
        </View>
      </View>

      <View style={styles.rowCard}>
        {rows.map((row, i) => {
          const Icon = row.Icon;
          return (
            <TouchableOpacity
              key={row.key}
              style={[styles.row, i === rows.length - 1 && styles.rowLast]}
              onPress={row.onPress}
              activeOpacity={0.85}
            >
              <View style={styles.rowIcon}>
                <Icon size={15} color={COLORS.textDim} />
              </View>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <ChevronRight size={14} color={COLORS.textFaint} />
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.footerCopy}>
        © {new Date().getFullYear()} WiamEpisio · Powered by WiamLabs{'\n'}
        episio.wiamlabs.com · Made in Accra, Ghana
      </Text>
      <TouchableOpacity
        onPress={() => Linking.openURL('mailto:support@wiamapp.com').catch(() => {})}
        style={{ marginTop: 10 }}
      >
        <Text style={styles.supportLink}>support@wiamapp.com</Text>
      </TouchableOpacity>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 24,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logoLetter: {
    fontFamily: FONTS.extraBold,
    fontSize: 26,
    color: COLORS.navy,
  },
  wordmark: {
    fontFamily: FONTS.extraBold,
    fontSize: 19,
    color: '#fff',
    marginBottom: 4,
  },
  wordmarkGold: {
    color: COLORS.gold,
  },
  version: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textFaint,
  },
  missionCard: {
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  missionTitle: {
    fontFamily: FONTS.extraBold,
    fontSize: 12.5,
    color: COLORS.gold,
    marginBottom: 8,
  },
  missionText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#D9D9E8',
    lineHeight: 20,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontFamily: FONTS.extraBold,
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: FONTS.regular,
    fontSize: 9.5,
    color: COLORS.textFaint,
    letterSpacing: 0.3,
  },
  rowCard: {
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.navyLine,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: COLORS.navySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#E7E7F2',
  },
  footerCopy: {
    textAlign: 'center',
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: '#3A3A56',
    lineHeight: 18,
  },
  supportLink: {
    fontFamily: FONTS.semi,
    fontSize: 12,
    color: COLORS.gold,
    textAlign: 'center',
  },
});

export default AboutScreen;
