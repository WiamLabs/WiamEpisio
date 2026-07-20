import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';

const StudioSpecsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [specs, setSpecs] = useState(null);
  const [provider, setProvider] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    studioEpisioApi.mediaSpecs()
      .then((d) => {
        setSpecs(d.specs);
        setProvider(d.provider);
      })
      .catch((e) => setError(e?.message || 'Failed to load specs'));
  }, []);

  return (
    <ScrollView style={[styles.root, { paddingTop: insets.top + 8 }]} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <ChevronLeft size={20} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={styles.title}>Upload specs</Text>
      <Text style={styles.sub}>Provider: {provider || '…'} · Wrong size is rejected.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!specs ? <ActivityIndicator color={COLORS.gold} /> : (
        Object.entries(specs).map(([key, val]) => (
          <View key={key} style={styles.card}>
            <Text style={styles.cardTitle}>{key}</Text>
            {Object.entries(val).map(([k, v]) => (
              <Text key={k} style={styles.line}>{k}: {Array.isArray(v) ? v.join('–') : String(v)}</Text>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  back: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  title: { fontSize: 22, fontFamily: FONTS.extraBold, color: COLORS.text },
  sub: { marginTop: 6, marginBottom: 16, color: COLORS.textDim, fontFamily: FONTS.regular },
  card: {
    backgroundColor: COLORS.navyCard, borderRadius: 14, borderWidth: 1, borderColor: COLORS.navyLine,
    padding: 14, marginBottom: 12,
  },
  cardTitle: { fontFamily: FONTS.bold, color: COLORS.gold, marginBottom: 8, textTransform: 'capitalize' },
  line: { color: COLORS.text, fontFamily: FONTS.regular, fontSize: 13, marginBottom: 4 },
  error: { color: COLORS.error, fontFamily: FONTS.medium },
});

export default StudioSpecsScreen;
