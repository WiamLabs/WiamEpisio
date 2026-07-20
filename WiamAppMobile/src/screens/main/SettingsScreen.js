import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS } from '../../constants/theme';
import { CommonActions } from '@react-navigation/native';

/**
 * SettingsScreen — now a thin redirect.
 * All settings live inside ProfileScreen → Settings tab.
 */
const SettingsScreen = ({ navigation }) => {
  useEffect(() => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: 'MainTabs',
            state: {
              routes: [{ name: 'Profile', params: { initialTab: 'settings' } }],
            },
          },
        ],
      }),
    );
  }, [navigation]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color={COLORS.secondary} />
      <Text style={styles.text}>Redirecting to Settings…</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  text: { color: COLORS.textMuted, fontSize: 13, marginTop: 12 },
});

export default SettingsScreen;
