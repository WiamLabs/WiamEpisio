// © 2026 WiamApp. Powered by WiamLabs
// screens/ReviewScreen.js
// Customer rates worker after job completion
// Only customers who completed a booking can leave a review — no fakes
// Backend: POST /api/reviews

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import GoldAvatar from '../components/ui/GoldAvatar';

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;
const PAD = Colors.screenPad;

const TAGS = [
  'On time', 'Professional', 'Quality work', 'Clean',
  'Friendly', 'Good value', 'Would hire again', 'Expert',
];

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

export default function ReviewScreen({ navigation, route }) {
  const { bookingId, workerName } = route?.params || {};

  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleTag = (tag) => {
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]));
  };

  const handleSubmit = async () => {
    if (rating === 0 || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, rating, comment, tags }),
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
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color={Colors.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Rate Your Experience</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.workerHero}>
          <GoldAvatar name={workerName} size={64} />
          <Text style={s.heroTitle}>How was {workerName?.split(' ')?.[0] || 'their'} work?</Text>
          <Text style={s.heroSub}>Share your experience with other customers</Text>
        </View>

        <View style={s.starsWrap}>
          <View style={s.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
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
                  color={(hovered || rating) >= star ? Colors.gold : Colors.navyLine}
                />
              </TouchableOpacity>
            ))}
          </View>
          {(hovered || rating) > 0 && (
            <Text style={s.ratingLabel}>{RATING_LABELS[hovered || rating]}</Text>
          )}
        </View>

        <Text style={s.fieldLabel}>What went well? (optional)</Text>
        <View style={s.tagRow}>
          {TAGS.map((tag) => {
            const active = tags.includes(tag);
            return (
              <TouchableOpacity
                key={tag}
                style={[s.tagChip, active && s.tagChipActive]}
                onPress={() => toggleTag(tag)}
              >
                {active ? <Ionicons name="checkmark" size={12} color={Colors.gold} style={{ marginRight: 3 }} /> : null}
                <Text style={[s.tagText, active && s.tagTextActive]}>{tag}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.fieldLabel}>Write a review (optional)</Text>
        <View style={s.fieldBox}>
          <TextInput
            style={s.textarea}
            placeholder="Share details about work quality, punctuality, and professionalism..."
            placeholderTextColor={Colors.textFaint}
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={s.verifiedNotice}>
          <Ionicons name="shield-checkmark-outline" size={14} color={Colors.gold} />
          <Text style={s.verifiedText}>
            Only verified customers who completed a booking can leave reviews. No fake reviews on WiamApp.
          </Text>
        </View>

        {error ? (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={14} color={Colors.error} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity onPress={() => navigation.navigate('Home')} style={s.skipBtn}>
          <Text style={s.skipText}>Skip for now</Text>
        </TouchableOpacity>

        <Text style={s.footerCopy}>© 2026 WiamApp · Powered by WiamLabs</Text>
      </ScrollView>

      <View style={s.submitBar}>
        <TouchableOpacity
          style={[s.submitBtn, (rating === 0 || loading) && s.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={rating === 0 || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={Colors.navy} />
          ) : (
            <Text style={[s.submitBtnText, rating === 0 && { opacity: 0.4 }]}>Submit Review</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.navy },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: PAD, paddingBottom: 14 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.navyCard, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.white },
  scroll: { paddingHorizontal: PAD, paddingBottom: 110 },
  workerHero: { alignItems: 'center', paddingVertical: 6, marginBottom: 8 },
  heroTitle: { fontSize: 15, fontWeight: '700', color: Colors.white, marginTop: 12, marginBottom: 4 },
  heroSub: { fontSize: 12, color: Colors.textDim },
  starsWrap: { alignItems: 'center', marginBottom: 22 },
  starsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  starBtn: { padding: 4 },
  ratingLabel: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  fieldLabel: { fontSize: 12.5, fontWeight: '600', color: Colors.white, marginBottom: 8, marginTop: 4 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tagChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999,
    backgroundColor: Colors.navyCard, borderWidth: 1, borderColor: Colors.navyLine,
  },
  tagChipActive: { backgroundColor: 'rgba(212,160,23,0.1)', borderColor: Colors.gold },
  tagText: { color: '#B8B8CC', fontSize: 11.5 },
  tagTextActive: { color: Colors.gold, fontWeight: '600' },
  fieldBox: {
    backgroundColor: Colors.navyCard, borderWidth: 1, borderColor: Colors.navyLine,
    borderRadius: 14, padding: 13, marginBottom: 12,
  },
  textarea: { color: Colors.white, fontSize: 13, minHeight: 100, lineHeight: 20 },
  verifiedNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(212,160,23,0.08)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(212,160,23,0.2)', padding: 12, marginTop: 4,
  },
  verifiedText: { color: Colors.textDim, fontSize: 12, lineHeight: 18, flex: 1 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 12, marginTop: 12,
  },
  errorText: { color: Colors.error, fontSize: 12, flex: 1 },
  skipBtn: { alignItems: 'center', paddingVertical: 14 },
  skipText: { color: Colors.textFaint, fontSize: 13 },
  footerCopy: { textAlign: 'center', fontSize: 10, color: '#3A3A56' },
  submitBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.navySoft, borderTopWidth: 1, borderTopColor: '#1C1C38',
    paddingHorizontal: PAD, paddingVertical: 16,
  },
  submitBtn: {
    backgroundColor: Colors.gold, borderRadius: 16, paddingVertical: 14, alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: 'rgba(212,160,23,0.25)' },
  submitBtnText: { color: Colors.navy, fontSize: 14, fontWeight: '700' },
});
