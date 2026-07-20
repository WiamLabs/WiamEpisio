import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import notificationsApi from '../../api/notifications';
import useAuthStore from '../../store/useAuthStore';

const NotificationsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (soft = false) => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    if (!soft) setLoading(true);
    setError(null);
    try {
      const data = await notificationsApi.list();
      setItems(data?.notifications || data?.items || (Array.isArray(data) ? data : []));
    } catch (e) {
      setError('Could not load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!isAuthenticated) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.empty}>Sign in to see notifications.</Text>
        <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.ctaText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.top}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <ChevronLeft size={20} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <TouchableOpacity onPress={() => notificationsApi.markAllRead().then(() => load(true))}>
          <Text style={styles.mark}>Mark all</Text>
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={items}
          keyExtractor={(item, i) => String(item.id || i)}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={COLORS.gold} />
          }
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          ListEmptyComponent={<Text style={styles.empty}>No notifications yet.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, !item.is_read && styles.unread]}
              onPress={() => {
                if (item.id) notificationsApi.markRead(item.id).catch(() => {});
                const link = item.link || item.data?.link;
                if (link && String(link).includes('/series/')) {
                  const id = String(link).split('/series/')[1]?.split(/[/?]/)[0];
                  if (id) navigation.navigate('SeriesDetail', { seriesId: Number(id) });
                }
              }}
            >
              <Text style={styles.rowTitle}>{item.title || item.type || 'Update'}</Text>
              <Text style={styles.rowBody} numberOfLines={3}>{item.body || item.message || ''}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12, gap: 10 },
  back: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 18, fontFamily: FONTS.bold, color: COLORS.text },
  mark: { color: COLORS.gold, fontFamily: FONTS.semi, fontSize: 12 },
  row: {
    backgroundColor: COLORS.navyCard, borderRadius: 14, borderWidth: 1, borderColor: COLORS.navyLine,
    padding: 14, marginBottom: 10,
  },
  unread: { borderColor: COLORS.goldDark },
  rowTitle: { fontFamily: FONTS.semi, color: COLORS.text, fontSize: 14 },
  rowBody: { marginTop: 4, color: COLORS.textDim, fontFamily: FONTS.regular, fontSize: 12.5, lineHeight: 18 },
  empty: { textAlign: 'center', color: COLORS.textFaint, marginTop: 40, fontFamily: FONTS.medium },
  error: { color: COLORS.error, paddingHorizontal: 20, fontFamily: FONTS.medium },
  cta: { marginTop: 16, backgroundColor: COLORS.gold, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  ctaText: { fontFamily: FONTS.bold, color: COLORS.navy },
});

export default NotificationsScreen;
