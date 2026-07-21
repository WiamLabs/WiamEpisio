/**
 * Trailer with sound. Reminder + Follow wired to real APIs.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ChevronLeft, Bell, UserPlus } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import watchApi from '../../api/watch';
import episodesApi from '../../api/episodes';
import studioEpisioApi from '../../api/studioEpisio';
import creatorApi from '../../api/creator';
import useAuthStore from '../../store/useAuthStore';

const TrailerPlayerScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const seriesId = route.params?.seriesId;
  const title = route.params?.title || 'Trailer';
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [remindMsg, setRemindMsg] = useState(null);
  const [creatorId, setCreatorId] = useState(null);
  const [following, setFollowing] = useState(false);

  const player = useVideoPlayer(url || '', (p) => {
    p.loop = false;
    p.muted = false;
    try { p.volume = 1; } catch { /* ignore */ }
    if (url) p.play();
  });

  useEffect(() => {
    if (url && player) {
      const run = async () => {
        try {
          player.muted = false;
          player.volume = 1;
          if (typeof player.replaceAsync === 'function') {
            await player.replaceAsync(url);
          } else {
            player.replace(url);
          }
          player.play();
        } catch { /* ignore */ }
      };
      run();
    }
  }, [url, player]);

  const load = useCallback(async () => {
    if (!seriesId) {
      setError('Missing series');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [stream, detail] = await Promise.all([
        watchApi.trailerStream(seriesId),
        episodesApi.getSeries(seriesId).catch(() => null),
      ]);
      const u = stream?.url || stream?.manifest_url || stream?.hls_url || stream?.signed_url;
      if (!u) throw new Error(stream?.error || 'No trailer');
      setUrl(u);
      setError(null);
      const s = detail?.series || detail;
      // Follow API needs User.id (creator_id), not creator_wiam_id
      const cid = s?.creator_id || s?.author_id;
      setCreatorId(cid || null);
      setFollowing(!!(s?.is_following || s?.following));
    } catch (e) {
      setError(typeof e === 'string' ? e : (e?.message || 'Trailer unavailable'));
    } finally {
      setLoading(false);
    }
  }, [seriesId]);

  useEffect(() => { load(); }, [load]);

  const requireAuth = (fn) => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    fn();
  };

  const remind = () => requireAuth(async () => {
    try {
      await studioEpisioApi.remind(seriesId);
      setRemindMsg('Reminder set');
    } catch (e) {
      setRemindMsg(e?.message || 'Could not set reminder');
    }
  });

  const follow = () => requireAuth(async () => {
    if (!creatorId) {
      Alert.alert('Follow', 'Creator profile is not available for this series yet.');
      return;
    }
    try {
      const data = await creatorApi.toggleFollow(creatorId);
      setFollowing(!!(data?.following ?? data?.is_following ?? !following));
      setRemindMsg(following ? 'Unfollowed' : 'Following creator');
    } catch (e) {
      Alert.alert('Follow', typeof e === 'string' ? e : (e?.message || 'Could not follow'));
    }
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.top}>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={18} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <TouchableOpacity style={styles.btn} onPress={remind}>
          <Bell size={16} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={styles.frame}>
        {loading ? <ActivityIndicator color={COLORS.gold} size="large" /> : null}
        {error ? (
          <View style={styles.center}>
            <Text style={styles.error}>{error}</Text>
            <TouchableOpacity onPress={load}><Text style={styles.retry}>Retry</Text></TouchableOpacity>
          </View>
        ) : null}
        {url && !error ? (
          <VideoView style={StyleSheet.absoluteFill} player={player} nativeControls contentFit="contain" />
        ) : null}
      </View>
      {remindMsg ? <Text style={styles.remind}>{remindMsg}</Text> : null}
      <View style={styles.actions}>
        {creatorId ? (
          <TouchableOpacity
            style={[styles.followBtn, following && styles.followBtnActive]}
            onPress={follow}
          >
            <UserPlus size={14} color={following ? COLORS.navy : COLORS.gold} />
            <Text style={[styles.followText, following && { color: COLORS.navy }]}>
              {following ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={styles.watch}
          onPress={() => navigation.replace('SeriesDetail', { seriesId })}
        >
          <Text style={styles.watchText}>Open series</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  top: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8, gap: 10,
  },
  btn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { flex: 1, color: '#fff', fontFamily: FONTS.semi, fontSize: 14 },
  frame: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', padding: 24 },
  error: { color: '#fff', fontFamily: FONTS.medium, textAlign: 'center' },
  retry: { marginTop: 12, color: COLORS.gold, fontFamily: FONTS.bold },
  remind: { textAlign: 'center', color: COLORS.gold, fontFamily: FONTS.medium, marginBottom: 8 },
  actions: { paddingHorizontal: 20, paddingBottom: 28, gap: 10 },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: COLORS.gold, borderRadius: 12, paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  followBtnActive: { backgroundColor: COLORS.gold },
  followText: { color: COLORS.gold, fontFamily: FONTS.bold, fontSize: 13.5 },
  watch: {
    backgroundColor: COLORS.gold, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  watchText: { fontFamily: FONTS.bold, color: COLORS.navy, fontSize: 14 },
});

export default TrailerPlayerScreen;
