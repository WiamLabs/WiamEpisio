/**
 * WiamEpisio-Confirm-Dialog.html — centered modal confirm pattern.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AlertCircle } from 'lucide-react-native';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';

const ConfirmDialogScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {
    title = 'Remove from My List?',
    message = 'This item will be removed. You can always add it back later.',
    confirmLabel = 'Remove',
    cancelLabel = 'Cancel',
    next,
  } = route.params || {};

  const onCancel = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const onConfirm = () => {
    if (next) {
      if (typeof next === 'string') {
        navigation.navigate(next);
        return;
      }
      if (next?.screen) {
        navigation.navigate(next.screen, next.params);
        return;
      }
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Main');
  };

  return (
    <View style={styles.root}>
      <Pressable style={styles.veil} onPress={onCancel} />
      <View style={styles.modal}>
        <View style={styles.iconWrap}>
          <AlertCircle size={24} color={COLORS.gold} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{message}</Text>
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.85}>
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </TouchableOpacity>
          <View style={styles.confirmWrap}>
            <EpisioGoldButton
              label={confirmLabel}
              onPress={onConfirm}
              style={{ width: '100%' }}
            />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  veil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modal: {
    backgroundColor: COLORS.navySoft,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    borderRadius: 20,
    paddingTop: 24,
    paddingHorizontal: 22,
    paddingBottom: 20,
    alignItems: 'center',
  },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(212,160,23,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: FONTS.extraBold,
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  sub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textDim,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 22,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 13,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#C9C9DE',
  },
  confirmWrap: {
    flex: 1,
  },
});

export default ConfirmDialogScreen;
