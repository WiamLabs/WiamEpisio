/**
 * Subtitle settings
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const TRACKS = ['Off', 'English'];

const SubtitleSettingsScreen = () => {
  const [track, setTrack] = useState('English');
  const [largeText, setLargeText] = useState(false);
  const [background, setBackground] = useState(true);

  return (
    <EpisioScreenShell title="Subtitles" subtitle="Caption preferences">
      <Text style={styles.section}>Language</Text>
      {TRACKS.map((t) => (
        <TouchableOpacity key={t} style={styles.row} onPress={() => setTrack(t)}>
          <Text style={styles.rowLabel}>{t}</Text>
          <View style={[styles.radio, track === t && styles.radioOn]} />
        </TouchableOpacity>
      ))}
      <Text style={styles.section}>Display</Text>
      <View style={styles.toggleRow}>
        <Text style={styles.rowLabel}>Large text</Text>
        <Switch value={largeText} onValueChange={setLargeText} trackColor={{ true: COLORS.gold }} />
      </View>
      <View style={styles.toggleRow}>
        <Text style={styles.rowLabel}>Dark background</Text>
        <Switch value={background} onValueChange={setBackground} trackColor={{ true: COLORS.gold }} />
      </View>
      <View style={styles.preview}>
        <Text style={[styles.previewText, largeText && { fontSize: 16 }]}>
          Sample subtitle preview
        </Text>
      </View>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  section: { fontFamily: FONTS.semi, fontSize: 12, color: COLORS.textDim, marginTop: 16, marginBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.navyLine,
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12,
  },
  rowLabel: { fontFamily: FONTS.regular, fontSize: 15, color: COLORS.text },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.navyLine },
  radioOn: { borderColor: COLORS.gold, backgroundColor: COLORS.gold },
  preview: {
    marginTop: 24, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: RADIUS.sm,
    padding: 10, alignSelf: 'center',
  },
  previewText: { fontFamily: FONTS.regular, fontSize: 13, color: '#fff', textAlign: 'center' },
});

export default SubtitleSettingsScreen;
