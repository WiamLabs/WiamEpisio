/**
 * Layout: WiamStudio-Live-Success.html — warm team talk (not cold "platform")
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Layers } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';

const StudioLiveSuccessScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { title, underReview, message, autoPublished, seriesId } = useRoute().params || {};

  return (
    <View style={[styles.root, { paddingTop: insets.top + 20 }]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, alignItems: 'center' }}>
        <View style={styles.badge}>
          <Layers size={42} color={COLORS.navy} />
        </View>
        <Text style={styles.h1}>
          {underReview ? 'With the WiamEpisio team' : 'The WiamEpisio team published your series'}
        </Text>
        <Text style={styles.p}>
          {message || (
            underReview
              ? `We’ve received “${title || 'your series'}”. Our team is reviewing your trailer and every episode. We’ll publish it for viewers when it clears — you don’t publish yourself.`
              : autoPublished
                ? `Great news — the WiamEpisio team reviewed “${title || 'your series'}” and everything looked Good/Excellent, so we published it for viewers. Thank you for finishing a complete story.`
                : `The WiamEpisio team has published “${title || 'your series'}”. It’s live for viewers now.`
          )}
        </Text>

        <View style={styles.card}>
          <View style={styles.liveDot}><Text style={styles.liveText}>{underReview ? 'REVIEW' : 'LIVE'}</Text></View>
          <View>
            <Text style={styles.cardTitle}>{title || 'Series'}</Text>
            <Text style={styles.cardMeta}>
              {underReview
                ? 'Full check in progress · Our team publishes'
                : (autoPublished ? 'Published by the WiamEpisio team after clean review' : 'Published by the WiamEpisio team')}
            </Text>
          </View>
        </View>

        <Text style={styles.tipsTitle}>{underReview ? 'While you wait' : 'Tips to grow this week'}</Text>
        {!underReview ? (
          <>
            <Text style={styles.tip}>Share your public series link — every view helps early ranking.</Text>
            <Text style={styles.tip}>Engage early viewers — creators who show up in week one keep people longer.</Text>
            <Text style={styles.tip}>Check Analytics for where viewers drop off.</Text>
          </>
        ) : (
          <>
            <Text style={styles.tip}>Share your teaser — soft interest still helps.</Text>
            <Text style={styles.tip}>Start Season 2 only after this unit is live and complete.</Text>
            <Text style={styles.tip}>Trusted creators get faster review windows after clean seasons.</Text>
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        {!underReview && seriesId ? (
          <TouchableOpacity
            style={styles.btn}
            onPress={() => navigation.navigate('StudioAnalytics', { seriesId })}
          >
            <Text style={styles.btnText}>View Analytics</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.btn, underReview && { marginTop: 0 }]}
          onPress={() => navigation.navigate('StudioHome')}
        >
          <Text style={styles.btnText}>Back to Studio Home</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('CreatorTrustTier')}>
          <Text style={styles.ghost}>View Creator Trust Tier</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  badge: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center', marginBottom: 22,
  },
  h1: { fontSize: 22, fontFamily: FONTS.extraBold, color: '#fff', textAlign: 'center', marginBottom: 12 },
  p: { fontSize: 13, color: COLORS.textDim, textAlign: 'center', lineHeight: 20, fontFamily: FONTS.regular, marginBottom: 24 },
  card: {
    width: '100%', flexDirection: 'row', gap: 12, alignItems: 'center',
    backgroundColor: COLORS.navyCard, borderRadius: 16, borderWidth: 1, borderColor: COLORS.navyLine, padding: 14, marginBottom: 24,
  },
  liveDot: {
    backgroundColor: COLORS.gold, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  liveText: { fontSize: 10, fontFamily: FONTS.extraBold, color: COLORS.navy },
  cardTitle: { fontSize: 14, fontFamily: FONTS.extraBold, color: '#fff' },
  cardMeta: { marginTop: 4, fontSize: 11, color: COLORS.textDim, fontFamily: FONTS.regular },
  tipsTitle: { alignSelf: 'flex-start', fontSize: 13, fontFamily: FONTS.bold, color: '#fff', marginBottom: 10 },
  tip: { alignSelf: 'stretch', fontSize: 12, color: COLORS.textDim, lineHeight: 18, marginBottom: 8, fontFamily: FONTS.regular },
  footer: { paddingHorizontal: 24 },
  btn: { backgroundColor: COLORS.gold, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  btnText: { fontFamily: FONTS.extraBold, color: COLORS.navy, fontSize: 15 },
  ghost: { textAlign: 'center', color: COLORS.textDim, fontFamily: FONTS.semi, fontSize: 13, paddingVertical: 12 },
});

export default StudioLiveSuccessScreen;
