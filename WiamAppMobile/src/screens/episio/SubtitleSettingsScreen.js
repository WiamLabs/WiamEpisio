/**
 * WiamEpisio-Subtitle-Settings.html — preview, toggle, size chips, appearance rows.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChevronRight } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const SUB_KEY = '@episio_subtitles';
const SIZES = [
  { id: 'S', label: 'Small', px: 12 },
  { id: 'M', label: 'Medium', px: 15 },
  { id: 'L', label: 'Large', px: 18 },
];

const SubtitleSettingsScreen = () => {
  const [show, setShow] = useState(true);
  const [language, setLanguage] = useState('English');
  const [size, setSize] = useState('M');
  const [background] = useState('Semi-transparent');
  const [textColor] = useState('White');

  useEffect(() => {
    AsyncStorage.getItem(SUB_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (typeof parsed.show === 'boolean') setShow(parsed.show);
        if (parsed.language) setLanguage(parsed.language);
        if (parsed.size) setSize(parsed.size);
      })
      .catch(() => {});
  }, []);

  const persist = (next) => {
    AsyncStorage.setItem(SUB_KEY, JSON.stringify(next)).catch(() => {});
  };

  const onToggle = (v) => {
    setShow(v);
    persist({ show: v, language, size });
  };

  const onSize = (id) => {
    setSize(id);
    persist({ show, language, size: id });
  };

  const fontSize = SIZES.find((s) => s.id === size)?.px || 15;

  return (
    <EpisioScreenShell title="Subtitles & CC" subtitle="Caption preferences">
      <View style={styles.previewFrame}>
        <View style={styles.previewBg} />
        {show ? (
          <View style={styles.captionPill}>
            <Text style={[styles.captionText, { fontSize }]}>
              Whatever you decide, I stand with you.
            </Text>
          </View>
        ) : (
          <Text style={styles.previewOff}>Subtitles off</Text>
        )}
      </View>

      <Text style={styles.group}>CAPTIONS</Text>
      <View style={styles.card}>
        <View style={styles.toggleRow}>
          <Text style={styles.rowLabel}>Show subtitles</Text>
          <Switch
            value={show}
            onValueChange={onToggle}
            trackColor={{ false: COLORS.navyLine, true: COLORS.gold }}
            thumbColor="#fff"
          />
        </View>
        <TouchableOpacity
          style={styles.row}
          onPress={() => setLanguage((prev) => (prev === 'English' ? 'Off' : 'English'))}
          activeOpacity={0.85}
        >
          <Text style={styles.rowLabel}>Subtitle language</Text>
          <View style={styles.rowRight}>
            <Text style={styles.rowValue}>{language}</Text>
            <ChevronRight size={16} color={COLORS.textFaint} />
          </View>
        </TouchableOpacity>
      </View>

      <Text style={styles.group}>APPEARANCE</Text>
      <View style={styles.card}>
        <Text style={[styles.rowLabel, { marginBottom: 10 }]}>Text size</Text>
        <View style={styles.chips}>
          {SIZES.map((s) => {
            const on = size === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => onSize(s.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.row, styles.rowBorder]}>
          <Text style={styles.rowLabel}>Background</Text>
          <View style={styles.rowRight}>
            <Text style={styles.rowValue}>{background}</Text>
            <ChevronRight size={16} color={COLORS.textFaint} />
          </View>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Text color</Text>
          <View style={styles.rowRight}>
            <View style={styles.swatch} />
            <Text style={styles.rowValue}>{textColor}</Text>
            <ChevronRight size={16} color={COLORS.textFaint} />
          </View>
        </View>
      </View>

      <Text style={styles.note}>
        Preferences stay on this device. Player screens read them when captions are available.
      </Text>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  previewFrame: {
    height: 160, borderRadius: RADIUS.lg, overflow: 'hidden',
    backgroundColor: '#000', marginTop: 4, alignItems: 'center', justifyContent: 'flex-end',
    paddingBottom: 18, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  previewBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1028',
  },
  captionPill: {
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 6, maxWidth: '88%',
  },
  captionText: { fontFamily: FONTS.regular, color: '#fff', textAlign: 'center', lineHeight: 22 },
  previewOff: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textFaint },
  group: {
    fontFamily: FONTS.semi, fontSize: 11, color: COLORS.textFaint, letterSpacing: 0.8,
    marginTop: 22, marginBottom: 10,
  },
  card: {
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS.lg, borderWidth: 1,
    borderColor: COLORS.navyLine, paddingHorizontal: 14, paddingVertical: 4,
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.navyLine,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: COLORS.navyLine, marginTop: 12 },
  rowLabel: { fontFamily: FONTS.regular, fontSize: 15, color: COLORS.text },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { fontFamily: FONTS.semi, fontSize: 13, color: COLORS.textDim },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  chip: {
    flex: 1, paddingVertical: 10, borderRadius: RADIUS.sm, alignItems: 'center',
    backgroundColor: COLORS.navySoft, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  chipOn: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  chipText: { fontFamily: FONTS.semi, fontSize: 12, color: COLORS.textDim },
  chipTextOn: { color: COLORS.navy },
  swatch: {
    width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff',
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  note: { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textFaint, marginTop: 20, lineHeight: 16 },
});

export default SubtitleSettingsScreen;
