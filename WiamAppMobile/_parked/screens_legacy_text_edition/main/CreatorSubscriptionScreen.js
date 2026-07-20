/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { COLORS, SPACING, RADIUS, FONTS } from '../../constants/theme';
import AppBackground from '../../components/AppBackground';
import apiClient from '../../api/client';
import { ChevronLeft, Crown, Check, Users, Clock, MessageSquare, BadgeCheck, Sparkles, Ban } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const PERK_ICONS = {
  subscriber_posts: { icon: MessageSquare, label: 'Exclusive Posts' },
  early_access_hours: { icon: Clock, label: 'Early Access' },
  badge: { icon: BadgeCheck, label: 'Subscriber Badge' },
  author_notes: { icon: Sparkles, label: "Author's Notes" },
  no_ads: { icon: Ban, label: 'Ad-Free Reading' },
  priority_comments: { icon: Crown, label: 'Priority Comments' },
};

const CreatorSubscriptionScreen = ({ navigation, route }) => {
  const { creatorId, creatorName, creatorAvatar } = route.params || {};
  const [tiers, setTiers] = useState([]);
  const [creator, setCreator] = useState({ name: creatorName, avatar: creatorAvatar });
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState(null);

  useEffect(() => {
    fetchTiers();
  }, []);

  const fetchTiers = async () => {
    try {
      const res = await apiClient.get(`/creator/${creatorId}/tiers`);
      const data = res.data;
      setTiers(data.tiers || []);
      setSubscriberCount(data.subscriber_count || 0);
      if (data.creator) {
        setCreator(data.creator);
      }
    } catch (err) {
      console.warn('Fetch tiers error:', err?.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = (tier) => {
    Alert.alert(
      `Subscribe to ${tier.name}`,
      `GH₵ ${tier.price_ghs?.toFixed(2)} / ${tier.billing_period || 'month'}\n\nPayment integration coming soon.`,
      [{ text: 'OK' }]
    );
  };

  const renderPerk = (key, value) => {
    if (!value) return null;
    const perkInfo = PERK_ICONS[key];
    if (!perkInfo) return null;
    const Icon = perkInfo.icon;
    let label = perkInfo.label;
    if (key === 'early_access_hours' && typeof value === 'number' && value > 0) {
      label = `${value}h Early Access`;
    }
    return (
      <View key={key} style={styles.perkRow}>
        <View style={styles.perkIcon}>
          <Check size={14} color={COLORS.success} />
        </View>
        <Icon size={15} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
        <Text style={styles.perkText}>{label}</Text>
      </View>
    );
  };

  const renderTier = (tier, index) => {
    const isSelected = selectedTier === tier.id;
    const tierColors = [
      ['rgba(212, 168, 67, 0.10)', 'rgba(212, 168, 67, 0.02)'],
      ['rgba(114, 47, 55, 0.12)', 'rgba(114, 47, 55, 0.02)'],
      ['rgba(100, 100, 255, 0.10)', 'rgba(100, 100, 255, 0.02)'],
    ];
    const colors = tierColors[index % tierColors.length];

    return (
      <TouchableOpacity
        key={tier.id}
        style={[styles.tierCard, isSelected && styles.tierCardSelected]}
        activeOpacity={0.85}
        onPress={() => setSelectedTier(isSelected ? null : tier.id)}
      >
        <LinearGradient colors={colors} style={styles.tierGradient}>
          <View style={styles.tierHeader}>
            <Text style={styles.tierName}>{tier.name}</Text>
            <View style={styles.tierPriceWrap}>
              <Text style={styles.tierPrice}>GH₵ {tier.price_ghs?.toFixed(2)}</Text>
              <Text style={styles.tierPeriod}>/{tier.billing_period || 'mo'}</Text>
            </View>
          </View>

          {tier.yearly_price_ghs && (
            <View style={styles.yearlyBadge}>
              <Text style={styles.yearlyText}>
                or GH₵ {tier.yearly_price_ghs.toFixed(2)}/year (save ~17%)
              </Text>
            </View>
          )}

          {tier.description ? (
            <Text style={styles.tierDesc}>{tier.description}</Text>
          ) : null}

          <View style={styles.perksContainer}>
            {tier.perks && Object.entries(tier.perks).map(([k, v]) => renderPerk(k, v))}
          </View>

          {tier.subscriber_count > 0 && (
            <View style={styles.subCountRow}>
              <Users size={13} color={COLORS.textMuted} />
              <Text style={styles.subCountText}>{tier.subscriber_count} subscribers</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.subscribeBtn}
            onPress={() => handleSubscribe(tier)}
          >
            <Text style={styles.subscribeBtnText}>Subscribe</Text>
          </TouchableOpacity>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <AppBackground>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Creator Tiers</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Creator Info */}
        <View style={styles.creatorSection}>
          {creator.avatar ? (
            <Image source={{ uri: creator.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarLetter}>
                {(creator.name || '?')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.creatorName}>{creator.name || 'Creator'}</Text>
          <View style={styles.creatorMeta}>
            <Users size={14} color={COLORS.textMuted} />
            <Text style={styles.creatorMetaText}>{subscriberCount} subscribers</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.secondary} style={{ marginTop: 40 }} />
        ) : tiers.length === 0 ? (
          <View style={styles.emptyState}>
            <Crown size={56} color={COLORS.textMuted} strokeWidth={1} />
            <Text style={styles.emptyTitle}>No Subscription Tiers</Text>
            <Text style={styles.emptySubtitle}>
              This creator hasn't set up subscription tiers yet.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Choose a Tier</Text>
            {tiers.map((tier, i) => renderTier(tier, i))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingTop: 50, paddingBottom: SPACING.sm,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  container: { flex: 1 },
  content: { paddingHorizontal: SPACING.lg },

  creatorSection: { alignItems: 'center', paddingVertical: SPACING.lg },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.secondary,
  },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 28, fontWeight: '700', color: COLORS.secondary },
  creatorName: {
    fontSize: 20, fontWeight: '700', color: COLORS.text,
    fontFamily: FONTS.display, marginTop: SPACING.sm,
  },
  creatorMeta: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.xs,
  },
  creatorMetaText: { fontSize: 13, color: COLORS.textMuted },

  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md,
  },

  tierCard: {
    marginBottom: SPACING.md, borderRadius: RADIUS.lg,
    overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border,
  },
  tierCardSelected: { borderColor: COLORS.secondary },
  tierGradient: { padding: SPACING.md },
  tierHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  tierName: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  tierPriceWrap: { flexDirection: 'row', alignItems: 'baseline' },
  tierPrice: { fontSize: 20, fontWeight: '700', color: COLORS.secondary },
  tierPeriod: { fontSize: 13, color: COLORS.textMuted, marginLeft: 2 },
  yearlyBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.12)', borderRadius: RADIUS.sm,
    paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginTop: SPACING.sm,
  },
  yearlyText: { fontSize: 11, color: COLORS.success, fontWeight: '600' },
  tierDesc: {
    fontSize: 13, color: COLORS.textSecondary, marginTop: SPACING.sm, lineHeight: 18,
  },
  perksContainer: { marginTop: SPACING.md, gap: 8 },
  perkRow: { flexDirection: 'row', alignItems: 'center' },
  perkIcon: { marginRight: 8 },
  perkText: { fontSize: 13, color: COLORS.text },
  subCountRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.md,
  },
  subCountText: { fontSize: 12, color: COLORS.textMuted },
  subscribeBtn: {
    marginTop: SPACING.md, backgroundColor: COLORS.primary,
    paddingVertical: 12, borderRadius: RADIUS.md, alignItems: 'center',
  },
  subscribeBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },

  emptyState: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xxl,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginTop: SPACING.md },
  emptySubtitle: {
    fontSize: 13, color: COLORS.textMuted, textAlign: 'center',
    marginTop: SPACING.xs, paddingHorizontal: SPACING.xl, lineHeight: 18,
  },
});

export default CreatorSubscriptionScreen;
