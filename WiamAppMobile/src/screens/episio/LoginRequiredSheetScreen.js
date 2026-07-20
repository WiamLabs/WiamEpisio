/**
 * Login required sheet — modal gate
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogIn } from 'lucide-react-native';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const LoginRequiredSheetScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const message = route.params?.message || 'Sign in to continue';

  return (
    <View style={[styles.overlay, { paddingBottom: insets.bottom }]}>
      <TouchableOpacity style={styles.backdrop} onPress={() => navigation.goBack()} />
      <View style={styles.sheet}>
        <LogIn size={32} color={COLORS.gold} />
        <Text style={styles.title}>Sign in required</Text>
        <Text style={styles.sub}>{message}</Text>
        <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.ctaText}>Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skip} onPress={() => navigation.goBack()}>
          <Text style={styles.skipText}>Not now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: COLORS.navyCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, alignItems: 'center', borderWidth: 1, borderColor: COLORS.navyLine,
  },
  title: { fontFamily: FONTS.extraBold, fontSize: 20, color: COLORS.text, marginTop: 12 },
  sub: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textDim, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  cta: {
    alignSelf: 'stretch', marginTop: 24, backgroundColor: COLORS.gold, borderRadius: RADIUS.md,
    padding: 15, alignItems: 'center',
  },
  ctaText: { fontFamily: FONTS.extraBold, fontSize: 14, color: COLORS.navy },
  skip: { marginTop: 12, padding: 8 },
  skipText: { fontFamily: FONTS.semi, color: COLORS.textDim },
});

export default LoginRequiredSheetScreen;
