/**
 * WiamEpisio-Block-Creator.html — sheet confirm with effect bullets.
 * No block API in src/api — goBack after confirm (block API pending).
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ban } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const EFFECTS = [
  'Their series disappear from your Home and Discover feeds',
  "You'll automatically unfollow them",
  'You can unblock anytime from Settings → Blocked Creators',
];

const BlockCreatorScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  const name = route.params?.creatorName
    || route.params?.name
    || route.params?.displayName
    || 'this creator';
  const followers = route.params?.followers
    || route.params?.followerCount
    || route.params?.followersLabel
    || null;
  const initial = (name && name !== 'this creator' ? name[0] : 'C').toUpperCase();

  const onBlock = async () => {
    setBusy(true);
    try {
      // Block creator API pending — no /creators/:id/block (or similar) in src/api yet.
      // When available, call it here with route.params?.creatorId before goBack.
      await new Promise((r) => setTimeout(r, 350));
    } finally {
      setBusy(false);
      if (navigation.canGoBack()) navigation.goBack();
    }
  };

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => navigation.goBack()} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={styles.handle} />

        <View style={styles.creatorRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.creatorName}>{name}</Text>
            {followers ? (
              <Text style={styles.followers}>
                {typeof followers === 'number' ? `${followers.toLocaleString()} followers` : String(followers)}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.warnIcon}>
          <Ban size={28} color={COLORS.error} />
        </View>
        <Text style={styles.title}>Block this creator?</Text>
        <Text style={styles.body}>
          You won't see content from {name} anywhere in the app, and they won't be notified.
        </Text>

        <View style={styles.bullets}>
          {EFFECTS.map((line) => (
            <View key={line} style={styles.bulletRow}>
              <View style={styles.dot} />
              <Text style={styles.bullet}>{line}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.danger}
          onPress={onBlock}
          disabled={busy}
          activeOpacity={0.9}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.dangerText}>Block Creator</Text>
          )}
        </TouchableOpacity>

        <EpisioGoldButton
          label="Cancel"
          variant="ghost"
          onPress={() => navigation.goBack()}
          style={{ marginTop: 10 }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: COLORS.navyCard,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 10,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.navyLine, marginBottom: 16,
  },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.navySoft,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.navyLine,
  },
  avatarText: { fontFamily: FONTS.extraBold, fontSize: 18, color: COLORS.gold },
  creatorName: { fontFamily: FONTS.extraBold, fontSize: 16, color: COLORS.text },
  followers: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textDim, marginTop: 2 },
  warnIcon: {
    alignSelf: 'center', width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(207,102,121,0.15)', alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontFamily: FONTS.extraBold, fontSize: 18, color: COLORS.text, textAlign: 'center', marginBottom: 8,
  },
  body: {
    fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textDim, textAlign: 'center',
    lineHeight: 20, marginBottom: 16,
  },
  bullets: { gap: 10, marginBottom: 22 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.error, marginTop: 6,
  },
  bullet: { flex: 1, fontFamily: FONTS.regular, fontSize: 13, color: COLORS.text, lineHeight: 19 },
  danger: {
    backgroundColor: COLORS.error, borderRadius: 16, paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  dangerText: { fontFamily: FONTS.extraBold, fontSize: 13, color: '#fff' },
});

export default BlockCreatorScreen;
