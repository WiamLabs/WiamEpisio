/**
 * Legal — Privacy / Terms tabs
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ScrollView } from 'react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';
import { legalOrigin } from '../../utils/siteOrigin';

const TABS = ['Privacy', 'Terms'];

const LegalPrivacyTermsScreen = () => {
  const [tab, setTab] = useState('Privacy');
  const legal = legalOrigin();
  const url = tab === 'Privacy' ? `${legal}/privacy` : `${legal}/terms`;

  return (
    <EpisioScreenShell title="Legal" subtitle="Policies on wiamapp.com">
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabOn]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView style={styles.body}>
        <Text style={styles.summary}>
          {tab === 'Privacy'
            ? 'We collect account, watch, and payment data to run WiamEpisio. Read the full policy for retention, cookies, and your rights.'
            : 'Terms cover coins, VIP membership, creator uploads, and acceptable use. Full text lives on our website.'}
        </Text>
        <TouchableOpacity style={styles.open} onPress={() => Linking.openURL(url)}>
          <Text style={styles.openText}>Open {tab} Policy</Text>
        </TouchableOpacity>
        <Text style={styles.url}>{url}</Text>
      </ScrollView>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: RADIUS.sm, alignItems: 'center',
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  tabOn: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  tabText: { fontFamily: FONTS.semi, fontSize: 13, color: COLORS.textDim },
  tabTextOn: { color: COLORS.navy },
  body: { flex: 1 },
  summary: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textDim, lineHeight: 22 },
  open: {
    marginTop: 20, backgroundColor: COLORS.gold, borderRadius: RADIUS.md,
    padding: 14, alignItems: 'center',
  },
  openText: { fontFamily: FONTS.bold, color: COLORS.navy },
  url: { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textFaint, marginTop: 12, textAlign: 'center' },
});

export default LegalPrivacyTermsScreen;
