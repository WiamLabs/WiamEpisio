/**
 * WiamEpisio-Toast-Success.html — success toast over dim overlay.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Check, X } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';

const AUTO_DISMISS_MS = 2200;

const ToastSuccessScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const closed = useRef(false);

  const title = route.params?.title || 'Added to My List';
  const message = route.params?.message || route.params?.subtitle || '';

  const close = () => {
    if (closed.current) return;
    closed.current = true;
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  useEffect(() => {
    const timer = setTimeout(close, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.root}>
      <Pressable style={styles.dim} onPress={close} />
      <View style={[styles.toastWrap, { top: insets.top + 26 }]}>
        <View style={styles.toast}>
          <View style={styles.iconCircle}>
            <Check size={14} color={COLORS.navy} strokeWidth={3} />
          </View>
          <View style={styles.textCol}>
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
          </View>
          <TouchableOpacity onPress={close} hitSlop={10} accessibilityLabel="Close">
            <X size={13} color={COLORS.textFaint} />
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>Auto-closes in a moment · tap X to dismiss</Text>
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
    borderColor: 'rgba(59,178,115,0.35)',
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
    backgroundColor: '#3BB273',
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
  hint: {
    marginTop: 10,
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.textFaint,
    textAlign: 'center',
  },
});

export default ToastSuccessScreen;
