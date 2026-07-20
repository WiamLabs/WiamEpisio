/**
 * Account delete — type DELETE confirm
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const CONFIRM_WORD = 'DELETE';

const AccountDeleteScreen = () => {
  const navigation = useNavigation();
  const [text, setText] = useState('');

  const submit = () => {
    if (text.trim().toUpperCase() !== CONFIRM_WORD) {
      Alert.alert('Confirm deletion', `Type ${CONFIRM_WORD} to confirm.`);
      return;
    }
    Alert.alert(
      'Request received',
      'Account deletion requests are processed by the WiamEpisio team within 30 days.',
      [{ text: 'OK', onPress: () => navigation.goBack() }],
    );
  };

  return (
    <EpisioScreenShell
      title="Delete account"
      subtitle="Permanent action"
      footer={(
        <TouchableOpacity
          style={[styles.danger, text.trim().toUpperCase() !== CONFIRM_WORD && styles.dangerOff]}
          onPress={submit}
        >
          <Text style={styles.dangerText}>Delete my account</Text>
        </TouchableOpacity>
      )}
    >
      <Text style={styles.warn}>
        This removes your profile, watch history, coins balance, and Studio access. This cannot be undone.
      </Text>
      <Text style={styles.label}>Type {CONFIRM_WORD} to confirm</Text>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder={CONFIRM_WORD}
        placeholderTextColor={COLORS.textFaint}
        autoCapitalize="characters"
      />
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  warn: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.error, lineHeight: 21, marginTop: 12 },
  label: { fontFamily: FONTS.semi, fontSize: 13, color: COLORS.textDim, marginTop: 24, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.navyLine,
    padding: 14, fontFamily: FONTS.bold, fontSize: 16, color: COLORS.text, letterSpacing: 2,
  },
  danger: { backgroundColor: COLORS.error, borderRadius: RADIUS.md, padding: 15, alignItems: 'center' },
  dangerOff: { opacity: 0.45 },
  dangerText: { fontFamily: FONTS.extraBold, fontSize: 14, color: '#fff' },
});

export default AccountDeleteScreen;
