/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 (Text Edition park).
 * Do not wire into active navigation. Pending possible future Text Edition.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
/**
 * Stub for removed novel Studio editors (Pass 1).
 * Episode upload / manager lands in Pass 2.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { EPISIO, EPISIO_FONTS } from '../../constants/episioTheme';

const StudioComingSoonStub = ({ navigation }) => {
  useEffect(() => {
    /* auto-show once */
  }, []);

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Creator tools updating</Text>
      <Text style={styles.body}>
        Novel chapter editors are off the main path. Episode upload and series wizard arrive in Pass 2.
      </Text>
      <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
        <Text style={styles.btnText}>Back to Studio</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: EPISIO.ink900,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontFamily: EPISIO_FONTS.display,
    fontSize: 22,
    color: EPISIO.paper,
    marginBottom: 10,
    textAlign: 'center',
  },
  body: {
    fontFamily: EPISIO_FONTS.ui,
    color: EPISIO.smoke,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  btn: {
    backgroundColor: EPISIO.ember,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 999,
  },
  btnText: { color: EPISIO.emberDeep, fontFamily: EPISIO_FONTS.uiSemi },
});

export default StudioComingSoonStub;
