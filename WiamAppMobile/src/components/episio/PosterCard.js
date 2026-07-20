import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { COLORS, FONTS } from '../../constants/theme';
import resolveUrl from '../../utils/resolveUrl';

const PosterCard = ({
  title,
  tag,
  posterUrl,
  badge,
  views,
  onPress,
  width = 108,
  height = 154,
}) => {
  const uri = resolveUrl(posterUrl);
  return (
    <TouchableOpacity style={{ width }} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.art, { width, height }]}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : null}
        {badge ? (
          <View style={[styles.badge, badge === 'HOT' ? styles.hot : styles.new]}>
            <Text style={[styles.badgeText, badge === 'HOT' && { color: '#fff' }]}>{badge}</Text>
          </View>
        ) : null}
        {views ? (
          <View style={styles.views}>
            <Text style={styles.viewsText}>{views}</Text>
          </View>
        ) : null}
      </View>
      {title ? (
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
      ) : null}
      {tag ? (
        <Text style={styles.tag} numberOfLines={1}>{tag}</Text>
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  art: {
    borderRadius: 14,
    backgroundColor: COLORS.navySoft,
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    top: 7,
    left: 7,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  new: { backgroundColor: COLORS.gold },
  hot: { backgroundColor: COLORS.error },
  badgeText: {
    fontSize: 8.5,
    fontFamily: FONTS.bold,
    color: COLORS.navy,
  },
  views: {
    position: 'absolute',
    bottom: 7,
    right: 7,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  viewsText: { fontSize: 9, color: '#fff', fontFamily: FONTS.medium },
  title: {
    marginTop: 7,
    fontSize: 11.5,
    fontFamily: FONTS.semi,
    color: COLORS.text,
    lineHeight: 15,
  },
  tag: {
    marginTop: 2,
    fontSize: 10,
    fontFamily: FONTS.regular,
    color: COLORS.textFaint,
  },
});

export default PosterCard;
