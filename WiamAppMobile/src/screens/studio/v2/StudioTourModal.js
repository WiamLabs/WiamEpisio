/**
 * Studio V2 first-time tour — 3 cards explaining the new system.
 * Shown on first Library open (CreatorSettings.has_seen_v2_tour=false).
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions,
} from 'react-native';
import { Sparkles, Layers, Crown, ChevronRight } from 'lucide-react-native';
import { COLORS, SPACING, FONTS } from '../../../constants/theme';
import { STUDIO_COLORS } from '../../../constants/studioTheme';

const { width: W } = Dimensions.get('window');

const PAGES = [
  {
    icon: Sparkles,
    title: 'Welcome to WiamStudio V2',
    body: 'Build a creative system, not just a book. Your stories now live inside an optional structure of Universes, Series and Arcs.',
  },
  {
    icon: Layers,
    title: 'Group what you write',
    body: 'Organize chapters into Arcs, link books into Series, and gather everything under a Universe. Every layer is optional — solo books still work.',
  },
  {
    icon: Crown,
    title: 'Pro unlocks the deep tools',
    body: 'Universes, Series, Scheduling, Premium locking, and AI assistance are part of WiamStudio Pro. Try us free for the first 7 days.',
  },
];

const StudioTourModal = ({ visible, onClose }) => {
  const [page, setPage] = useState(0);
  const cur = PAGES[page];
  const Icon = cur.icon;
  const isLast = page === PAGES.length - 1;

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Icon size={28} color={STUDIO_COLORS.accent} />
          </View>
          <Text style={styles.title}>{cur.title}</Text>
          <Text style={styles.body}>{cur.body}</Text>

          <View style={styles.dots}>
            {PAGES.map((_, idx) => (
              <View
                key={`dot-${idx}`}
                style={[styles.dot, idx === page && styles.dotActive]}
              />
            ))}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity onPress={onClose} style={styles.skip}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => (isLast ? onClose() : setPage(page + 1))}
              style={styles.next}
            >
              <Text style={styles.nextText}>{isLast ? 'Get started' : 'Next'}</Text>
              {!isLast ? <ChevronRight size={16} color="#fff" /> : null}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  card: {
    width: Math.min(W - SPACING.lg * 2, 360),
    backgroundColor: STUDIO_COLORS.surface,
    borderRadius: 18,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: STUDIO_COLORS.accentBorder,
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: STUDIO_COLORS.accentSoft,
    borderWidth: 1, borderColor: STUDIO_COLORS.accentBorder,
    alignSelf: 'flex-start',
  },
  title: {
    color: STUDIO_COLORS.textBright,
    fontSize: 20,
    fontFamily: FONTS.displaySemi,
    marginTop: SPACING.md,
  },
  body: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACING.lg,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dotActive: {
    backgroundColor: STUDIO_COLORS.accent,
    width: 18,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  skip: { paddingHorizontal: 12, paddingVertical: 8 },
  skipText: { color: COLORS.textMuted, fontSize: 13 },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: STUDIO_COLORS.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  nextText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});

export default StudioTourModal;
