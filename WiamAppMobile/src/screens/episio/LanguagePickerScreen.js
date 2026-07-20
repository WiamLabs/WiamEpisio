/**
 * App language picker
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS } from '../../constants/theme';

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'fr', label: 'French', native: 'Français' },
  { code: 'tw', label: 'Twi', native: 'Twi' },
  { code: 'ha', label: 'Hausa', native: 'Hausa' },
  { code: 'yo', label: 'Yoruba', native: 'Yorùbá' },
  { code: 'sw', label: 'Swahili', native: 'Kiswahili' },
];

const LanguagePickerScreen = () => {
  const [selected, setSelected] = useState('en');

  return (
    <EpisioScreenShell title="Language" subtitle="App display language">
      {LANGUAGES.map((lang) => (
        <TouchableOpacity key={lang.code} style={styles.row} onPress={() => setSelected(lang.code)}>
          <View>
            <Text style={styles.label}>{lang.label}</Text>
            <Text style={styles.native}>{lang.native}</Text>
          </View>
          <View style={[styles.radio, selected === lang.code && styles.radioOn]} />
        </TouchableOpacity>
      ))}
      <Text style={styles.note}>Full translations roll out gradually. English is complete today.</Text>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.navyLine,
  },
  label: { fontFamily: FONTS.semi, fontSize: 15, color: COLORS.text },
  native: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textDim, marginTop: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.navyLine },
  radioOn: { borderColor: COLORS.gold, backgroundColor: COLORS.gold },
  note: { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textFaint, marginTop: 20, lineHeight: 16 },
});

export default LanguagePickerScreen;
