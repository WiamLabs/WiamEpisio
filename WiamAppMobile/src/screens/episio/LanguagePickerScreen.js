/**
 * WiamEpisio-Language-Picker.html — Suggested + All languages, persist @episio_lang.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Check, Search } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const LANG_KEY = '@episio_lang';

const SUGGESTED = [
  { code: 'en-GH', label: 'English (Ghana)', flag: '🇬🇭' },
  { code: 'tw', label: 'Twi', flag: '🇬🇭' },
  { code: 'pcm', label: 'Pidgin English', flag: '🇳🇬' },
];

const ALL = [
  { code: 'fr', label: 'Français', native: 'French', flag: '🇫🇷' },
  { code: 'pt', label: 'Português', native: 'Portuguese', flag: '🇵🇹' },
  { code: 'sw', label: 'Kiswahili', native: 'Swahili', flag: '🇰🇪' },
  { code: 'ha', label: 'Hausa', native: 'Hausa', flag: '🇳🇬' },
  { code: 'yo', label: 'Yoruba', native: 'Yoruba', flag: '🇳🇬' },
  { code: 'ig', label: 'Igbo', native: 'Igbo', flag: '🇳🇬' },
  { code: 'es', label: 'Español', native: 'Spanish', flag: '🇪🇸' },
  { code: 'ar', label: 'العربية', native: 'Arabic', flag: '🇸🇦' },
];

const LanguagePickerScreen = () => {
  const navigation = useNavigation();
  const [selected, setSelected] = useState('en-GH');
  const [query, setQuery] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY)
      .then((v) => { if (v) setSelected(v); })
      .catch(() => {});
  }, []);

  const match = (lang) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      lang.label.toLowerCase().includes(q)
      || (lang.native || '').toLowerCase().includes(q)
      || lang.code.toLowerCase().includes(q)
    );
  };

  const suggested = useMemo(() => SUGGESTED.filter(match), [query]);
  const all = useMemo(() => ALL.filter(match), [query]);

  const onSelect = async (code) => {
    setSelected(code);
    try {
      await AsyncStorage.setItem(LANG_KEY, code);
    } catch {
      // local state still updated
    }
    navigation.goBack();
  };

  const Row = ({ lang }) => {
    const on = selected === lang.code;
    return (
      <TouchableOpacity style={[styles.row, on && styles.rowOn]} onPress={() => onSelect(lang.code)} activeOpacity={0.85}>
        <Text style={styles.flag}>{lang.flag}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{lang.label}</Text>
          {lang.native ? <Text style={styles.native}>{lang.native}</Text> : null}
        </View>
        {on ? (
          <View style={styles.check}>
            <Check size={14} color={COLORS.navy} strokeWidth={3} />
          </View>
        ) : (
          <View style={styles.checkOff} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <EpisioScreenShell title="Language" subtitle="App display language">
      <View style={styles.searchWrap}>
        <Search size={16} color={COLORS.textFaint} />
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search languages"
          placeholderTextColor={COLORS.textFaint}
          autoCorrect={false}
        />
      </View>

      {suggested.length > 0 ? (
        <>
          <Text style={styles.group}>SUGGESTED</Text>
          {suggested.map((lang) => <Row key={lang.code} lang={lang} />)}
        </>
      ) : null}

      {all.length > 0 ? (
        <>
          <Text style={styles.group}>ALL LANGUAGES</Text>
          {all.map((lang) => <Row key={lang.code} lang={lang} />)}
        </>
      ) : null}

      {suggested.length === 0 && all.length === 0 ? (
        <Text style={styles.empty}>No languages match “{query}”.</Text>
      ) : null}

      <Text style={styles.note}>
        Full translations roll out gradually. English (Ghana) is complete today.
      </Text>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, marginTop: 4,
  },
  search: { flex: 1, fontFamily: FONTS.regular, fontSize: 14, color: COLORS.text, padding: 0 },
  group: {
    fontFamily: FONTS.semi, fontSize: 11, color: COLORS.textFaint, letterSpacing: 0.8,
    marginTop: 22, marginBottom: 8,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: COLORS.navyLine,
  },
  rowOn: { backgroundColor: 'rgba(212,160,23,0.06)' },
  flag: { fontSize: 22 },
  label: { fontFamily: FONTS.semi, fontSize: 15, color: COLORS.text },
  native: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textDim, marginTop: 2 },
  check: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  checkOff: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLORS.navyLine,
  },
  empty: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textDim, marginTop: 24, textAlign: 'center' },
  note: { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textFaint, marginTop: 24, lineHeight: 16 },
});

export default LanguagePickerScreen;
