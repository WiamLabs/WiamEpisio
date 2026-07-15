// © 2026 WiamApp. Powered by WiamLabs
// Part 13 — Spotlight feed card (portfolio media + Book Now)

import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import GoldAvatar from './GoldAvatar';

export default function SpotlightCard({
  name,
  roleLine,
  rating,
  tag,
  caption,
  jobsCount,
  mediaUrl,
  avatarUrl,
  verified = false,
  onPressCard,
  onBook,
  hideBook = false,
}) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const ratingText =
    rating == null || Number.isNaN(Number(rating)) ? null : Number(rating).toFixed(1);

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.head} onPress={onPressCard} activeOpacity={0.85}>
        <GoldAvatar name={name} uri={avatarUrl} size={44} verified={verified} />
        <View style={styles.headText}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{name || 'Worker'}</Text>
          </View>
          <Text style={styles.role} numberOfLines={1}>{roleLine || 'Professional'}</Text>
        </View>
        {ratingText ? (
          <View style={styles.rating}>
            <Ionicons name="star" size={12} color={Colors.gold} />
            <Text style={styles.ratingText}>{ratingText}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <TouchableOpacity onPress={onPressCard} activeOpacity={0.9}>
        {mediaUrl ? (
          <Image source={{ uri: mediaUrl }} style={styles.media} />
        ) : (
          <View style={styles.mediaPlaceholder}>
            <Text style={styles.mediaPlaceholderText}>PORTFOLIO PHOTO</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.body}>
        {tag ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ) : null}
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
        {jobsCount != null ? (
          <Text style={styles.jobs}>{jobsCount} jobs completed</Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <View style={styles.actionIcons}>
          <TouchableOpacity onPress={() => setLiked((v) => !v)} hitSlop={8}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={20}
              color={liked ? Colors.error : '#6B6B85'}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSaved((v) => !v)} hitSlop={8}>
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={saved ? Colors.gold : '#6B6B85'}
            />
          </TouchableOpacity>
        </View>
        {!hideBook ? (
          <TouchableOpacity style={styles.bookBtn} onPress={onBook} activeOpacity={0.9}>
            <Text style={styles.bookText}>Book Now</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    backgroundColor: Colors.navyCard,
    borderWidth: 1,
    borderColor: Colors.navyLine,
    overflow: 'hidden',
    marginBottom: 16,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headText: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontSize: 14, fontWeight: '600', color: Colors.white },
  role: { fontSize: 11.5, color: Colors.textDim, marginTop: 1 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 12, fontWeight: '500', color: Colors.white },
  media: {
    marginHorizontal: 16,
    height: 176,
    borderRadius: 18,
    backgroundColor: Colors.navySoft,
  },
  mediaPlaceholder: {
    marginHorizontal: 16,
    height: 176,
    borderRadius: 18,
    backgroundColor: Colors.navySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaPlaceholderText: {
    color: '#3E3E5C',
    fontSize: 11,
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  body: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212,160,23,0.12)',
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 999,
  },
  tagText: { fontSize: 10, fontWeight: '500', color: Colors.gold },
  caption: { fontSize: 13, color: '#D3D3E2', marginTop: 9, marginBottom: 6, lineHeight: 18 },
  jobs: { fontSize: 11, color: '#65657F' },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  actionIcons: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  bookBtn: {
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: Colors.gold,
  },
  bookText: { fontSize: 12.5, fontWeight: '700', color: Colors.navy },
});
