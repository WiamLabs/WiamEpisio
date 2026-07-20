/**
 * WiamEpisio-Creator-Public-Profile.html
 * Banner + avatar properly spaced under safe area (avatar not clipped).
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Share, ScrollView, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Share2 } from 'lucide-react-native';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';
import apiClient from '../../api/client';
import creatorApi from '../../api/creator';
import useAuthStore from '../../store/useAuthStore';
import resolveUrl from '../../utils/resolveUrl';

const CreatorPublicProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation();
  const creatorId = route.params?.creatorId;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const myId = useAuthStore((s) => s.user?.id);
  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!creatorId) return;
    setLoading(true);
    try {
      const { data } = await apiClient.get(`/creators/${creatorId}`);
      setCreator(data);
      setFollowing(!!data?.is_following);
    } catch {
      setCreator(null);
    } finally {
      setLoading(false);
    }
  }, [creatorId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onFollow = async () => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    setBusy(true);
    try {
      const res = await creatorApi.toggleFollow(creatorId);
      setFollowing(!!res?.following);
      if (res?.following) {
        navigation.navigate('FollowSuccess', { creatorName: creator?.display_name });
      }
    } catch (e) {
      Alert.alert('Follow', e?.message || 'Could not update follow');
    } finally {
      setBusy(false);
    }
  };

  const name = creator?.display_name || creator?.channel_name || 'Creator';
  const handle = creator?.username ? `@${creator.username}` : '';
  const initials = name[0]?.toUpperCase() || 'C';
  const series = Array.isArray(creator?.series) ? creator.series : [];
  const canFollow = isAuthenticated && creator?.id !== myId;
  const bannerUri = resolveUrl(creator?.banner_url);
  const avatarUri = resolveUrl(creator?.avatar_url);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.gold} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.bannerWrap, { paddingTop: insets.top }]}>
        {bannerUri ? (
          <Image source={{ uri: bannerUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <LinearGradient colors={['#241a3a', '#0d0d24']} style={StyleSheet.absoluteFill} />
        )}
        <LinearGradient colors={['transparent', 'rgba(8,8,26,0.85)']} style={StyleSheet.absoluteFill} />
        <TouchableOpacity
          style={[styles.iconBtn, { top: insets.top + 8 }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconBtn, styles.iconRight, { top: insets.top + 8 }]}
          onPress={() => Share.share({ message: `${name} on WiamEpisio` }).catch(() => {})}
        >
          <Share2 size={15} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.avatar}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
        </View>

        <View style={styles.nameRow}>
          <Text style={styles.name}>{name}</Text>
          {creator?.verified ? (
            <View style={styles.verify}>
              <Check size={9} color={COLORS.navy} strokeWidth={3} />
            </View>
          ) : null}
        </View>

        {handle ? <Text style={styles.handle}>{handle}</Text> : null}
        {creator?.tagline ? <Text style={styles.tagline}>{creator.tagline}</Text> : null}
        {(creator?.city || creator?.country) ? (
          <Text style={styles.meta}>
            {[creator.city, creator.country].filter(Boolean).join(' · ')}
          </Text>
        ) : null}

        <View style={styles.stats}>
          <Stat n={creator?.follower_count ?? '—'} label="Followers" />
          <Stat n={creator?.series_count ?? series.length} label="Series" />
          <Stat n={creator?.total_views ?? '—'} label="Total Views" />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.followBtn} onPress={onFollow} disabled={busy || !canFollow}>
            {busy ? (
              <ActivityIndicator color={COLORS.navy} />
            ) : (
              <Text style={styles.followText}>{following ? 'Following' : '+ Follow'}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => navigation.navigate('ShareSheet', {
              title: name,
              url: `https://episio.wiamlabs.com/creator/${creatorId}`,
            })}
          >
            <Text style={styles.shareText}>Share</Text>
          </TouchableOpacity>
        </View>

        {creator?.bio ? (
          <Text style={styles.bio}>{creator.bio}</Text>
        ) : (
          <Text style={styles.bio}>Storyteller on WiamEpisio.</Text>
        )}

        <Text style={styles.section}>Series ({series.length})</Text>
        <View style={styles.grid}>
          {series.map((s, i) => {
            const cover = resolveUrl(s.cover_url || s.poster_url);
            const badge = s.badge
              || (s.status === 'live' || s.status === 'published' ? 'LIVE' : null)
              || (s.status === 'review' || s.pipeline_state === 'review' ? 'REVIEW' : null);
            return (
              <TouchableOpacity
                key={String(s.id || i)}
                style={styles.posterWrap}
                onPress={() => s.id && navigation.navigate('SeriesDetail', { seriesId: s.id })}
              >
                {cover ? (
                  <Image source={{ uri: cover }} style={styles.posterImg} />
                ) : (
                  <LinearGradient colors={['#3a1420', '#12122a']} style={styles.poster} />
                )}
                {badge ? <Text style={styles.badge}>{String(badge).toUpperCase()}</Text> : null}
                <Text style={styles.posterTitle} numberOfLines={2}>{s.title}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

function Stat({ n, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statN}>{n}</Text>
      <Text style={styles.statL}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  center: { flex: 1, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center' },
  bannerWrap: { height: 168, position: 'relative', overflow: 'hidden', zIndex: 1 },
  iconBtn: {
    position: 'absolute', left: 16, width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', zIndex: 2,
  },
  iconRight: { left: undefined, right: 16 },
  backArrow: { color: '#fff', fontSize: 22, marginTop: -2 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 4, zIndex: 2 },
  avatar: {
    width: 76, height: 76, borderRadius: 20, marginTop: -32, borderWidth: 4, borderColor: COLORS.navy,
    backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    zIndex: 3, elevation: 4,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { fontFamily: FONTS.extraBold, fontSize: 30, color: COLORS.navy },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10 },
  name: { fontFamily: FONTS.extraBold, fontSize: 18, color: '#fff' },
  verify: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  handle: { fontFamily: FONTS.regular, fontSize: 11.5, color: COLORS.textFaint, marginTop: 2 },
  tagline: { fontFamily: FONTS.medium, fontSize: 12.5, color: COLORS.gold, marginTop: 6 },
  meta: { fontFamily: FONTS.regular, fontSize: 11.5, color: COLORS.textDim, marginTop: 6, marginBottom: 4 },
  stats: { flexDirection: 'row', gap: 22, marginTop: 12, marginBottom: 14 },
  stat: {},
  statN: { fontFamily: FONTS.extraBold, fontSize: 15, color: '#fff' },
  statL: { fontFamily: FONTS.regular, fontSize: 10.5, color: COLORS.textDim },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  followBtn: {
    flex: 1, padding: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.gold, alignItems: 'center',
  },
  followText: { fontFamily: FONTS.extraBold, fontSize: 13, color: COLORS.navy },
  shareBtn: {
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: RADIUS.md,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  shareText: { fontFamily: FONTS.bold, fontSize: 13, color: '#C9C9DE' },
  bio: { fontFamily: FONTS.regular, fontSize: 12, color: '#C9C9DE', lineHeight: 19, marginBottom: 16 },
  section: { fontFamily: FONTS.bold, fontSize: 12.5, color: COLORS.gold, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  posterWrap: { width: '31%' },
  poster: { aspectRatio: 2 / 3, borderRadius: RADIUS.md },
  posterImg: { width: '100%', aspectRatio: 2 / 3, borderRadius: RADIUS.md },
  badge: {
    position: 'absolute', top: 6, left: 6, fontSize: 8, fontFamily: FONTS.extraBold, color: COLORS.navy,
    backgroundColor: COLORS.gold, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden',
  },
  posterTitle: { fontFamily: FONTS.semi, fontSize: 10.5, color: '#fff', marginTop: 6 },
});

export default CreatorPublicProfileScreen;
