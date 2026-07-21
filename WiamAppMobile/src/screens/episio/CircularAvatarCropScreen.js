/**
 * Circular avatar crop with pinch zoom + pan.
 * Params: { uri, returnTo?, onDoneKey? } — result stored via route callback params.
 */
import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Image, Dimensions, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import * as ImageManipulator from 'expo-image-manipulator';
import { COLORS, FONTS } from '../../constants/theme';

const { width: W } = Dimensions.get('window');
const FRAME = Math.min(W - 48, 320);

const CircularAvatarCropScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const uri = route.params?.uri;
  const returnKey = route.params?.returnKey || 'croppedUri';
  const [busy, setBusy] = useState(false);
  const [imgSize, setImgSize] = useState({ w: FRAME, h: FRAME });

  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startTx = useSharedValue(0);
  const startTy = useSharedValue(0);
  const latest = useRef({ scale: 1, tx: 0, ty: 0 });

  React.useEffect(() => {
    if (!uri) return;
    Image.getSize(
      uri,
      (w, h) => setImgSize({ w, h }),
      () => setImgSize({ w: FRAME, h: FRAME }),
    );
  }, [uri]);

  const baseFit = useMemo(() => {
    const { w, h } = imgSize;
    if (!w || !h) return FRAME;
    return Math.max(FRAME / w, FRAME / h) * Math.max(w, h);
  }, [imgSize]);

  const displayW = useMemo(() => {
    const { w, h } = imgSize;
    if (!w || !h) return FRAME;
    const fit = Math.max(FRAME / w, FRAME / h);
    return w * fit;
  }, [imgSize]);

  const displayH = useMemo(() => {
    const { w, h } = imgSize;
    if (!w || !h) return FRAME;
    const fit = Math.max(FRAME / w, FRAME / h);
    return h * fit;
  }, [imgSize]);

  const pinch = Gesture.Pinch()
    .onBegin(() => { startScale.value = scale.value; })
    .onUpdate((e) => {
      const next = Math.min(4, Math.max(1, startScale.value * e.scale));
      scale.value = next;
      latest.current.scale = next;
    });

  const pan = Gesture.Pan()
    .onBegin(() => {
      startTx.value = tx.value;
      startTy.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = startTx.value + e.translationX;
      ty.value = startTy.value + e.translationY;
      latest.current.tx = tx.value;
      latest.current.ty = ty.value;
    });

  const composed = Gesture.Simultaneous(pinch, pan);
  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  const cancel = () => {
    if (navigation.canGoBack()) navigation.goBack();
  };

  const apply = async () => {
    if (!uri) return;
    setBusy(true);
    try {
      const { scale: s, tx: ox, ty: oy } = latest.current;
      const { w: iw, h: ih } = imgSize;
      const fit = Math.max(FRAME / iw, FRAME / ih);
      const shownW = iw * fit * s;
      const shownH = ih * fit * s;
      // Center of crop circle in image display coords
      const centerX = shownW / 2 - ox;
      const centerY = shownH / 2 - oy;
      const cropSideDisplay = FRAME;
      const leftDisplay = centerX - cropSideDisplay / 2;
      const topDisplay = centerY - cropSideDisplay / 2;
      const scaleToOrig = 1 / (fit * s);
      let originX = Math.round(leftDisplay * scaleToOrig);
      let originY = Math.round(topDisplay * scaleToOrig);
      let width = Math.round(cropSideDisplay * scaleToOrig);
      let height = width;
      originX = Math.max(0, Math.min(iw - 2, originX));
      originY = Math.max(0, Math.min(ih - 2, originY));
      width = Math.max(64, Math.min(width, iw - originX));
      height = Math.max(64, Math.min(height, ih - originY));
      const side = Math.min(width, height);
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ crop: { originX, originY, width: side, height: side } }, { resize: { width: 720 } }],
        { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG },
      );
      navigation.navigate({
        name: route.params?.returnScreen || 'EditProfile',
        params: { [returnKey]: result.uri, cropKind: 'avatar' },
        merge: true,
      });
    } catch (e) {
      Alert.alert('Crop failed', e?.message || 'Try another photo');
    } finally {
      setBusy(false);
    }
  };

  if (!uri) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Text style={styles.missing}>No photo selected.</Text>
        <TouchableOpacity onPress={cancel}><Text style={styles.link}>Go back</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Text style={styles.title}>Crop profile photo</Text>
        <Text style={styles.sub}>Pinch to zoom · drag to position · circular preview</Text>

        <View style={styles.stage}>
          <GestureDetector gesture={composed}>
            <Animated.View style={[{ width: displayW || baseFit, height: displayH || baseFit }, animStyle]}>
              <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            </Animated.View>
          </GestureDetector>
          <View pointerEvents="none" style={styles.mask}>
            <View style={styles.circle} />
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.btnGhost} onPress={cancel} disabled={busy}>
            <Text style={styles.btnGhostText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnGold} onPress={apply} disabled={busy}>
            {busy ? <ActivityIndicator color={COLORS.navy} /> : <Text style={styles.btnGoldText}>Use photo</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', alignItems: 'center', paddingHorizontal: 20 },
  title: { color: '#fff', fontFamily: FONTS.extraBold, fontSize: 17, marginTop: 12 },
  sub: { color: COLORS.textDim, fontFamily: FONTS.regular, fontSize: 12, marginTop: 6, marginBottom: 20 },
  stage: {
    width: FRAME, height: FRAME, borderRadius: FRAME / 2, overflow: 'hidden',
    backgroundColor: '#111', alignItems: 'center', justifyContent: 'center',
  },
  mask: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  circle: {
    width: FRAME, height: FRAME, borderRadius: FRAME / 2,
    borderWidth: 2, borderColor: COLORS.gold,
  },
  actions: { flexDirection: 'row', gap: 12, marginTop: 28, width: '100%' },
  btnGhost: {
    flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.navyLine, alignItems: 'center',
  },
  btnGhostText: { color: '#fff', fontFamily: FONTS.bold },
  btnGold: {
    flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: COLORS.gold, alignItems: 'center',
  },
  btnGoldText: { color: COLORS.navy, fontFamily: FONTS.extraBold },
  missing: { color: '#fff', marginTop: 40, fontFamily: FONTS.medium },
  link: { color: COLORS.gold, marginTop: 12, fontFamily: FONTS.bold },
});

export default CircularAvatarCropScreen;
