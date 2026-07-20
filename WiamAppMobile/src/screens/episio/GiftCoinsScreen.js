/**
 * Gift coins — amount + recipient
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const AMOUNTS = [50, 100, 200, 500];

const GiftCoinsScreen = () => {
  const [amount, setAmount] = useState(100);
  const [recipient, setRecipient] = useState('');

  const submit = () => {
    if (!recipient.trim()) {
      Alert.alert('Gift coins', 'Enter a recipient username or WIAMid.');
      return;
    }
    Alert.alert(
      'Gift sent',
      `${amount} coins will be sent to ${recipient.trim()} when gifting goes live.`,
    );
  };

  return (
    <EpisioScreenShell
      title="Gift coins"
      subtitle="Send coins to a friend"
      footer={(
        <TouchableOpacity style={styles.cta} onPress={submit}>
          <Text style={styles.ctaText}>Submit gift</Text>
        </TouchableOpacity>
      )}
    >
      <Text style={styles.label}>Amount</Text>
      <View style={styles.chips}>
        {AMOUNTS.map((a) => (
          <TouchableOpacity
            key={a}
            style={[styles.chip, amount === a && styles.chipOn]}
            onPress={() => setAmount(a)}
          >
            <Text style={[styles.chipText, amount === a && styles.chipTextOn]}>{a}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.label}>Recipient</Text>
      <TextInput
        style={styles.input}
        placeholder="@username or WIAMid"
        placeholderTextColor={COLORS.textFaint}
        value={recipient}
        onChangeText={setRecipient}
        autoCapitalize="none"
      />
      <Text style={styles.note}>Gifts are final. Recipient must have a WiamEpisio account.</Text>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  label: { fontFamily: FONTS.semi, fontSize: 13, color: COLORS.textDim, marginTop: 16, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.full,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  chipOn: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  chipText: { fontFamily: FONTS.semi, color: COLORS.text },
  chipTextOn: { color: COLORS.navy },
  input: {
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.navyLine,
    padding: 14, fontFamily: FONTS.regular, fontSize: 15, color: COLORS.text,
  },
  note: { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textFaint, marginTop: 12, lineHeight: 16 },
  cta: { backgroundColor: COLORS.gold, borderRadius: RADIUS.md, padding: 15, alignItems: 'center' },
  ctaText: { fontFamily: FONTS.extraBold, fontSize: 14, color: COLORS.navy },
});

export default GiftCoinsScreen;
