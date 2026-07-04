// © 2026 WiamApp. Powered by WiamLabs
// components/VerifiedBadge.jsx
// Master Plan V4 — Section 8B: Badge Artwork Standard
//
// ONE shape. TWO colors. Never an emoji, never a third color, never a
// crown/diamond layered on top for higher tiers — tier is communicated
// through the text label next to the badge, not through new badge art.
//
//   color="blue" → Colors.badgeBlue (#3B82F6) — Customers & Workers, any tier
//   color="gold" → Colors.badgeGold (#D4A017) — Business Accounts, any tier
//
// Usage:
//   <VerifiedBadge color="blue" size={18} />
//   <VerifiedBadge color="gold" size={22} />

import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '../constants/colors';

// Generates a mathematically even N-point scalloped seal outline.
// This is more reliable than hand-plotting points — every tooth is
// guaranteed evenly spaced and the shape is perfectly symmetrical.
function buildSealPath(points = 12, outerR = 11.4, innerR = 9.6, cx = 12, cy = 12) {
  const step = Math.PI / points;
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = i * step - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ',' + y.toFixed(2) + ' ';
  }
  return d + 'Z';
}

const SEAL_D = buildSealPath();
// Checkmark path, centered in the 24x24 box
const CHECK_D = 'M7.2 12.4 L10.4 15.6 L17 8.4';

export default function VerifiedBadge({ color = 'blue', size = 18, style }) {
  const fill = color === 'gold' ? Colors.badgeGold : Colors.badgeBlue;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path d={SEAL_D} fill={fill} />
      <Path
        d={CHECK_D}
        stroke="#FFFFFF"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
