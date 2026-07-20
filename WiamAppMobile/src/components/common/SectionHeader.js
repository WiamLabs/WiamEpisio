/**
 * SectionHeader — Reusable section title with optional "See All" action.
 *
 * Props:
 *   title    — Section title text
 *   icon     — Optional Lucide icon component
 *   iconColor — Icon tint color
 *   onSeeAll — If provided, shows a "See All" button
 *   style    — Container style overrides
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { COLORS, SPACING } from '../../constants/theme';

const SectionHeader = ({ title, icon: Icon, iconColor, onSeeAll, style }) => (
  <View style={[styles.container, style]}>
    <View style={styles.left}>
      {Icon && <Icon size={18} color={iconColor || COLORS.secondary} style={{ marginRight: 6 }} />}
      <Text style={styles.title}>{title}</Text>
    </View>
    {onSeeAll && (
      <TouchableOpacity style={styles.seeAll} onPress={onSeeAll} hitSlop={8}>
        <Text style={styles.seeAllText}>See All</Text>
        <ChevronRight size={14} color={COLORS.textMuted} />
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
});

export default SectionHeader;
