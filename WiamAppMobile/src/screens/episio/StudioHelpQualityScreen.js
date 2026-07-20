/**
 * Layout: WiamStudio-Help-Quality.html
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronDown, ChevronUp, MessageCircle } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';

const CHIPS = ['All', 'Rejections', 'Specs', 'Review Time', 'Payouts'];

const FAQS = [
  {
    chip: 'Specs',
    q: 'What video specs pass review?',
    a: 'Episodes must be 9:16 vertical, preferred 1080×1920, 4–5 minutes (accept band 3:00–6:00), H.264 + AAC MP4. Trailer 15–60 seconds.',
  },
  {
    chip: 'Rejections',
    q: 'Why did my trailer fail?',
    a: 'Common fails: wrong duration (not 15–60s), watermarks, heavy compression, or wrong aspect. Fix and re-upload — only that asset is re-checked on Needs Changes.',
  },
  {
    chip: 'Review Time',
    q: 'How long does review take?',
    a: 'Up to 72 hours for New creators (faster for Rising / Trusted / Elite). Machines check trailer + every episode; the WiamEpisio team publishes when it clears.',
  },
  {
    chip: 'Rejections',
    q: 'If something fails, does Episode 1 still go live?',
    a: 'No. Needs Changes keeps the whole series offline until everything is fixed and our team publishes.',
  },
  {
    chip: 'Specs',
    q: 'What about soft interest?',
    a: 'Submit unlocks after 50 followers alone, or 200 combined followers + Remind Me taps. Hard quality (full season + trailer) still comes first.',
  },
  {
    chip: 'Payouts',
    q: 'When do earnings start?',
    a: 'Only after the WiamEpisio team publishes you live. Complete KYC + bank details, then monthly payouts above the minimum threshold.',
  },
  {
    chip: 'Rejections',
    q: 'What about Revision Requests?',
    a: 'Only after you’re live, and only for legal, rights, or factual fixes — not quality. Only the piece you pick is re-reviewed; the rest stays live.',
  },
];

const StudioHelpQualityScreen = () => {
  const navigation = useNavigation();
  const [chip, setChip] = useState('All');
  const [open, setOpen] = useState(0);
  const [query, setQuery] = useState('');

  const filtered = FAQS.filter((f) => {
    const chipOk = chip === 'All' || f.chip === chip;
    const q = query.trim().toLowerCase();
    const textOk = !q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
    return chipOk && textOk;
  });

  return (
    <EpisioScreenShell
      title="Quality & review help"
      subtitle="Creator FAQ"
      footer={(
        <EpisioGoldButton
          label="Message the review team"
          onPress={() => Linking.openURL('mailto:support@wiamapp.com?subject=WiamStudio%20quality%20help')}
        />
      )}
    >
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Search help…"
        placeholderTextColor={COLORS.textFaint}
      />

      <View style={styles.chips}>
        {CHIPS.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.chip, chip === c && styles.chipOn]}
            onPress={() => setChip(c)}
          >
            <Text style={[styles.chipText, chip === c && { color: COLORS.navy }]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {filtered.map((f, idx) => {
        const isOpen = open === idx;
        return (
          <TouchableOpacity
            key={f.q}
            style={styles.card}
            onPress={() => setOpen(isOpen ? -1 : idx)}
            activeOpacity={0.85}
          >
            <View style={styles.qRow}>
              <Text style={styles.q}>{f.q}</Text>
              {isOpen ? <ChevronUp size={16} color={COLORS.textFaint} /> : <ChevronDown size={16} color={COLORS.textFaint} />}
            </View>
            {isOpen ? <Text style={styles.a}>{f.a}</Text> : null}
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity onPress={() => navigation.navigate('StudioSpecs')} style={{ marginTop: 8 }}>
        <Text style={styles.link}>Open Specs guide →</Text>
      </TouchableOpacity>

      <View style={styles.contact}>
        <MessageCircle size={16} color={COLORS.gold} />
        <Text style={styles.contactText}>
          Chat replies within 24h · support@wiamapp.com
        </Text>
      </View>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  search: {
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 12, padding: 12, color: COLORS.text, marginBottom: 12, fontFamily: FONTS.regular,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  chipOn: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  chipText: { fontFamily: FONTS.bold, color: COLORS.textDim, fontSize: 11 },
  card: {
    backgroundColor: COLORS.navyCard, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  qRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  q: { flex: 1, fontFamily: FONTS.bold, color: '#fff', fontSize: 13 },
  a: { marginTop: 8, fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 12.5, lineHeight: 19 },
  link: { color: COLORS.gold, fontFamily: FONTS.semi, fontSize: 13 },
  contact: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18,
    backgroundColor: COLORS.navyCard, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  contactText: { flex: 1, fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 12 },
});

export default StudioHelpQualityScreen;
