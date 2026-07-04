// © 2026 WiamApp. Powered by WiamLabs
// screens/WebViewScreen.js
//
// One reusable in-app browser for the handful of pages the master
// plan explicitly allows a WebView for (Section 24's Quick
// Reference Card): Terms, Privacy, Help, and Billing. Never used
// for booking, payment negotiation, or chat — those stay native.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { Colors } from '../constants/colors';

const NAVY = Colors.navyDeep || Colors.navy;
const WHITE = '#FFFFFF';

export default function WebViewScreen({ navigation, route }) {
  const { url, title } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={WHITE} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{title || 'WiamApp'}</Text>
      </View>

      {loadError ? (
        <View style={s.errorWrap}>
          <Ionicons name="cloud-offline-outline" size={40} color="#999" />
          <Text style={s.errorText}>Could not load this page. Check your connection and try again.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => { setLoadError(false); setLoading(true); }}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <WebView
            source={{ uri: url }}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => setLoadError(true)}
            startInLoadingState
          />
          {loading && (
            <View style={s.loadingOverlay}>
              <ActivityIndicator color={Colors.gold} size="large" />
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WHITE },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: NAVY, paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: { padding: 2 },
  headerTitle: { color: WHITE, fontSize: 16, fontWeight: '700', flex: 1 },
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', backgroundColor: WHITE,
  },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 14 },
  errorText: { fontSize: 14, color: '#666', textAlign: 'center' },
  retryBtn: { backgroundColor: Colors.gold, paddingHorizontal: 24, paddingVertical: 11, borderRadius: 10 },
  retryText: { color: NAVY, fontWeight: '700', fontSize: 14 },
});
