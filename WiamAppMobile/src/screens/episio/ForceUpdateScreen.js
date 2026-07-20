/**
 * WiamEpisio-Force-Update.html — required store update (cannot skip).
 */
import React from 'react';
import { View, Text, StyleSheet, Platform, Linking } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Download, Check } from 'lucide-react-native';
import EpisioCenterState from '../../components/episio/EpisioCenterState';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';

const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.wiamapp.mobile';
const APP_STORE = 'https://apps.apple.com/app/wiamapp/id000000000';

const DEFAULT_BULLETS = [
  'Faster playback and fewer buffering interruptions',
  'New Novels tab for series-based reading',
  'Important security and stability fixes',
];

const ForceUpdateScreen = () => {
  const route = useRoute();
  const {
    currentVersion = 'v2.1.3',
    requiredVersion = 'v2.4.0',
    whatsNew = DEFAULT_BULLETS,
    versionNote,
  } = route.params || {};

  const storeUrl = Platform.select({
    ios: APP_STORE,
    android: PLAY_STORE,
    default: PLAY_STORE,
  });

  const updateNow = () => {
    Linking.openURL(storeUrl).catch(() => {
      Linking.openURL(PLAY_STORE).catch(() => {});
    });
  };

  const bullets = Array.isArray(whatsNew) && whatsNew.length ? whatsNew : DEFAULT_BULLETS;
  const note = versionNote || `Current: ${currentVersion} · Required: ${requiredVersion}`;

  return (
    <EpisioCenterState
      hideBack
      icon={<Download size={40} color={COLORS.gold} />}
      title="Time for an update"
      subtitle="This version of WiamEpisio is no longer supported. Update now to keep watching — this can't be skipped."
      card={(
        <View>
          <Text style={styles.cantSkip}>This update can't be skipped</Text>
          <Text style={styles.whatsNewTitle}>WHAT'S NEW IN {requiredVersion}</Text>
          {bullets.map((line) => (
            <View key={line} style={styles.bulletRow}>
              <Check size={14} color={COLORS.gold} />
              <Text style={styles.bulletText}>{line}</Text>
            </View>
          ))}
        </View>
      )}
      primary={(
        <EpisioGoldButton
          label="Update Now"
          onPress={updateNow}
          style={{ width: '100%' }}
        />
      )}
      tertiary={<Text style={styles.versionNote}>{note}</Text>}
    />
  );
};

const styles = StyleSheet.create({
  cantSkip: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#fff',
    marginBottom: 12,
  },
  whatsNewTitle: {
    fontFamily: FONTS.extraBold,
    fontSize: 12,
    color: COLORS.gold,
    marginBottom: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginBottom: 9,
  },
  bulletText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#D9D9E8',
    lineHeight: 16,
  },
  versionNote: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.textFaint,
    textAlign: 'center',
  },
});

export default ForceUpdateScreen;
