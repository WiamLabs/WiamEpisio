/**
 * StudioTabScreen — Bottom tab entry for Studio.
 * Shows StudioDashboard for creators, or "Apply to Create" CTA for readers.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import useAuthStore from '../../store/useAuthStore';
import {
  PenTool,
  BookOpen,
  Sparkles,
  TrendingUp,
  Users,
  ChevronRight,
} from 'lucide-react-native';

const PERKS = [
  { icon: BookOpen, label: 'Publish Stories', desc: 'Write and publish your own stories for millions of readers' },
  { icon: TrendingUp, label: 'Earn Revenue', desc: 'Monetize your chapters with Wiam Coins and earn real income' },
  { icon: Users, label: 'Build an Audience', desc: 'Grow your fanbase with built-in discovery and promotion tools' },
  { icon: Sparkles, label: 'Creator Tools', desc: 'Native rich text editor, analytics dashboard, and story manager' },
];

const StudioTabScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const isCreator = !!(user?.is_creator || user?.is_founder);

  // Creators go straight to their Studio dashboard
  if (isCreator) {
    // Navigate to the full Studio screen in the drawer
    React.useEffect(() => {
      const unsubscribe = navigation.addListener('tabPress', (e) => {
        e.preventDefault();
        navigation.getParent()?.navigate('Studio');
      });
      return unsubscribe;
    }, [navigation]);

    // Also navigate immediately when rendered as active tab
    React.useEffect(() => {
      const timer = setTimeout(() => {
        navigation.getParent()?.navigate('Studio');
      }, 50);
      return () => clearTimeout(timer);
    }, [navigation]);

    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingWrap}>
          <PenTool size={32} color={COLORS.secondary} />
          <Text style={styles.loadingText}>Opening Studio...</Text>
        </View>
      </View>
    );
  }

  // Non-creators see Apply to Create
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <PenTool size={36} color={COLORS.secondary} />
          </View>
          <Text style={styles.heroTitle}>Become a WiamApp Creator</Text>
          <Text style={styles.heroSub}>
            Share your stories with millions of readers worldwide and earn revenue from your creative work.
          </Text>
        </View>

        {/* Perks */}
        <View style={styles.perksSection}>
          {PERKS.map((perk, i) => {
            const Icon = perk.icon;
            return (
              <View key={i} style={styles.perkCard}>
                <View style={styles.perkIconWrap}>
                  <Icon size={20} color={COLORS.secondary} />
                </View>
                <View style={styles.perkInfo}>
                  <Text style={styles.perkLabel}>{perk.label}</Text>
                  <Text style={styles.perkDesc}>{perk.desc}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={styles.applyBtn}
          onPress={() => navigation.navigate('Apply')}
          activeOpacity={0.8}
        >
          <Text style={styles.applyBtnText}>Apply to Create</Text>
          <ChevronRight size={18} color="#000" />
        </TouchableOpacity>

        <Text style={styles.footnote}>
          Applications are reviewed within 24-48 hours. You'll need at least a display name and bio to apply.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    padding: SPACING.lg,
    paddingBottom: 40,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  hero: {
    alignItems: 'center',
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(212,168,67,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  heroSub: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: SPACING.md,
  },
  perksSection: {
    marginTop: SPACING.lg,
    gap: 12,
  },
  perkCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: SPACING.md,
    gap: 12,
  },
  perkIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(212,168,67,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkInfo: {
    flex: 1,
  },
  perkLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 3,
  },
  perkDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    marginTop: SPACING.xl,
    gap: 6,
  },
  applyBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  footnote: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.md,
    lineHeight: 18,
  },
});

export default StudioTabScreen;
