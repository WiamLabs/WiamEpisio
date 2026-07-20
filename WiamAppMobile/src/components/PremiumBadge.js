/**
 * PremiumBadge — displays the user's premium plan badge inline next to usernames.
 *
 * Usage:
 *   <PremiumBadge plan="plus" size={14} />
 *   <PremiumBadge plan={user.premium_plan} />
 *
 * Plans: basic (gold star), plus (blue diamond), unlimited (gold crown)
 * Returns null if plan is falsy or 'none'.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Crown, Star, Diamond } from 'lucide-react-native';

const BADGE_CONFIG = {
  basic: {
    icon: Star,
    color: '#d4a843',
    bg: 'rgba(212,168,67,0.15)',
    label: 'Premium',
  },
  plus: {
    icon: Diamond,
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.15)',
    label: 'Plus',
  },
  unlimited: {
    icon: Crown,
    color: '#d4a843',
    bg: 'rgba(212,168,67,0.15)',
    label: 'Unlimited',
  },
};

const PremiumBadge = ({ plan, size = 14, showLabel = false, style }) => {
  if (!plan || plan === 'none') return null;
  const cfg = BADGE_CONFIG[plan] || BADGE_CONFIG.basic;
  const Icon = cfg.icon;
  const iconSize = size;

  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }, style]}>
      <Icon size={iconSize} color={cfg.color} strokeWidth={2.5} />
      {showLabel && (
        <Text style={[styles.label, { color: cfg.color, fontSize: iconSize - 2 }]}>
          {cfg.label}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default PremiumBadge;
