/**
 * Thin Series tab for creator mood — same cards as Studio Home "My Series".
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Plus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import resolveUrl from '../../utils/resolveUrl';

const StudioSeriesTabScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await studioEpisioApi.listSeries();
      setSeries(data?.series || []);
    } catch {
      setSeries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>My Series</Text>
        <TouchableOpacity
          style={styles.plus}
          onPress={() => navigation.navigate('StudioSeriesCreate')}
        >
          <Plus size={18} color={COLORS.navy} />
        </TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={series}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={COLORS.gold}
            />
          )}
          ListEmptyComponent={(
            <Text style={styles.empty}>No series yet. Tap + to create.</Text>
          )}
          renderItem={({ item }) => {
            const cover = resolveUrl(item.poster_url || item.cover_url);
            const ready = item.ready_episodes || 0;
            const planned = item.planned_episode_count || 0;
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('StudioSeriesDetail', { seriesId: item.id })}
              >
                {cover ? (
                  <Image source={{ uri: cover }} style={styles.poster} />
                ) : (
                  <LinearGradient colors={['#3a1420', '#12122a']} style={styles.poster} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.meta}>
                    {ready}/{planned || '—'} episodes · {(item.pipeline_state || 'draft').replace(/_/g, ' ')}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 12,
  },
  title: { fontFamily: FONTS.extraBold, fontSize: 20, color: '#fff' },
  plus: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  empty: { textAlign: 'center', color: COLORS.textFaint, marginTop: 40, fontFamily: FONTS.medium },
  card: {
    flexDirection: 'row', gap: 12, alignItems: 'center',
    backgroundColor: COLORS.navyCard, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  poster: { width: 52, height: 74, borderRadius: 8 },
  cardTitle: { fontFamily: FONTS.bold, fontSize: 14, color: '#fff' },
  meta: { marginTop: 4, fontFamily: FONTS.regular, fontSize: 11.5, color: COLORS.textDim },
});

export default StudioSeriesTabScreen;
