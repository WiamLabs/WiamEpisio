/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
/**
 * Redirect stub — old novel/read routes land on Watch Home.
 * DramaSeries deep links with seriesId → SeriesDetail.
 */
import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { EPISIO } from '../../constants/episioTheme';

const RedirectToWatchScreen = ({ navigation, route }) => {
  const seriesId = route?.params?.seriesId || route?.params?.id;

  useEffect(() => {
    const t = setTimeout(() => {
      if (seriesId && (route?.name === 'DramaSeries' || route?.name === 'SeriesDetail')) {
        navigation.replace('SeriesDetail', { seriesId: Number(seriesId) });
        return;
      }
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{
            name: 'Main',
            state: {
              routes: [{
                name: 'MainTabs',
                state: { routes: [{ name: 'Home' }], index: 0 },
              }],
              index: 0,
            },
          }],
        }),
      );
    }, 0);
    return () => clearTimeout(t);
  }, [navigation, seriesId, route?.name]);

  return (
    <View style={styles.page}>
      <ActivityIndicator color={EPISIO.ember} />
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: EPISIO.ink900,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default RedirectToWatchScreen;
