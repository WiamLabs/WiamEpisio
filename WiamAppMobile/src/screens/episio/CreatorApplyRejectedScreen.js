/**
 * Creator application rejected — show team note · re-apply
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { XCircle, MessageSquare } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';

const CreatorApplyRejectedScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const routeNote = useRoute().params?.reviewerNote;
  const [note, setNote] = useState(routeNote || '');
  const [loading, setLoading] = useState(!routeNote);

  useFocusEffect(useCallback(() => {
    if (routeNote) return undefined;
    setLoading(true);
    studioEpisioApi.getApply()
      .then((d) => setNote(d?.application?.reviewer_note || ''))
      .catch(() => setNote(''))
      .finally(() => setLoading(false));
    return undefined;
  }, [routeNote]));

  const reapply = () => {
    navigation.navigate('CreatorApply', { openForm: true });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={styles.badge}>
          <XCircle size={44} color="#E4573D" />
        </View>
        <Text style={styles.h1}>Not accepted this round</Text>
        <Text style={styles.sub}>
          The WiamEpisio team reviewed your sample carefully. You can improve and apply again — we read every resubmission.
        </Text>

        {loading ? (
          <ActivityIndicator color={COLORS.gold} style={{ marginVertical: 20 }} />
        ) : (
          <View style={styles.noteCard}>
            <View style={styles.noteHead}>
              <MessageSquare size={16} color={COLORS.gold} />
              <Text style={styles.noteTitle}>Note from our team</Text>
            </View>
            <Text style={styles.noteBody}>
              {note?.trim() || 'Focus on a stronger sample: clear 9:16 drama, stable audio, and a complete story pitch. Reach us at support@wiamapp.com if you need clarity.'}
            </Text>
          </View>
        )}

        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>Before you re-apply</Text>
          <Text style={styles.tip}>• Send a sharper sample link — vertical drama, good light, clean audio</Text>
          <Text style={styles.tip}>• Pitch a complete series (20+ episodes planned)</Text>
          <Text style={styles.tip}>• Confirm you own the rights to everything you show us</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <TouchableOpacity style={styles.cta} onPress={reapply}>
          <Text style={styles.ctaText}>Re-apply to our team</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Main')}>
          <Text style={styles.ghost}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  wrap: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 36, paddingBottom: 24 },
  badge: {
    width: 96, height: 96, borderRadius: 48, marginBottom: 22,
    backgroundColor: 'rgba(228,87,61,0.12)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(228,87,61,0.35)',
  },
  h1: { fontSize: 22, fontFamily: FONTS.extraBold, color: '#fff', textAlign: 'center', marginBottom: 10 },
  sub: {
    fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textDim, textAlign: 'center',
    lineHeight: 20, marginBottom: 22,
  },
  noteCard: {
    width: '100%', backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 16, padding: 16, marginBottom: 16,
  },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  noteTitle: { fontSize: 12.5, fontFamily: FONTS.bold, color: COLORS.gold },
  noteBody: { fontSize: 12.5, fontFamily: FONTS.regular, color: '#E7E7F2', lineHeight: 19 },
  tipsCard: {
    width: '100%', backgroundColor: 'rgba(212,160,23,0.08)', borderWidth: 1, borderColor: 'rgba(212,160,23,0.25)',
    borderRadius: 16, padding: 15,
  },
  tipsTitle: { fontSize: 11.5, fontFamily: FONTS.extraBold, color: COLORS.gold, marginBottom: 8 },
  tip: { fontSize: 11, fontFamily: FONTS.regular, color: '#D9C89A', lineHeight: 18, marginBottom: 4 },
  footer: { paddingHorizontal: 28, alignItems: 'center' },
  cta: {
    width: '100%', padding: 16, borderRadius: 16, backgroundColor: COLORS.gold,
    alignItems: 'center', marginBottom: 14,
  },
  ctaText: { fontSize: 15, fontFamily: FONTS.extraBold, color: COLORS.navy },
  ghost: { fontSize: 12.5, fontFamily: FONTS.semi, color: COLORS.textDim },
});

export default CreatorApplyRejectedScreen;
