/**
 * Watch history — local / API placeholder list
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Clock } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';
import episodesApi from '../../api/episodes';
import useAuthStore from '../../store/useAuthStore';

const WatchHistoryScreen = () => {
  const navigation = useNavigation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await episodesApi.continueWatching();
      const list = data?.items || data?.continue || data?.series || [];
      setItems(Array.isArray(list) ? list : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <EpisioScreenShell title="Watch history" subtitle="Recently watched">
      {loading ? (
        <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Clock size={40} color={COLORS.textFaint} />
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          <Text style={styles.emptySub}>Episodes you watch will show up here.</Text>
          <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('Main')}>
            <Text style={styles.ctaText}>Browse Home</Text>
          </TouchableOpacity>
        </View>
      ) : (
        items.map((item, i) => (
          <TouchableOpacity
            key={String(item.id || i)}
            style={styles.row}
            onPress={() => navigation.navigate('Player', {
              episodeId: item.episode_id || item.last_episode_id,
              seriesId: item.series_id || item.id,
            })}
          >
            <Text style={styles.rowTitle}>{item.series_title || item.title || 'Series'}</Text>
            {item.episode_number ? (
              <Text style={styles.rowSub}>EP {item.episode_number}</Text>
            ) : null}
          </TouchableOpacity>
        ))
      )}
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  empty: { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyTitle: { fontFamily: FONTS.extraBold, fontSize: 17, color: COLORS.text, marginTop: 8 },
  emptySub: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textDim, textAlign: 'center' },
  cta: { marginTop: 20, backgroundColor: COLORS.gold, borderRadius: RADIUS.md, paddingHorizontal: 24, paddingVertical: 12 },
  ctaText: { fontFamily: FONTS.bold, color: COLORS.navy },
  row: {
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.navyLine,
  },
  rowTitle: { fontFamily: FONTS.semi, fontSize: 14, color: COLORS.text },
  rowSub: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textDim, marginTop: 2 },
});

export default WatchHistoryScreen;
