/**
 * Fullscreen entry — hands off to the real Player with fullscreen chrome.
 * No static scrubber / fake duration.
 */
import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS } from '../../constants/theme';

const PlayerFullscreenScreen = () => {
  const navigation = useNavigation();
  const params = useRoute().params || {};

  useEffect(() => {
    const { episodeId, seriesId } = params;
    if (episodeId || seriesId) {
      navigation.replace('Player', {
        episodeId,
        seriesId,
        startFullscreen: true,
      });
      return;
    }
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Main');
  }, [navigation, params]);

  return (
    <View style={styles.root}>
      <ActivityIndicator color={COLORS.gold} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
});

export default PlayerFullscreenScreen;
