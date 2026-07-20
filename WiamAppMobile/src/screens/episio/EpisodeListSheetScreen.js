/**
 * WiamEpisio-Episode-List-Sheet.html
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Lock, Play } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';
import episodesApi from '../../api/episodes';

const EpisodeListSheetScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const seriesId = route.params?.seriesId;
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!seriesId) return;
    setLoading(true);
    try {
      const data = await episodesApi.listEpisodes(seriesId);
      setEpisodes(data?.episodes || data?.items || []);
    } catch {
      setEpisodes([]);
    } finally {
      setLoading(false);
    }
  }, [seriesId]);

  useEffect(() => { load(); }, [load]);

  const openEpisode = (ep) => {
    if (ep.locked) {
      navigation.navigate('UnlockTakeover', {
        episodeId: ep.id,
        seriesId,
        unlockPrice: ep.unlock_price_coins || 10,
        episodeNumber: ep.episode_number,
      });
      return;
    }
    navigation.navigate('Player', { episodeId: ep.id, seriesId });
  };

  return (
    <EpisioScreenShell title="Episodes" subtitle="Tap to play">
      {loading ? (
        <ActivityIndicator color={COLORS.gold} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={episodes}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => openEpisode(item)}>
              <View style={styles.num}>
                <Text style={styles.numText}>{item.episode_number ?? '—'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.epTitle}>{item.title || `Episode ${item.episode_number}`}</Text>
                {item.duration_seconds ? (
                  <Text style={styles.meta}>{Math.round(item.duration_seconds / 60)} min</Text>
                ) : null}
              </View>
              {item.locked ? (
                <Lock size={16} color={COLORS.gold} />
              ) : (
                <Play size={16} color={COLORS.gold} fill={COLORS.gold} />
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={(
            <Text style={styles.empty}>No episodes listed yet.</Text>
          )}
        />
      )}
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.navyLine,
  },
  num: {
    width: 36, height: 36, borderRadius: RADIUS.sm, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  numText: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.gold },
  epTitle: { fontFamily: FONTS.semi, fontSize: 14, color: COLORS.text },
  meta: { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textDim, marginTop: 2 },
  empty: { fontFamily: FONTS.regular, color: COLORS.textDim, textAlign: 'center', marginTop: 32 },
});

export default EpisodeListSheetScreen;
