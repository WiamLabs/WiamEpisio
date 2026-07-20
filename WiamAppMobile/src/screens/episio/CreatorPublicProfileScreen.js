/**
 * WiamEpisio-Creator-Public-Profile.html
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Share, ScrollView,
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Share2 } from 'lucide-react-native';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';
import apiClient from '../../api/client';
import creatorApi from '../../api/creator';
import useAuthStore from '../../store/useAuthStore';

const PLACEHOLDER_SERIES = [
  { id: '1', title: 'Love Delayed', badge: 'LIVE', views: '412K' },
  { id: '2', title: "The Chief's Daughter", badge: 'REVIEW' },
  { id: '3', title: 'Accra Nights', badge: 'LIVE', views: '1.2M' },
];

const CreatorPublicProfileScreen = () => {
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

  const name = creator?.display_name || 'Creator';
  const handle = creator?.username ? `@${creator.username}` : '';
  const initials = name[0]?.toUpperCase() || 'C';
  const series = creator?.series?.length ? creator.series : PLACEHOLDER_SERIES;
  const canFollow = isAuthenticated && creator?.id !== myId;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.gold} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#241a3a', '#0d0d24']} style={styles.banner}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconBtn, styles.iconRight]}
          onPress={() => Share.share({ message: `${name} on WiamEpisio` }).catch(() => {})}
        >
          <Share2 size={15} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{name}</Text>
          {creator?.verified ? (
            <View style={styles.verify}><Check size={9} color={COLORS.navy} strokeWidth={3} /></View>
          ) : null}
        </View>
        {handle ? <Text style={styles.handle}>{handle}</Text> : null}

        <View style={styles.stats}>
          <Stat n={creator?.follower_count ?? '18.2K'} label="Followers" />
          <Stat n={creator?.series_count ?? series.length} label="Series" />
          <Stat n={creator?.total_views ?? '4.9M'} label="Total Views" />
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
            onPress={() => navigation.navigate('ShareSheet', { title: name, url: `https://wiamapp.com/creator/${creatorId}` })}
          >
            <Text style={styles.shareText}>Share</Text>
          </TouchableOpacity>
        </View>

        {creator?.bio ? <Text style={styles.bio}>{creator.bio}</Text> : (
          <Text style={styles.bio}>Storyteller on WiamEpisio — bold African drama and unforgettable characters.</Text>
        )}

        <Text style={styles.section}>Series ({series.length})</Text>
        <View style={styles.grid}>
          {series.map((s, i) => (
            <TouchableOpacity
              key={String(s.id || i)}
              style={styles.posterWrap}
              onPress={() => s.id && navigation.navigate('SeriesDetail', { seriesId: s.id })}
            >
              <LinearGradient colors={['#3a1420', '#12122a']} style={styles.poster}>
                {s.badge ? <Text style={styles.badge}>{s.badge}</Text> : null}
                {s.views ? <Text style={styles.views}>{s.views}</Text> : null}
              </LinearGradient>
              <Text style={styles.posterTitle} numberOfLines={2}>{s.title}</Text>
            </TouchableOpacity>
          ))}
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
  banner: { height: 118, position: 'relative' },
  iconBtn: {
    position: 'absolute', top: 48, left: 16, width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  iconRight: { left: undefined, right: 16 },
  backArrow: { color: '#fff', fontSize: 22, marginTop: -2 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  avatar: {
    width: 76, height: 76, borderRadius: 20, marginTop: -38, borderWidth: 4, borderColor: COLORS.navy,
    backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: FONTS.extraBold, fontSize: 30, color: COLORS.navy },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10 },
  name: { fontFamily: FONTS.extraBold, fontSize: 18, color: '#fff' },
  verify: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  handle: { fontFamily: FONTS.regular, fontSize: 11.5, color: COLORS.textFaint, marginTop: 2 },
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
  poster: { aspectRatio: 2 / 3, borderRadius: RADIUS.md, overflow: 'hidden', justifyContent: 'space-between', padding: 6 },
  badge: {
    alignSelf: 'flex-start', fontSize: 8, fontFamily: FONTS.extraBold, color: COLORS.navy,
    backgroundColor: COLORS.gold, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  views: {
    alignSelf: 'flex-end', fontSize: 8, color: '#fff', backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 999,
  },
  posterTitle: { fontFamily: FONTS.semi, fontSize: 10.5, color: '#fff', marginTop: 6 },
});

export default CreatorPublicProfileScreen;
