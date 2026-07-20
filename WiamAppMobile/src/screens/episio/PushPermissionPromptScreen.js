/**
 * Push permission prompt
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { Bell } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const PushPermissionPromptScreen = () => {
  const navigation = useNavigation();

  const enable = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        navigation.goBack();
      } else {
        Alert.alert(
          'Notifications',
          'Enable notifications in system Settings to get episode drops and coin alerts.',
          [
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
            { text: 'Later', onPress: () => navigation.goBack() },
          ],
        );
      }
    } catch {
      Alert.alert('Notifications', 'Could not request permission.');
      navigation.goBack();
    }
  };

  return (
    <EpisioScreenShell
      title="Stay in the loop"
      subtitle="Episode drops & rewards"
      footer={(
        <>
          <TouchableOpacity style={styles.cta} onPress={enable}>
            <Text style={styles.ctaText}>Enable notifications</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skip} onPress={() => navigation.goBack()}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </>
      )}
    >
      <View style={styles.center}>
        <Bell size={48} color={COLORS.gold} />
        <Text style={styles.body}>
          Get reminded when saved series update, daily rewards reset, and VIP offers go live.
        </Text>
      </View>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: 'center', paddingTop: 32, gap: 16 },
  body: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textDim, textAlign: 'center', lineHeight: 21 },
  cta: { backgroundColor: COLORS.gold, borderRadius: RADIUS.md, padding: 15, alignItems: 'center' },
  ctaText: { fontFamily: FONTS.extraBold, fontSize: 14, color: COLORS.navy },
  skip: { padding: 12, alignItems: 'center' },
  skipText: { fontFamily: FONTS.semi, color: COLORS.textDim },
});

export default PushPermissionPromptScreen;
