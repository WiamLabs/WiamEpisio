/**
 * Confirm dialog — params title, message, onConfirm callback via goBack
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const ConfirmDialogScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {
    title = 'Confirm',
    message = 'Are you sure?',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    destructive = false,
  } = route.params || {};

  const onConfirm = () => {
    if (route.params?.onConfirm) route.params.onConfirm();
    navigation.goBack();
  };

  return (
    <View style={[styles.overlay, { paddingBottom: insets.bottom }]}>
      <TouchableOpacity style={styles.backdrop} onPress={() => navigation.goBack()} />
      <View style={styles.sheet}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <TouchableOpacity
          style={[styles.confirm, destructive && styles.confirmDanger]}
          onPress={onConfirm}
        >
          <Text style={[styles.confirmText, destructive && styles.confirmTextLight]}>{confirmLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancel} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>{cancelLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(0,0,0,0.65)' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS.lg, padding: 22,
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  title: { fontFamily: FONTS.extraBold, fontSize: 18, color: COLORS.text, marginBottom: 8 },
  message: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textDim, lineHeight: 21, marginBottom: 20 },
  confirm: { backgroundColor: COLORS.gold, borderRadius: RADIUS.md, padding: 14, alignItems: 'center' },
  confirmDanger: { backgroundColor: COLORS.error },
  confirmText: { fontFamily: FONTS.extraBold, fontSize: 14, color: COLORS.navy },
  confirmTextLight: { color: '#fff' },
  cancel: { marginTop: 12, padding: 10, alignItems: 'center' },
  cancelText: { fontFamily: FONTS.semi, color: COLORS.textDim },
});

export default ConfirmDialogScreen;
