/**
 * Device limit reached
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Smartphone } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const DeviceLimitScreen = () => {
  const navigation = useNavigation();

  return (
    <EpisioScreenShell title="Device limit" scroll={false}>
      <View style={styles.center}>
        <Smartphone size={48} color={COLORS.gold} />
        <Text style={styles.headline}>Too many devices</Text>
        <Text style={styles.sub}>
          Your account is signed in on the maximum number of devices. Sign out on another device or contact support@wiamapp.com.
        </Text>
        <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.ctaText}>Manage devices</Text>
        </TouchableOpacity>
      </View>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 14 },
  headline: { fontFamily: FONTS.extraBold, fontSize: 20, color: COLORS.text },
  sub: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textDim, textAlign: 'center', lineHeight: 21 },
  cta: { marginTop: 12, backgroundColor: COLORS.gold, borderRadius: RADIUS.md, paddingHorizontal: 24, paddingVertical: 12 },
  ctaText: { fontFamily: FONTS.bold, color: COLORS.navy },
});

export default DeviceLimitScreen;
