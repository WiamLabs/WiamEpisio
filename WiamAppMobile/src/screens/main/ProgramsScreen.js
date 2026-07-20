import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import { ChevronLeft, Star, Trophy, Gem, Box, Flame, TrendingUp, Users, Coins, Clock } from 'lucide-react-native';
import apiClient from '../../api/client';
import FirstMissionCard from '../../components/rewards/FirstMissionCard';

const ICON_MAP = {
  star: Star, trophy: Trophy, gem: Gem, box: Box, flame: Flame,
  trending_up: TrendingUp, users: Users,
};
const COLOR_MAP = {
  elite: '#d4a843', apex: '#d4a843', premium: '#c084fc', magic_box: '#d4a843',
  challenges: '#fb923c', rising: '#60a5fa', ambassador: '#4ade80',
};
const SCREEN_MAP = {
  elite: 'PremiumScreen', premium: 'PremiumScreen',
};

const timeLeft = (iso) => {
  if (!iso) return '';
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  if (diff <= 0) return 'Ended';
  if (diff < 3600) return `${Math.ceil(diff / 60)}m left`;
  if (diff < 86400) return `${Math.ceil(diff / 3600)}h left`;
  return `${Math.ceil(diff / 86400)}d left`;
};

const ProgramsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [rising, setRising] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const res = await apiClient.get('/programs');
      setPrograms(res.data.programs || []);
      setChallenges(res.data.active_challenges || []);
      setRising(res.data.rising_creators || []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.secondary} />
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Programs</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.secondary} />}
      >
        <Text style={s.intro}>Explore WiamApp programs and earn rewards for reading and creating.</Text>

        <FirstMissionCard navigation={navigation} />

        {programs.map((p) => {
          const Icon = ICON_MAP[p.icon] || Star;
          const color = COLOR_MAP[p.key] || '#d4a843';
          const screen = SCREEN_MAP[p.key];
          return (
            <TouchableOpacity
              key={p.key}
              style={s.card}
              onPress={() => screen ? navigation.navigate(screen) : null}
              activeOpacity={screen ? 0.7 : 1}
            >
              <View style={[s.iconWrap, { backgroundColor: color + '18' }]}>
                <Icon size={24} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{p.title}</Text>
                <Text style={s.cardSub}>{p.description}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {challenges.length > 0 && (
          <View style={s.section}>
            <Text style={s.secTitle}>Active Challenges</Text>
            {challenges.map((c) => (
              <View key={c.id} style={s.challengeCard}>
                <View style={s.challengeTop}>
                  <View style={[s.typeBadge, { backgroundColor: c.type === 'monthly' ? 'rgba(167,139,250,0.15)' : 'rgba(251,146,60,0.15)' }]}>
                    <Text style={[s.typeText, { color: c.type === 'monthly' ? '#a78bfa' : '#fb923c' }]}>{(c.type || 'weekly').toUpperCase()}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} color={COLORS.textMuted} />
                    <Text style={s.timeLeft}>{timeLeft(c.ends_at)}</Text>
                  </View>
                </View>
                <Text style={s.challengeTitle}>{c.title}</Text>
                {!!c.description && <Text style={s.challengeDesc} numberOfLines={2}>{c.description}</Text>}
                <View style={s.challengeFooter}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Coins size={14} color={COLORS.secondary} />
                    <Text style={s.rewardText}>{c.coin_reward} coins</Text>
                  </View>
                  <Text style={s.entriesText}>{c.entries_count} entries</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {rising.length > 0 && (
          <View style={s.section}>
            <Text style={s.secTitle}>Rising Creators</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {rising.map((u) => (
                <TouchableOpacity key={u.id} style={s.risingCard} onPress={() => navigation.navigate('CreatorProfile', { creatorId: u.id })}>
                  {u.avatar_url
                    ? <Image source={{ uri: u.avatar_url }} style={s.risingAvatar} />
                    : <View style={[s.risingAvatar, s.risingAvatarPh]}><Text style={{ color: COLORS.secondary, fontWeight: '700' }}>{(u.display_name || 'U')[0]}</Text></View>
                  }
                  <Text style={s.risingName} numberOfLines={1}>{u.display_name}</Text>
                  <Text style={s.risingSub}>{u.story_count} {u.story_count === 1 ? 'story' : 'stories'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  intro: { fontSize: 13, color: COLORS.textMuted, marginBottom: 20, lineHeight: 19 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 12 },
  iconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  cardSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 4, lineHeight: 17 },
  section: { marginTop: 24 },
  secTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 },
  challengeCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 16, marginBottom: 12 },
  challengeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeText: { fontSize: 10, fontWeight: '700' },
  timeLeft: { fontSize: 11, color: COLORS.textMuted },
  challengeTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  challengeDesc: { fontSize: 12, color: COLORS.textMuted, lineHeight: 17, marginBottom: 8 },
  challengeFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rewardText: { fontSize: 12, fontWeight: '600', color: COLORS.secondary },
  entriesText: { fontSize: 11, color: COLORS.textMuted },
  risingCard: { width: 100, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 12 },
  risingAvatar: { width: 48, height: 48, borderRadius: 24, marginBottom: 8 },
  risingAvatarPh: { backgroundColor: 'rgba(212,168,67,0.1)', alignItems: 'center', justifyContent: 'center' },
  risingName: { fontSize: 12, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  risingSub: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
});

export default ProgramsScreen;
