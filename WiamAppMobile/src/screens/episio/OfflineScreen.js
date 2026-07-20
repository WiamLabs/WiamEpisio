/**
 * WiamEpisio-Offline.html — no connection center state.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { WifiOff, Download } from 'lucide-react-native';
import EpisioCenterState from '../../components/episio/EpisioCenterState';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';

const OfflineScreen = () => {
  const navigation = useNavigation();

  const tryAgain = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const openDownloads = () => {
    navigation.navigate('DownloadsManager');
  };

  return (
    <EpisioCenterState
      hideBack
      icon={<WifiOff size={38} color={COLORS.textFaint} />}
      title="You're offline"
      subtitle="No internet connection right now. Check your Wi-Fi or mobile data and try again."
      card={(
        <View>
          <View style={styles.cachedRow}>
            <Download size={16} color={COLORS.gold} />
            <Text style={styles.cachedText}>
              Downloaded episodes still play offline — check My List for anything saved.
            </Text>
          </View>
          <Text style={styles.tipExtra}>
            Tip: download episodes on Wi-Fi before you travel. Need help? support@wiamapp.com
          </Text>
        </View>
      )}
      primary={(
        <EpisioGoldButton
          label="Try Again"
          onPress={tryAgain}
          style={{ width: '100%' }}
        />
      )}
      secondary={(
        <EpisioGoldButton
          variant="ghost"
          label="Watch downloaded episodes"
          onPress={openDownloads}
        />
      )}
      tertiary={(
        <TouchableOpacity onPress={tryAgain} hitSlop={12}>
          <Text style={styles.ghostLink}>Return to previous screen</Text>
        </TouchableOpacity>
      )}
    />
  );
};

const styles = StyleSheet.create({
  cachedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cachedText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#D9D9E8',
    lineHeight: 17,
  },
  tipExtra: {
    marginTop: 12,
    fontFamily: FONTS.regular,
    fontSize: 10.5,
    color: COLORS.textFaint,
    lineHeight: 16,
  },
  ghostLink: {
    fontFamily: FONTS.semi,
    fontSize: 12,
    color: COLORS.textDim,
    textAlign: 'center',
  },
});

export default OfflineScreen;
