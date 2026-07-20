/**
 * WiamEpisio-Follow-Success.html — overlay toast + Following chip, auto-dismiss.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Check } from 'lucide-react-native';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const AUTO_MS = 2200;

const FollowSuccessScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const name = route.params?.name
    || route.params?.creatorName
    || route.params?.displayName
    || 'this creator';

  useEffect(() => {
    const t = setTimeout(() => {
      if (navigation.canGoBack()) navigation.goBack();
    }, AUTO_MS);
    return () => clearTimeout(t);
  }, [navigation]);

  return (
    <TouchableOpacity
      style={styles.overlay}
      activeOpacity={1}
      onPress={() => navigation.goBack()}
    >
      <View style={styles.toast}>
        <View style={styles.toastIcon}>
          <Check size={16} color="#fff" strokeWidth={3} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Now following {name}</Text>
          <Text style={styles.sub}>You'll see their new series first</Text>
        </View>
      </View>

      <View style={styles.demo}>
        <View style={styles.chip}>
          <Check size={14} color={COLORS.textDim} />
          <Text style={styles.chipText}>Following</Text>
        </View>
        <Text style={styles.hint}>Button flips instantly · toast confirms</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 20,
    paddingTop: 72,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.navyCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.success,
    padding: 14,
  },
  toastIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: FONTS.extraBold,
    fontSize: 14,
    color: COLORS.text,
  },
  sub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textDim,
    marginTop: 2,
  },
  demo: {
    marginTop: 40,
    alignItems: 'center',
    gap: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.navySoft,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    borderRadius: RADIUS.full,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  chipText: {
    fontFamily: FONTS.semi,
    fontSize: 13,
    color: COLORS.textDim,
  },
  hint: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textFaint,
  },
});

export default FollowSuccessScreen;
