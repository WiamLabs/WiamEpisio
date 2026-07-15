// © 2026 WiamApp. Powered by WiamLabs
// Part 13 — horizontal category filter chips

import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

const FALLBACK_ICONS = {
  All: 'grid-outline',
  Electrical: 'flash-outline',
  Building: 'construct-outline',
  Beauty: 'cut-outline',
  Creative: 'camera-outline',
  Décor: 'image-outline',
  Decor: 'image-outline',
};

export default function CategoryChips({
  categories = [],
  activeId = 'all',
  onSelect,
  includeAll = true,
}) {
  const items = includeAll
    ? [{ id: 'all', name: 'All' }, ...categories]
    : categories;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {items.map((cat) => {
        const active = String(activeId) === String(cat.id);
        const icon = FALLBACK_ICONS[cat.name] || 'ellipse-outline';
        return (
          <TouchableOpacity
            key={cat.id}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onSelect?.(cat)}
            activeOpacity={0.85}
          >
            <Ionicons name={icon} size={13} color={active ? Colors.navy : '#B8B8CC'} />
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingBottom: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: Colors.navyCard,
  },
  chipActive: { backgroundColor: Colors.gold },
  label: { fontSize: 12, fontWeight: '500', color: '#B8B8CC' },
  labelActive: { color: Colors.navy, fontWeight: '700' },
});
