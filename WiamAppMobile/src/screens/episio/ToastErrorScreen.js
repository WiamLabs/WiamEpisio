/**
 * WiamEpisio-Toast-Error.html — error toast with optional action.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { X } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';

const ToastErrorScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  const title = route.params?.title || 'Not enough coins';
  const message = route.params?.message
    || 'You need more coins to unlock this';
  const actionLabel = route.params?.actionLabel || 'Buy';
  const actionRoute = route.params?.actionRoute || 'BuyCoins';

  const close = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const onAction = () => {
    if (actionRoute === 'BuyCoins' || actionLabel.toLowerCase().includes('buy')) {
      navigation.replace('BuyCoins');
      return;
    }
    if (actionRoute && actionRoute !== 'goBack') {
      navigation.replace(actionRoute);
      return;
    }
    close();
  };

  return (
    <View style={styles.root}>
      <Pressable style={styles.dim} onPress={close} />
      <View style={[styles.toastWrap, { top: insets.top + 26 }]}>
        <View style={styles.toast}>
          <View style={styles.iconCircle}>
            <X size={14} color="#fff" strokeWidth={2.5} />
          </View>
          <View style={styles.textCol}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
          </View>
          {actionLabel ? (
            <TouchableOpacity onPress={onAction} hitSlop={8}>
              <Text style={styles.action}>{actionLabel}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={close} hitSlop={10} accessibilityLabel="Close">
              <X size={13} color={COLORS.textFaint} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.hint}>
          Stays until you dismiss or take action · support@wiamapp.com
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  toastWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(18,18,42,0.96)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: 'rgba(228,87,61,0.35)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E4573D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: '#fff',
  },
  message: {
    fontFamily: FONTS.regular,
    fontSize: 10.5,
    color: COLORS.textDim,
    marginTop: 2,
  },
  action: {
    fontFamily: FONTS.bold,
    fontSize: 10.5,
    color: COLORS.gold,
  },
  hint: {
    marginTop: 10,
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.textFaint,
    textAlign: 'center',
  },
});

export default ToastErrorScreen;
