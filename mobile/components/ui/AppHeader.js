// © 2026 WiamApp. Powered by WiamLabs
// Part 13 — WiamApp brand row + circular icon buttons

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, goldGradient } from '../../constants/colors';

export default function AppHeader({
  onSearch,
  onNotifications,
  showSearch = true,
  unread = 0,
  rightExtra = null,
}) {
  return (
    <View style={styles.row}>
      <View style={styles.brand}>
        <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logoBadge}>
          <Text style={styles.logoLetter}>W</Text>
        </LinearGradient>
        <Text style={styles.brandName}>
          Wiam<Text style={styles.brandGold}>App</Text>
        </Text>
      </View>
      <View style={styles.icons}>
        {rightExtra}
        {showSearch ? (
          <TouchableOpacity style={styles.iconBtn} onPress={onSearch} accessibilityLabel="Search">
            <Ionicons name="search-outline" size={16} color="#C9C9DE" />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.iconBtn} onPress={onNotifications} accessibilityLabel="Notifications">
          <Ionicons name="notifications-outline" size={16} color="#C9C9DE" />
          {unread > 0 ? <View style={styles.dot} /> : null}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: { color: Colors.navy, fontWeight: '800', fontSize: 16 },
  brandName: { fontSize: 18, fontWeight: '800', color: Colors.white, letterSpacing: -0.3 },
  brandGold: { color: Colors.gold },
  icons: { flexDirection: 'row', gap: 9, alignItems: 'center' },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.navyCard,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.gold,
  },
});
