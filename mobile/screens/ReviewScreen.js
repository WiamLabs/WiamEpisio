// © 2026 WiamApp. Powered by WiamLabs
// screens/ReviewScreen.js
// Customer rates worker after job completion
// Only customers who completed a booking can leave a review — no fakes
// Backend: POST /api/reviews

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet,  StatusBar,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const BG      = '#FFFFFF';
const NAVY    = '#0D0D2B';
const GOLD    = '#D4A017';
const GOLD_BG = 'rgba(212,160,23,0.10)';
const BORDER  = '#EBEBEB';
const MUTED   = '#888899';
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

const TAGS = [
  'On time', 'Professional', 'Quality work', 'Clean',
  'Friendly', 'Good value', 'Would hire again', 'Expert',
];

export default function ReviewScreen({ navigation, route }) {
  const { bookingId, workerName } = route?.params || {};

  const [rating,   setRating]   = useState(0);
  const [hovered,  setHovered]  = useState(0);
  const [comment,  setComment]  = useState('');
  const [tags,     setTags]     = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const toggleTag = (tag) => {
    setTags(t => t.includes(tag) ? t.filter(x => x !== tag) : [...t, tag]);
  };

  const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

  const handleSubmit = async () => {
    if (rating === 0 || loading) return;
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`${BACKEND}/api/reviews`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          booking_id: bookingId,
          rating,
          comment,
          tags,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not submit review.');
      navigation.replace('Home');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={NAVY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Leave a Review</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Worker name */}
        <View style={s.workerCard}>
          <View style={s.workerAvatar}>
            <Text style={s.workerAvatarText}>{workerName?.[0]?.toUpperCase()}</Text>
          </View>
          <View>
            <Text style={s.workerName}>{workerName}</Text>
            <Text style={s.workerLabel}>How was your experience?</Text>
          </View>
        </View>

        {/* Star rating */}
        <Text style={s.label}>YOUR RATING *</Text>
        <View style={s.starsWrap}>
          <View style={s.starsRow}>
            {[1, 2, 3, 4, 5].map(star => (
              <TouchableOpacity
                key={star}
                onPress={() => setRating(star)}
                onPressIn={() => setHovered(star)}
                onPressOut={() => setHovered(0)}
                activeOpacity={0.8}
                style={s.starBtn}
              >
                <Ionicons
                  name={(hovered || rating) >= star ? 'star' : 'star-outline'}
                  size={38}
                  color={(hovered || rating) >= star ? GOLD : '#DDD'}
                />
              </TouchableOpacity>
            ))}
          </View>
          {(hovered || rating) > 0 && (
            <Text style={s.ratingLabel}>{ratingLabels[hovered || rating]}</Text>
          )}
        </View>

        {/* Quick tags */}
        <Text style={s.label}>WHAT DID THEY DO WELL? (OPTIONAL)</Text>
        <View style={s.tagsWrap}>
          {TAGS.map(tag => (
            <TouchableOpacity
              key={tag}
              style={[s.tagChip, tags.includes(tag) && s.tagChipActive]}
              onPress={() => toggleTag(tag)}
            >
              {tags.includes(tag) && (
                <Ionicons name="checkmark" size={12} color={NAVY} style={{ marginRight: 3 }} />
              )}
              <Text style={[s.tagText, tags.includes(tag) && s.tagTextActive]}>
                {tag}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Comment */}
        <Text style={s.label}>WRITE A REVIEW (OPTIONAL)</Text>
        <TextInput
          style={s.textarea}
          placeholder="Tell other customers about your experience with this worker..."
          placeholderTextColor={MUTED}
          value={comment}
          onChangeText={setComment}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Verified notice */}
        <View style={s.verifiedNotice}>
          <Ionicons name="shield-checkmark-outline" size={14} color={GOLD} />
          <Text style={s.verifiedText}>
            Only verified customers who completed a booking can leave reviews. No fake reviews on WiamApp.
          </Text>
        </View>

        {/* Error */}
        {error ? (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Submit */}
        <TouchableOpacity
          style={[s.submitBtn, (rating === 0 || loading) && s.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={rating === 0 || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={NAVY} />
            : <>
                <Text style={[s.submitBtnText, rating === 0 && { color: 'rgba(13,13,43,0.4)' }]}>
                  Submit Review
                </Text>
                {rating > 0 && <Ionicons name="arrow-forward" size={16} color={NAVY} style={{ marginLeft: 6 }} />}
              </>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Home')} style={s.skipBtn}>
          <Text style={s.skipText}>Skip for now</Text>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: BORDER,
  },
  headerTitle: { color: NAVY, fontSize: 17, fontWeight: '700' },
  container:   { flexGrow: 1, padding: 20 },

  workerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F8F8FB', borderRadius: 13,
    padding: 14, marginBottom: 24,
    borderWidth: 0.5, borderColor: BORDER,
  },
  workerAvatar:    { width: 48, height: 48, borderRadius: 13, backgroundColor: GOLD_BG, alignItems: 'center', justifyContent: 'center' },
  workerAvatarText:{ color: GOLD, fontSize: 20, fontWeight: '700' },
  workerName:      { color: NAVY, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  workerLabel:     { color: MUTED, fontSize: 12 },

  label: { color: MUTED, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 12, marginTop: 8 },

  starsWrap: { alignItems: 'center', marginBottom: 24 },
  starsRow:  { flexDirection: 'row', gap: 8, marginBottom: 8 },
  starBtn:   { padding: 4 },
  ratingLabel:{ color: NAVY, fontSize: 16, fontWeight: '600' },

  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  tagChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20, borderWidth: 0.5,
    borderColor: BORDER, backgroundColor: '#F5F5F8',
  },
  tagChipActive: { backgroundColor: GOLD, borderColor: GOLD },
  tagText:       { color: MUTED, fontSize: 13 },
  tagTextActive: { color: NAVY, fontWeight: '600' },

  textarea: {
    backgroundColor: '#F5F5F8', borderRadius: 13,
    borderWidth: 0.5, borderColor: BORDER,
    padding: 13, color: NAVY, fontSize: 14,
    lineHeight: 22, minHeight: 100,
  },

  verifiedNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: GOLD_BG, borderRadius: 11,
    padding: 12, marginTop: 16,
    borderWidth: 0.5, borderColor: 'rgba(212,160,23,0.2)',
  },
  verifiedText: { color: NAVY, fontSize: 12, lineHeight: 18, flex: 1 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 10, padding: 12, marginTop: 14,
  },
  errorText: { color: '#EF4444', fontSize: 12, flex: 1 },

  submitBtn: {
    backgroundColor: GOLD, borderRadius: 13, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', marginTop: 20, marginBottom: 10,
  },
  submitBtnDisabled: { backgroundColor: 'rgba(212,160,23,0.25)' },
  submitBtnText:     { color: NAVY, fontSize: 15, fontWeight: '700' },
  skipBtn:           { alignItems: 'center', paddingVertical: 10 },
  skipText:          { color: MUTED, fontSize: 13 },
});
