/**
 * WiamEpisio-Legal-Privacy-Terms.html — Privacy / Terms tabs with concise product copy.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS } from '../../constants/theme';

const LAST_UPDATED = 'June 1, 2026';
const SUPPORT = 'support@wiamapp.com';

const PRIVACY = [
  {
    heading: '1. What We Collect',
    body: 'We collect account details (email, display name), viewing activity, device information, and payment metadata needed to run WiamEpisio. Full card or Mobile Money numbers are handled by our payment processors — we do not store them on our servers.',
  },
  {
    heading: '2. How We Use Your Data',
    bullets: [
      'Personalizing your Home feed and recommendations',
      'Processing coin purchases and creator payouts',
      'Sending notifications you have opted into',
      'Improving app performance and fixing bugs',
    ],
  },
  {
    heading: "3. What We Don't Do",
    body: 'We never sell your personal data to third parties. We do not share your individual watch history with advertisers — only aggregated, anonymized trends may inform product decisions.',
  },
  {
    heading: '4. Your Rights',
    body: 'You can request a copy of your data, correct inaccurate information, or delete your account from Settings. Privacy questions go to support@wiamapp.com.',
  },
  {
    heading: '5. Data Retention',
    body: 'We retain account data while your account is active, and for up to 90 days after deletion for fraud-prevention and legal compliance, after which it is permanently erased where required by law.',
  },
];

const TERMS = [
  {
    heading: '1. The Service',
    body: 'WiamEpisio is a short-drama streaming app operated by WiamLabs. By creating an account you agree to these Terms and our Privacy Policy. You must be old enough to use digital payment services in your country.',
  },
  {
    heading: '2. Coins & Purchases',
    body: 'Coins are a digital unlock currency for premium episodes and related features. Coin packs are purchased with real money. Prices at checkout are final. Coins generally do not expire, but unused coins have no cash value outside the app.',
  },
  {
    heading: '3. Content & Viewing',
    body: 'Episodes, trailers, and series pages are licensed or uploaded for streaming on WiamEpisio. You may watch for personal, non-commercial use. Recording, redistributing, or scraping content is not allowed.',
  },
  {
    heading: '4. Creator Uploads',
    body: 'If you publish as a creator, you confirm you own or control the rights to the video and related assets you upload, and that content complies with our quality, safety, and rights rules. We may review, delay, or remove content that violates those rules.',
  },
  {
    heading: '5. Acceptable Use & Contact',
    body: 'Do not harass others, attempt account takeover, abuse payment systems, or reverse-engineer the app. We may suspend accounts that break these Terms. Questions: support@wiamapp.com.',
  },
];

const LegalPrivacyTermsScreen = () => {
  const [tab, setTab] = useState('Privacy');
  const sections = tab === 'Privacy' ? PRIVACY : TERMS;

  return (
    <EpisioScreenShell title="Privacy & Terms">
      <View style={styles.tabs}>
        {['Privacy', 'Terms'].map((t) => {
          const on = tab === t;
          return (
            <TouchableOpacity
              key={t}
              style={[styles.tab, on && styles.tabOn]}
              onPress={() => setTab(t)}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabText, on && styles.tabTextOn]}>
                {t === 'Privacy' ? 'Privacy Policy' : 'Terms of Service'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.docMeta}>
        Last updated: <Text style={styles.docMetaBold}>{LAST_UPDATED}</Text>
        {' · '}Effective for all WiamEpisio users
      </Text>

      {sections.map((sec) => (
        <View key={sec.heading} style={styles.docSection}>
          <Text style={styles.docHeading}>{sec.heading}</Text>
          {sec.body ? <Text style={styles.docText}>{sec.body}</Text> : null}
          {sec.bullets ? (
            <View style={styles.bulletList}>
              {sec.bullets.map((b) => (
                <Text key={b} style={styles.bulletItem}>•  {b}</Text>
              ))}
            </View>
          ) : null}
        </View>
      ))}

      <View style={styles.contactStrip}>
        <Text style={styles.contactTitle}>
          {tab === 'Privacy' ? 'Questions about your data?' : 'Questions about these Terms?'}
        </Text>
        <TouchableOpacity
          onPress={() => Linking.openURL(`mailto:${SUPPORT}`).catch(() => {})}
        >
          <Text style={styles.contactEmail}>{SUPPORT}</Text>
        </TouchableOpacity>
      </View>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    marginTop: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
  },
  tabOn: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  tabText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.textDim,
  },
  tabTextOn: {
    color: COLORS.navy,
  },
  docMeta: {
    fontFamily: FONTS.regular,
    fontSize: 10.5,
    color: COLORS.textFaint,
    marginBottom: 18,
  },
  docMetaBold: {
    fontFamily: FONTS.bold,
    color: COLORS.gold,
  },
  docSection: {
    marginBottom: 20,
  },
  docHeading: {
    fontFamily: FONTS.extraBold,
    fontSize: 13,
    color: '#fff',
    marginBottom: 8,
  },
  docText: {
    fontFamily: FONTS.regular,
    fontSize: 11.5,
    color: COLORS.textDim,
    lineHeight: 20,
  },
  bulletList: {
    gap: 4,
  },
  bulletItem: {
    fontFamily: FONTS.regular,
    fontSize: 11.5,
    color: COLORS.textDim,
    lineHeight: 20,
  },
  contactStrip: {
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 12,
  },
  contactTitle: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: '#fff',
    marginBottom: 4,
  },
  contactEmail: {
    fontFamily: FONTS.semi,
    fontSize: 11,
    color: COLORS.gold,
  },
});

export default LegalPrivacyTermsScreen;
