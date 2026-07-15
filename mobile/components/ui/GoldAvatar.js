// © 2026 WiamApp. Powered by WiamLabs
// Part 13 — circular gold-gradient avatar with optional online + verified

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, goldGradient } from '../constants/colors';

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'W';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function GoldAvatar({
  name,
  uri,
  size = 44,
  online = false,
  verified = false,
  style,
}) {
  const fontSize = Math.round(size * 0.36);
  return (
    <View style={[{ width: size, height: size }, style]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <LinearGradient
          colors={goldGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: Colors.navy, fontWeight: '700', fontSize }}>{initials(name)}</Text>
        </LinearGradient>
      )}
      {online ? <View style={[styles.online, { width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14 }]} /> : null}
      {verified ? (
        <View style={[styles.verified, { right: -2, top: -2 }]}>
          <Ionicons name="checkmark-circle" size={Math.max(14, size * 0.36)} color={Colors.gold} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  online: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: Colors.navy,
  },
  verified: {
    position: 'absolute',
    backgroundColor: Colors.navy,
    borderRadius: 999,
  },
});
