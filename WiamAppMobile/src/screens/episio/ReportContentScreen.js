/**
 * Report content — reasons list
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRoute } from '@react-navigation/native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const REASONS = [
  'Inappropriate content',
  'Copyright / rights issue',
  'Misleading title or description',
  'Harassment or hate',
  'Spam or scam',
  'Other',
];

const ReportContentScreen = () => {
  const route = useRoute();
  const { contentId, contentType = 'series' } = route.params || {};
  const [selected, setSelected] = useState(null);

  const submit = () => {
    if (!selected) {
      Alert.alert('Report', 'Select a reason first.');
      return;
    }
    Alert.alert('Report submitted', 'The WiamEpisio team will review this report.');
  };

  return (
    <EpisioScreenShell
      title="Report content"
      subtitle={contentType === 'episode' ? 'Episode' : 'Series'}
      footer={(
        <TouchableOpacity style={styles.cta} onPress={submit}>
          <Text style={styles.ctaText}>Submit report</Text>
        </TouchableOpacity>
      )}
    >
      <Text style={styles.hint}>Why are you reporting this? Reports are confidential.</Text>
      {REASONS.map((r) => (
        <TouchableOpacity key={r} style={styles.row} onPress={() => setSelected(r)}>
          <Text style={styles.rowLabel}>{r}</Text>
          <View style={[styles.radio, selected === r && styles.radioOn]} />
        </TouchableOpacity>
      ))}
      {contentId ? <Text style={styles.ref}>Ref: {contentType} #{contentId}</Text> : null}
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  hint: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textDim, marginBottom: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.navyLine,
  },
  rowLabel: { fontFamily: FONTS.regular, fontSize: 15, color: COLORS.text, flex: 1, paddingRight: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.navyLine },
  radioOn: { borderColor: COLORS.gold, backgroundColor: COLORS.gold },
  ref: { fontFamily: FONTS.regular, fontSize: 10, color: COLORS.textFaint, marginTop: 20 },
  cta: { backgroundColor: COLORS.gold, borderRadius: RADIUS.md, padding: 15, alignItems: 'center' },
  ctaText: { fontFamily: FONTS.extraBold, fontSize: 14, color: COLORS.navy },
});

export default ReportContentScreen;
