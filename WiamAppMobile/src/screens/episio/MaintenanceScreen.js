/**
 * WiamEpisio-Maintenance.html — scheduled maintenance center state.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Settings } from 'lucide-react-native';
import EpisioCenterState from '../../components/episio/EpisioCenterState';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';

const STATUS_URL = 'https://episio.wiamlabs.com/status';
const SUPPORT_MAIL = 'mailto:support@wiamapp.com?subject=WiamEpisio%20Maintenance';

const MaintenanceScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {
    etaLabel = 'Estimated back online',
    etaValue = 'Today · About 30 minutes remaining',
    etaSub,
  } = route.params || {};

  const openStatus = async () => {
    try {
      const can = await Linking.canOpenURL(STATUS_URL);
      if (can) {
        await Linking.openURL(STATUS_URL);
        return;
      }
    } catch (_) {
      /* fall through to support */
    }
    Linking.openURL(SUPPORT_MAIL).catch(() => {});
  };

  const tryAgain = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    Linking.openURL(STATUS_URL).catch(() => Linking.openURL(SUPPORT_MAIL).catch(() => {}));
  };

  return (
    <EpisioCenterState
      hideBack
      icon={<Settings size={40} color={COLORS.gold} />}
      title="We're making things better"
      subtitle="WiamEpisio is temporarily down for scheduled maintenance. We'll be back shortly."
      card={(
        <View>
          <Text style={styles.etaLabel}>{etaLabel}</Text>
          <Text style={styles.etaValue}>{etaValue}</Text>
          {etaSub ? <Text style={styles.etaSub}>{etaSub}</Text> : (
            <Text style={styles.etaSub}>Status updates at episio.wiamlabs.com/status</Text>
          )}
        </View>
      )}
      statusRow={(
        <>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Follow live updates on our status page</Text>
        </>
      )}
      primary={(
        <EpisioGoldButton
          variant="ghost"
          label="Check Status Page"
          onPress={openStatus}
          style={{ width: '100%' }}
        />
      )}
      tertiary={(
        <TouchableOpacity onPress={tryAgain} hitSlop={12}>
          <Text style={styles.tryAgain}>Try Again</Text>
        </TouchableOpacity>
      )}
    />
  );
};

const styles = StyleSheet.create({
  etaLabel: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: COLORS.textFaint,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  etaValue: {
    fontFamily: FONTS.extraBold,
    fontSize: 17,
    color: '#fff',
  },
  etaSub: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.gold,
    marginTop: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.gold,
  },
  statusText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textDim,
  },
  tryAgain: {
    fontFamily: FONTS.semi,
    fontSize: 12,
    color: COLORS.textFaint,
    textAlign: 'center',
  },
});

export default MaintenanceScreen;
