/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
/**
 * LibraryScreen — watch-first: continue watching + saved series placeholders.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Bookmark } from 'lucide-react-native';
import { EPISIO, EPISIO_FONTS } from '../../constants/episioTheme';
import episodesApi from '../../api/episodes';
import useAuthStore from '../../store/useAuthStore';
import SectionHeader from '../../components/watch/SectionHeader';
import FreeRing from '../../components/watch/FreeRing';

const LibraryScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [continueItems, setContinueItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setContinueItems([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const cw = await episodesApi.continueWatching();
      setContinueItems(cw?.continue_watching || []);
    } catch {
      setContinueItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  if (loading && !refreshing) {
    return (
      <View style={[styles.page, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={EPISIO.ember} />
      </View>
    );
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.heading}>Library</Text>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={EPISIO.ember}
          />
        )}
      >
        {!isAuthenticated ? (
          <View style={styles.guest}>
            <Bookmark size={32} color={EPISIO.ember} />
            <Text style={styles.guestTitle}>Save what you watch</Text>
            <Text style={styles.guestBody}>
              Sign in to keep continue-watching and favorites across devices.
            </Text>
            <Text style={styles.guestBody}>Keep watching as a guest for now.</Text>
          </View>
        ) : (
          <>
            <SectionHeader title="Continue watching" />
            {continueItems.length === 0 ? (
              <Text style={styles.empty}>No watch progress yet. Start a series from Home.</Text>
            ) : (
              <View style={styles.cwList}>
                {continueItems.map((item, i) => {
                  const pct = item.progress_pct
                    ?? (item.seconds_watched && item.duration_seconds
                      ? Math.round((item.seconds_watched / item.duration_seconds) * 100)
                      : 30);
                  const series = item.series || {};
                  return (
                    <TouchableOpacity
                      key={String(item.episode?.id || i)}
                      style={styles.cwRow}
                      onPress={() => {
                        if (!series.id) return;
                        navigation.navigate('Player', {
                          seriesId: series.id,
                          episodeId: item.episode?.id,
                        });
                      }}
                    >
                      <FreeRing pct={pct} size={56} label={`EP ${item.episode?.episode_number || '?'}`} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cwTitle} numberOfLines={1}>{series.title || 'Series'}</Text>
                        <Text style={styles.cwMeta}>
                          Episode {item.episode?.episode_number || '?'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View style={{ height: 24 }} />
            <SectionHeader title="My list" />
            <Text style={styles.empty}>
              Favorites / watchlist arrive in a later pass. Keep watching — progress is saved above.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: EPISIO.ink900 },
  center: { alignItems: 'center', justifyContent: 'center' },
  heading: {
    fontFamily: EPISIO_FONTS.display,
    fontSize: 28,
    color: EPISIO.paper,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  guest: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 24 },
  guestTitle: {
    fontFamily: EPISIO_FONTS.display,
    fontSize: 22,
    color: EPISIO.paper,
    marginTop: 16,
  },
  guestBody: {
    color: EPISIO.smoke,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    fontFamily: EPISIO_FONTS.ui,
  },
  cta: {
    marginTop: 20,
    backgroundColor: EPISIO.ember,
    paddingVertical: 13,
    paddingHorizontal: 22,
    borderRadius: 999,
  },
  ctaText: { color: EPISIO.emberDeep, fontFamily: EPISIO_FONTS.uiSemi, fontSize: 14 },
  empty: { color: EPISIO.smoke, fontFamily: EPISIO_FONTS.ui, lineHeight: 20 },
  cwList: { gap: 14 },
  cwRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cwTitle: { fontFamily: EPISIO_FONTS.uiSemi, color: EPISIO.paper, fontSize: 15 },
  cwMeta: { fontFamily: EPISIO_FONTS.ui, color: EPISIO.smoke, fontSize: 12, marginTop: 2 },
});

export default LibraryScreen;
