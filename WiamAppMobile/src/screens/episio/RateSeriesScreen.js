/**
 * WiamEpisio-Rate-Series.html
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Star } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';
import apiClient from '../../api/client';
import useAuthStore from '../../store/useAuthStore';

const RateSeriesScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const seriesId = route.params?.seriesId;
  const seriesTitle = route.params?.seriesTitle || route.params?.title || 'this series';
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [stars, setStars] = useState(0);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    if (!stars) {
      Alert.alert('Rate', 'Pick 1–5 stars first.');
      return;
    }
    setBusy(true);
    try {
      await apiClient.post(`/books/${seriesId}/rate`, { rating: stars });
      Alert.alert('Thanks', `You rated ${stars} stars.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Rate', e?.response?.data?.error || e?.message || 'Could not submit rating');
    } finally {
      setBusy(false);
    }
  };

  return (
    <EpisioScreenShell
      title="Rate series"
      subtitle={seriesTitle}
      footer={(
        <TouchableOpacity style={styles.cta} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color={COLORS.navy} /> : <Text style={styles.ctaText}>Submit</Text>}
        </TouchableOpacity>
      )}
    >
      <Text style={styles.prompt}>How was {seriesTitle}?</Text>
      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity key={n} onPress={() => setStars(n)} style={styles.starBtn}>
            <Star
              size={36}
              color={n <= stars ? COLORS.gold : COLORS.navyLine}
              fill={n <= stars ? COLORS.gold : 'transparent'}
            />
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.note}>Your rating helps others discover great African drama.</Text>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  prompt: { fontFamily: FONTS.semi, fontSize: 16, color: COLORS.text, marginTop: 20, marginBottom: 24 },
  starRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
  starBtn: { padding: 4 },
  note: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textDim, textAlign: 'center', lineHeight: 18 },
  cta: {
    backgroundColor: COLORS.gold, borderRadius: RADIUS.md, padding: 15, alignItems: 'center',
  },
  ctaText: { fontFamily: FONTS.extraBold, fontSize: 14, color: COLORS.navy },
});

export default RateSeriesScreen;
