/**
 * Toast error demo — brief message + OK
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { AlertCircle } from 'lucide-react-native';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const ToastErrorScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const message = route.params?.message || 'Something went wrong';

  return (
    <View style={styles.overlay}>
      <View style={styles.toast}>
        <AlertCircle size={22} color={COLORS.error} />
        <Text style={styles.text}>{message}</Text>
        <TouchableOpacity style={styles.ok} onPress={() => navigation.goBack()}>
          <Text style={styles.okText}>OK</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  toast: {
    width: '100%', maxWidth: 320, backgroundColor: COLORS.navyCard, borderRadius: RADIUS.lg,
    padding: 20, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  text: { fontFamily: FONTS.semi, fontSize: 15, color: COLORS.text, textAlign: 'center' },
  ok: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: COLORS.navyLine, borderRadius: RADIUS.sm },
  okText: { fontFamily: FONTS.bold, color: COLORS.text, fontSize: 13 },
});

export default ToastErrorScreen;
