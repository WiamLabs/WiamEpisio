import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  PanResponder,
  Animated,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { COLORS } from '../../constants/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CIRCLE_SIZE = SCREEN_W * 0.72;
const IMAGE_AREA = SCREEN_W;
const SLIDER_INSET = 24;
const SLIDER_WIDTH = SCREEN_W - SLIDER_INSET * 2;
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;

const CircularCropModal = ({ visible, imageUri, onCancel, onSave }) => {
  const [zoom, setZoom] = useState(ZOOM_MIN);
  const [saving, setSaving] = useState(false);

  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const panOffset = useRef({ x: 0, y: 0 });
  const sliderTrackX = useRef(0);
  const zoomRef = useRef(ZOOM_MIN);

  const [imgSize, setImgSize] = useState({ w: IMAGE_AREA, h: IMAGE_AREA });

  React.useEffect(() => {
    if (imageUri) {
      Image.getSize(
        imageUri,
        (w, h) => {
          setImgSize({ w, h });
        },
        () => {},
      );
      setZoom(ZOOM_MIN);
      zoomRef.current = ZOOM_MIN;
      pan.setValue({ x: 0, y: 0 });
      panOffset.current = { x: 0, y: 0 };
    }
  }, [imageUri]);

  const imagePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: panOffset.current.x,
          y: panOffset.current.y,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gs) => {
        panOffset.current = {
          x: panOffset.current.x + gs.dx,
          y: panOffset.current.y + gs.dy,
        };
        pan.flattenOffset();
      },
    }),
  ).current;

  // Slider PanResponder — uses pageX vs measured track x for smooth drag from anywhere
  const updateZoomFromPageX = (pageX) => {
    const x = pageX - sliderTrackX.current;
    const ratio = Math.max(0, Math.min(1, x / SLIDER_WIDTH));
    const next = ZOOM_MIN + ratio * (ZOOM_MAX - ZOOM_MIN);
    zoomRef.current = next;
    setZoom(next);
  };

  const sliderResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (e) => updateZoomFromPageX(e.nativeEvent.pageX),
      onPanResponderMove: (e) => updateZoomFromPageX(e.nativeEvent.pageX),
      onPanResponderRelease: (e) => updateZoomFromPageX(e.nativeEvent.pageX),
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  const handleSave = async () => {
    if (!imageUri) return;
    setSaving(true);
    try {
      const { w: origW, h: origH } = imgSize;
      const aspect = origW / origH;
      let displayW;
      let displayH;
      if (aspect > 1) {
        displayH = IMAGE_AREA * zoom;
        displayW = displayH * aspect;
      } else {
        displayW = IMAGE_AREA * zoom;
        displayH = displayW / aspect;
      }

      const centerX = displayW / 2 - panOffset.current.x;
      const centerY = displayH / 2 - panOffset.current.y;
      const scaleX = origW / displayW;
      const scaleY = origH / displayH;

      const cropSize = CIRCLE_SIZE * scaleX;
      let originX = (centerX - CIRCLE_SIZE / 2) * scaleX;
      let originY = (centerY - CIRCLE_SIZE / 2) * scaleY;
      originX = Math.max(0, Math.min(originX, origW - cropSize));
      originY = Math.max(0, Math.min(originY, origH - cropSize));
      const finalSize = Math.min(cropSize, origW, origH);

      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX: Math.round(originX),
              originY: Math.round(originY),
              width: Math.round(finalSize),
              height: Math.round(finalSize),
            },
          },
          { resize: { width: 400, height: 400 } },
        ],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );
      onSave(result.uri);
    } catch (err) {
      onSave(imageUri);
    } finally {
      setSaving(false);
    }
  };

  if (!visible || !imageUri) return null;

  const aspect = imgSize.w / imgSize.h;
  const displayStyle =
    aspect > 1
      ? { height: IMAGE_AREA * zoom, width: IMAGE_AREA * zoom * aspect }
      : { width: IMAGE_AREA * zoom, height: (IMAGE_AREA * zoom) / aspect };

  const fillRatio = (zoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN);

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.backdrop}>
        <Text style={styles.title}>Crop your photo</Text>
        <Text style={styles.subtitle}>Drag the photo and use the slider to zoom.</Text>

        <View style={styles.imageContainer}>
          <Animated.View
            {...imagePanResponder.panHandlers}
            style={[
              styles.imageWrapper,
              {
                transform: [
                  { translateX: pan.x },
                  { translateY: pan.y },
                ],
              },
            ]}
          >
            <Image
              source={{ uri: imageUri }}
              style={[styles.image, displayStyle]}
              resizeMode="cover"
            />
          </Animated.View>

          <View style={styles.maskOverlay} pointerEvents="none">
            <View style={styles.maskTop} />
            <View style={styles.maskMiddleRow}>
              <View style={styles.maskSide} />
              <View style={styles.circle} />
              <View style={styles.maskSide} />
            </View>
            <View style={styles.maskBottom} />
          </View>
        </View>

        {/* Zoom slider */}
        <View style={styles.sliderBlock}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>Zoom</Text>
            <Text style={styles.sliderValue}>{`${zoom.toFixed(1)}x`}</Text>
          </View>
          <View
            style={styles.sliderHit}
            onLayout={(e) => {
              const { x } = e.nativeEvent.layout;
              // pageX-relative: get absolute x of the track (left edge of hit area)
              // We rely on measureInWindow for accuracy below.
              const ref = e.target;
              if (ref && ref.measureInWindow) {
                ref.measureInWindow((winX) => {
                  sliderTrackX.current = winX;
                });
              } else {
                sliderTrackX.current = x;
              }
            }}
            {...sliderResponder.panHandlers}
          >
            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFill, { width: `${fillRatio * 100}%` }]} />
            </View>
            <View
              style={[
                styles.sliderThumb,
                { left: `${fillRatio * 100}%` },
              ]}
            />
          </View>
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const MASK_COLOR = 'rgba(0, 0, 0, 0.7)';

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 8, 26, 0.97)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 60,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 16,
  },
  imageContainer: {
    width: IMAGE_AREA,
    height: IMAGE_AREA,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    borderRadius: 16,
  },
  imageWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {},
  maskOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maskTop: { width: '100%', flex: 1, backgroundColor: MASK_COLOR },
  maskMiddleRow: { flexDirection: 'row', height: CIRCLE_SIZE, width: '100%' },
  maskSide: { flex: 1, backgroundColor: MASK_COLOR },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 2,
    borderColor: 'rgba(212, 168, 67, 0.6)',
  },
  maskBottom: { width: '100%', flex: 1, backgroundColor: MASK_COLOR },
  sliderBlock: {
    width: SLIDER_WIDTH,
    marginTop: 24,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderLabel: { fontSize: 13, color: COLORS.textMuted },
  sliderValue: { fontSize: 13, color: COLORS.secondary, fontWeight: '700' },
  sliderHit: {
    width: SLIDER_WIDTH,
    height: 44,
    justifyContent: 'center',
  },
  sliderTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  sliderFill: {
    height: 4,
    backgroundColor: COLORS.secondary,
    borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute',
    top: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.secondary,
    marginLeft: -10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  buttons: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 32,
    paddingHorizontal: 24,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 15,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
  },
  saveText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 15,
  },
});

export default CircularCropModal;
