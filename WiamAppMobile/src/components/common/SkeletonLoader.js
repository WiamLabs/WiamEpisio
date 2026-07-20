/**
 * SkeletonLoader — Shimmer placeholder for loading states.
 * Replaces ActivityIndicator spinners per Plan.txt requirement.
 *
 * Usage:
 *   <SkeletonLoader width={120} height={180} borderRadius={8} />
 *   <SkeletonLoader.BookCard />
 *   <SkeletonLoader.BookRow count={5} />
 *   <SkeletonLoader.ListItem />
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const Shimmer = ({ width, height, borderRadius = RADIUS.sm, style }) => {
  const animValue = useRef(new Animated.Value(0)).current;
  const shimmerDistance = typeof width === 'number' ? width : 120;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(animValue, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [animValue]);

  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-shimmerDistance, shimmerDistance],
  });

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: 'rgba(255,255,255,0.04)',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(255,255,255,0.06)',
          transform: [{ translateX }],
          width: '60%',
        }}
      />
    </View>
  );
};

const BookCardSkeleton = ({ size = 'default' }) => {
  const w = size === 'small' ? 96 : 122;
  const h = size === 'small' ? 144 : 183;
  return (
    <View style={{ marginRight: SPACING.md, width: w }}>
      <Shimmer width={w} height={h} borderRadius={RADIUS.sm} />
      <Shimmer width={w * 0.8} height={12} borderRadius={4} style={{ marginTop: 8 }} />
      <Shimmer width={w * 0.5} height={10} borderRadius={4} style={{ marginTop: 4 }} />
    </View>
  );
};

const BookRowSkeleton = ({ count = 5, size = 'default' }) => (
  <View style={{ flexDirection: 'row', paddingHorizontal: SPACING.md }}>
    {Array.from({ length: count }).map((_, i) => (
      <BookCardSkeleton key={i} size={size} />
    ))}
  </View>
);

const ListItemSkeleton = ({ count = 4 }) => (
  <View style={{ paddingHorizontal: SPACING.md }}>
    {Array.from({ length: count }).map((_, i) => (
      <View key={i} style={styles.listItem}>
        <Shimmer width={60} height={90} borderRadius={RADIUS.sm} />
        <View style={{ flex: 1, marginLeft: SPACING.md }}>
          <Shimmer width={'70%'} height={14} borderRadius={4} />
          <Shimmer width={'50%'} height={12} borderRadius={4} style={{ marginTop: 6 }} />
          <Shimmer width={'90%'} height={4} borderRadius={2} style={{ marginTop: 10 }} />
        </View>
      </View>
    ))}
  </View>
);

const HomeSkeleton = () => (
  <View style={styles.homeWrap}>
    {/* Header area */}
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingTop: SPACING.lg }}>
      <Shimmer width={140} height={20} borderRadius={4} />
      <Shimmer width={32} height={32} borderRadius={16} />
    </View>
    {/* Hero banner */}
    <Shimmer width={SCREEN_WIDTH - 32} height={180} borderRadius={RADIUS.lg} style={{ marginHorizontal: SPACING.md, marginTop: SPACING.lg }} />
    {/* Section */}
    <Shimmer width={120} height={16} borderRadius={4} style={{ marginHorizontal: SPACING.md, marginTop: SPACING.xl }} />
    <BookRowSkeleton count={4} />
    {/* Section */}
    <Shimmer width={100} height={16} borderRadius={4} style={{ marginHorizontal: SPACING.md, marginTop: SPACING.xl }} />
    <BookRowSkeleton count={4} />
  </View>
);

const SkeletonLoader = Shimmer;
SkeletonLoader.BookCard = BookCardSkeleton;
SkeletonLoader.BookRow = BookRowSkeleton;
SkeletonLoader.ListItem = ListItemSkeleton;
SkeletonLoader.Home = HomeSkeleton;

const styles = StyleSheet.create({
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  homeWrap: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});

export default SkeletonLoader;
