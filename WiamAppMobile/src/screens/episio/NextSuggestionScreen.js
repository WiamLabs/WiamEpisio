/**
 * WiamEpisio-Next-Suggestion.html — More like this
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Play } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const SUGGESTIONS = [
  { id: '101', title: 'Midnight Accra', genre: 'Romance' },
  { id: '102', title: 'Palace of Secrets', genre: 'Drama' },
  { id: '103', title: 'Two Hearts Lagos', genre: 'Romance' },
];

const NextSuggestionScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const seriesTitle = route.params?.seriesTitle || 'this series';

  return (
    <EpisioScreenShell title="More like this" subtitle={`Because you watched ${seriesTitle}`}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {SUGGESTIONS.map((s, i) => (
          <View key={s.id} style={styles.card}>
            <LinearGradient colors={['#3a1420', '#12122a']} style={styles.poster}>
              <Text style={styles.genre}>{s.genre}</Text>
            </LinearGradient>
            <Text style={styles.cardTitle} numberOfLines={2}>{s.title}</Text>
            <TouchableOpacity
              style={styles.watchBtn}
              onPress={() => navigation.navigate('SeriesDetail', { seriesId: s.id })}
            >
              <Play size={14} color={COLORS.navy} fill={COLORS.navy} />
              <Text style={styles.watchText}>Watch</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
      <Text style={styles.hint}>Recommendations improve as you watch more episodes.</Text>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  rail: { gap: 14, paddingVertical: 12 },
  card: { width: 140 },
  poster: { width: 140, height: 200, borderRadius: RADIUS.md, padding: 8, justifyContent: 'flex-end' },
  genre: { fontSize: 9, fontFamily: FONTS.bold, color: COLORS.gold },
  cardTitle: { fontFamily: FONTS.semi, fontSize: 13, color: COLORS.text, marginTop: 8, marginBottom: 8 },
  watchBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: COLORS.gold, borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 8,
  },
  watchText: { fontFamily: FONTS.bold, fontSize: 12, color: COLORS.navy },
  hint: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textDim, marginTop: 20 },
});

export default NextSuggestionScreen;
