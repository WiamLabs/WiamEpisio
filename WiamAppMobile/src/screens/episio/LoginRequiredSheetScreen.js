/**
 * WiamEpisio-Login-Required-Sheet.html — bottom sheet gate for guest actions.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Bookmark, Heart, HelpCircle } from 'lucide-react-native';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';

const PERKS = [
  { key: 'save', label: 'Save Series', Icon: Bookmark },
  { key: 'follow', label: 'Follow Creators', Icon: Heart },
  { key: 'coins', label: 'Free Coins', Icon: HelpCircle },
];

const LoginRequiredSheetScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  const title = route.params?.title || 'Sign in to continue';
  const message = route.params?.message
    || 'Following creators, saving to My List, and unlocking episodes needs a free account.';
  const returnTo = route.params?.returnTo;
  const returnParams = route.params?.returnParams || {};

  const keepBrowsing = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.root}>
      <Pressable style={styles.backdrop} onPress={keepBrowsing} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 34) }]}>
        <View style={styles.handle} />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>W</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{message}</Text>

        <View style={styles.perkRow}>
          {PERKS.map(({ key, label, Icon }) => (
            <View key={key} style={styles.perk}>
              <View style={styles.perkIcon}>
                <Icon size={17} color={COLORS.gold} />
              </View>
              <Text style={styles.perkLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <EpisioGoldButton
          label="Sign Up Free"
          onPress={() => navigation.navigate('AuthRegister', { returnTo, returnParams })}
          style={styles.primary}
        />
        <EpisioGoldButton
          variant="ghost"
          label="I already have an account"
          onPress={() => navigation.navigate('Login', { returnTo, returnParams })}
          style={styles.ghost}
        />
        <TouchableOpacity onPress={keepBrowsing} hitSlop={12}>
          <Text style={styles.guest}>Keep browsing as guest</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: COLORS.navySoft,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 99,
    backgroundColor: COLORS.navyLine,
    marginBottom: 22,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  badgeText: {
    fontFamily: FONTS.extraBold,
    fontSize: 28,
    color: COLORS.navy,
  },
  title: {
    fontFamily: FONTS.extraBold,
    fontSize: 17,
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  sub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textDim,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 22,
  },
  perkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 24,
  },
  perk: {
    alignItems: 'center',
    width: 88,
  },
  perkIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  perkLabel: {
    fontFamily: FONTS.semi,
    fontSize: 9.5,
    color: COLORS.textFaint,
    textAlign: 'center',
  },
  primary: {
    width: '100%',
    marginBottom: 10,
  },
  ghost: {
    width: '100%',
    marginBottom: 14,
  },
  guest: {
    fontFamily: FONTS.semi,
    fontSize: 11.5,
    color: COLORS.textFaint,
  },
});

export default LoginRequiredSheetScreen;
