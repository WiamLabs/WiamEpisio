/**
 * Reminders list — /watch/reminders
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Bell, BellOff } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import useAuthStore from '../../store/useAuthStore';

const RemindersScreen = () => {
  const navigation = useNavigation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (soft = false) => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    if (!soft) setLoading(true);
    try {
      const data = await studioEpisioApi.listReminders();
      setItems(data?.reminders || data?.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!isAuthenticated) {
    return (
      <EpisioScreenShell title="Reminders">
        <Text style={styles.emptyTitle}>Sign in to see reminders</Text>
        <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.ctaText}>Sign In</Text>
        </TouchableOpacity>
      </EpisioScreenShell>
    );
  }

  return (
    <EpisioScreenShell title="Reminders" subtitle="Series you asked us to notify">
      {loading ? (
        <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <BellOff size={40} color={COLORS.textFaint} />
          <Text style={styles.emptyTitle}>No reminders yet</Text>
          <Text style={styles.emptySub}>Tap Save on a series to get notified when new episodes drop.</Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={COLORS.gold} />}
        >
          {items.map((r) => (
            <TouchableOpacity
              key={String(r.id || r.series_id)}
              style={styles.row}
              onPress={() => navigation.navigate('SeriesDetail', { seriesId: r.series_id || r.content_id || r.id })}
            >
              <Bell size={18} color={COLORS.gold} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{r.title || r.series_title || 'Series'}</Text>
                {r.note ? <Text style={styles.rowSub}>{r.note}</Text> : null}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  empty: { alignItems: 'center', paddingTop: 48, gap: 10 },
  emptyTitle: { fontFamily: FONTS.extraBold, fontSize: 17, color: COLORS.text, marginTop: 8 },
  emptySub: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textDim, textAlign: 'center', paddingHorizontal: 24 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.navyLine,
  },
  rowTitle: { fontFamily: FONTS.semi, fontSize: 14, color: COLORS.text },
  rowSub: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textDim, marginTop: 2 },
  cta: { marginTop: 20, backgroundColor: COLORS.gold, borderRadius: RADIUS.md, padding: 14, alignItems: 'center' },
  ctaText: { fontFamily: FONTS.bold, color: COLORS.navy },
});

export default RemindersScreen;
