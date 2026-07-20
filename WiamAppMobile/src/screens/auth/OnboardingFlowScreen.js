import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, Compass, Heart, Check } from 'lucide-react-native';
import apiClient from '../../api/client';
import authApi from '../../api/auth';
import walletApi from '../../api/wallet';
import useAuthStore from '../../store/useAuthStore';
import BrandToast from '../../components/common/BrandToast';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';

const TOTAL_STEPS = 4;

const STYLE_OPTIONS = [
  { key: 'short_reads', label: 'Daily short reads', body: 'A quick chapter on the go.' },
  { key: 'binge', label: 'Long binge sessions', body: 'When you cannot put it down.' },
  { key: 'top_rated', label: 'Top-rated picks', body: 'Show me what readers love.' },
  { key: 'discoveries', label: 'Hidden gems', body: 'Surface new creators for me.' },
];

const OnboardingFlowScreen = () => {
  const [step, setStep] = useState(1);
  const [loadingGenres, setLoadingGenres] = useState(false);
  const [saving, setSaving] = useState(false);
  const [genres, setGenres] = useState([]);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedStyles, setSelectedStyles] = useState([]);
  const [toast, setToast] = useState('');
  const patchUser = useAuthStore((s) => s.patchUser);
  const queuePostOnboarding = useAuthStore((s) => s.queuePostOnboarding);

  const progress = useMemo(
    () => Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1),
    [],
  );

  const loadGenres = async () => {
    setLoadingGenres(true);
    try {
      const res = await apiClient.get('/genres');
      setGenres(res.data?.genres || []);
    } catch (_) {
      setGenres([]);
    } finally {
      setLoadingGenres(false);
    }
  };

  const goNext = async () => {
    if (step === 2) {
      await loadGenres();
    }
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const finishOnboarding = async () => {
    if (selectedGenres.length < 3) {
      setToast('Pick at least three genres so we can start your Home well.');
      return;
    }
    setSaving(true);
    let welcomeCoins = 0;
    try {
      await apiClient.post('/genres/preferences', { genre_ids: selectedGenres });
      try {
        const reward = await walletApi.claimWelcomeReward();
        if (reward?.ok) welcomeCoins = Number(reward?.coins || 0);
      } catch (_) {
        welcomeCoins = 0;
      }

      const fresh = await authApi.me();
      const freshUser = fresh?.user || fresh;
      const merged =
        typeof freshUser === 'object' && freshUser
          ? { ...freshUser, onboarding_completed: true }
          : { onboarding_completed: true };
      await patchUser(merged);
      queuePostOnboarding(welcomeCoins);
    } catch (e) {
      setToast(typeof e === 'string' ? e : 'Could not finish onboarding. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleGenre = (id) => {
    setSelectedGenres((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  };
  const toggleStyle = (key) => {
    setSelectedStyles((prev) =>
      prev.includes(key) ? prev.filter((g) => g !== key) : [...prev, key],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient
        colors={[
          'rgba(212, 168, 67, 0.16)',
          'rgba(114, 47, 55, 0.12)',
          COLORS.background,
        ]}
        style={styles.glow}
        pointerEvents="none"
      />

      <View style={styles.topRow}>
        <View style={styles.stepDots}>
          {progress.map((p) => (
            <View
              key={p}
              style={[
                styles.dot,
                p === step ? styles.dotActive : null,
                p < step ? styles.dotDone : null,
              ]}
            />
          ))}
        </View>
        <Text style={styles.stepLabel}>
          Step {step} of {TOTAL_STEPS}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {step === 1 ? (
          <View>
            <View style={styles.iconWrap}>
              <Sparkles size={42} color={COLORS.secondary} strokeWidth={2.2} />
            </View>
            <Text style={styles.eyebrow}>Welcome to WiamApp</Text>
            <Text style={styles.title}>Let us tune your home for you</Text>
            <Text style={styles.subtitle}>
              A few quick questions and your library will feel like it has known you for years.
            </Text>
          </View>
        ) : null}

        {step === 2 ? (
          <View>
            <View style={styles.iconWrap}>
              <Compass size={36} color={COLORS.secondary} strokeWidth={2.2} />
            </View>
            <Text style={styles.eyebrow}>Your reading style</Text>
            <Text style={styles.title}>How do you like to read?</Text>
            <Text style={styles.subtitle}>
              Pick anything that feels true. We will tune the pace of your home around it.
            </Text>
            <View style={styles.optionList}>
              {STYLE_OPTIONS.map((o) => {
                const selected = selectedStyles.includes(o.key);
                return (
                  <TouchableOpacity
                    key={o.key}
                    style={[styles.optionRow, selected && styles.optionRowActive]}
                    onPress={() => toggleStyle(o.key)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.optionTick, selected && styles.optionTickActive]}>
                      {selected ? <Check size={14} color={COLORS.black} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionLabel}>{o.label}</Text>
                      <Text style={styles.optionBody}>{o.body}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <View>
            <View style={styles.iconWrap}>
              <Heart size={36} color={COLORS.secondary} strokeWidth={2.2} />
            </View>
            <Text style={styles.eyebrow}>Your taste</Text>
            <Text style={styles.title}>Pick the genres you love</Text>
            <Text style={styles.subtitle}>
              Choose at least three. The more we know, the better your home will read.
            </Text>
            {loadingGenres ? (
              <ActivityIndicator color={COLORS.secondary} style={{ marginVertical: 14 }} />
            ) : null}
            <View style={styles.genreWrap}>
              {genres.map((g) => {
                const selected = selectedGenres.includes(g.id);
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.genreChip, selected && styles.genreChipActive]}
                    onPress={() => toggleGenre(g.id)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[styles.genreChipText, selected && styles.genreChipTextActive]}
                    >
                      {g.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.hint}>
              Selected {selectedGenres.length} of 3 minimum
            </Text>
          </View>
        ) : null}

        {step === 4 ? (
          <View>
            <View style={styles.iconWrap}>
              <Check size={42} color={COLORS.secondary} strokeWidth={2.4} />
            </View>
            <Text style={styles.eyebrow}>You are set</Text>
            <Text style={styles.title}>Your home is ready</Text>
            <Text style={styles.subtitle}>
              We have lined up stories worth your evening. A small welcome gift is on the way.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {step > 1 ? (
          <TouchableOpacity
            onPress={() => setStep((s) => Math.max(1, s - 1))}
            hitSlop={10}
            style={styles.backBtn}
          >
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 64 }} />
        )}
        <TouchableOpacity
          style={[
            styles.primaryBtn,
            (step === 3 && selectedGenres.length < 3) || saving
              ? styles.primaryBtnDisabled
              : null,
          ]}
          onPress={step === TOTAL_STEPS ? finishOnboarding : goNext}
          disabled={(step === 3 && selectedGenres.length < 3) || saving}
          activeOpacity={0.9}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.black} />
          ) : (
            <Text style={styles.primaryBtnText}>
              {step === 1
                ? 'Start'
                : step === TOTAL_STEPS
                  ? 'Open my home'
                  : 'Continue'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
      <BrandToast message={toast} onClear={() => setToast('')} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 360,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  stepDots: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 22,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  dotActive: { backgroundColor: COLORS.secondary, width: 28 },
  dotDone: { backgroundColor: 'rgba(212,168,67,0.5)' },
  stepLabel: { color: COLORS.textMuted, fontSize: 12 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  iconWrap: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(212, 168, 67, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 168, 67, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  eyebrow: {
    color: COLORS.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  title: {
    color: COLORS.text,
    fontFamily: FONTS.display,
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.sm,
  },
  optionList: { gap: SPACING.sm },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  optionRowActive: {
    borderColor: 'rgba(212, 168, 67, 0.5)',
    backgroundColor: 'rgba(212, 168, 67, 0.08)',
  },
  optionTick: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTickActive: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  optionLabel: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 14,
  },
  optionBody: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  genreWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  genreChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  genreChipActive: {
    borderColor: COLORS.secondary,
    backgroundColor: 'rgba(212,168,67,0.16)',
  },
  genreChipText: { color: COLORS.textSecondary, fontSize: 13 },
  genreChipTextActive: { color: COLORS.secondary, fontWeight: '700' },
  hint: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    paddingTop: SPACING.sm,
    gap: SPACING.md,
  },
  backBtn: { paddingVertical: 10, paddingRight: 8 },
  backText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '600' },
  primaryBtn: {
    flex: 1,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.secondary,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.55,
  },
  primaryBtnText: { color: COLORS.black, fontWeight: '700', fontSize: 15 },
});

export default OnboardingFlowScreen;
