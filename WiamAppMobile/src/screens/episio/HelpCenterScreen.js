/**
 * WiamEpisio-Help-Center.html — search, categories, FAQ, contact + legal links.
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Linking, LayoutAnimation,
} from 'react-native';
import {
  Coins, Play, User, Clapperboard, MessageCircle, ChevronDown, Search,
} from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';
import { legalOrigin } from '../../utils/siteOrigin';

const CATEGORIES = [
  { id: 'coins', title: 'Coins & Payments', sub: 'Purchases, refunds', Icon: Coins },
  { id: 'playback', title: 'Playback', sub: 'Buffering, quality', Icon: Play },
  { id: 'account', title: 'Account', sub: 'Login, settings', Icon: User },
  { id: 'creator', title: 'Becoming a Creator', sub: 'Apply, WiamStudio', Icon: Clapperboard },
];

const FAQS = [
  {
    id: 'coins-gone',
    cat: 'coins',
    q: 'Why did my coins disappear?',
    a: 'Coins are spent when you unlock episodes and never expire otherwise. Check Profile → Transaction History to see exactly where they went.',
  },
  {
    id: 'offline',
    cat: 'playback',
    q: 'Can I watch offline?',
    a: 'Yes — download any unlocked episode from its detail page. Downloads only play inside the WiamEpisio app.',
  },
  {
    id: 'cancel-vip',
    cat: 'account',
    q: 'How do I cancel VIP membership?',
    a: "Go to Settings → VIP Membership → Cancel. You'll keep VIP access until the end of your current billing period.",
  },
  {
    id: 'buffering',
    cat: 'playback',
    q: 'Videos keep buffering — what can I do?',
    a: 'Try Settings → Default video quality → Lower, or switch to Wi-Fi. If it persists on Wi-Fi, contact us with your device model.',
  },
  {
    id: 'free-eps',
    cat: 'coins',
    q: 'How do free episodes work?',
    a: 'The first episodes of each series are free on the server. After that, unlock with coins — free access is never guessed on the client.',
  },
  {
    id: 'video-size',
    cat: 'creator',
    q: 'What video size do creators upload?',
    a: '9:16 vertical or 16:9 landscape — prefer 1080×1920 or 1920×1080. Episodes must be 4–5 minutes. Soft, blurry, or wrong-size uploads are rejected.',
  },
  {
    id: 'become-creator',
    cat: 'creator',
    q: 'How do I become a creator?',
    a: 'Apply from Profile → Upload Your Own Series. The WiamEpisio team reviews before WiamStudio unlocks.',
  },
];

const HelpCenterScreen = () => {
  const legal = legalOrigin();
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState(null);
  const [openId, setOpenId] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQS.filter((f) => {
      if (activeCat && f.cat !== activeCat) return false;
      if (!q) return true;
      return f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
    });
  }, [query, activeCat]);

  const toggleFaq = (id) => {
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch { /* ignore */ }
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <EpisioScreenShell title="Help Center" subtitle="Answers & support">
      <View style={styles.searchWrap}>
        <Search size={16} color={COLORS.textFaint} />
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search for help"
          placeholderTextColor={COLORS.textFaint}
          autoCorrect={false}
        />
      </View>

      <View style={styles.grid}>
        {CATEGORIES.map(({ id, title, sub, Icon }) => {
          const on = activeCat === id;
          return (
            <TouchableOpacity
              key={id}
              style={[styles.catCard, on && styles.catCardOn]}
              onPress={() => setActiveCat((prev) => (prev === id ? null : id))}
              activeOpacity={0.85}
            >
              <Icon size={18} color={on ? COLORS.navy : COLORS.gold} />
              <Text style={[styles.catTitle, on && styles.catTitleOn]}>{title}</Text>
              <Text style={[styles.catSub, on && styles.catSubOn]}>{sub}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.section}>FREQUENTLY ASKED</Text>
      {filtered.length === 0 ? (
        <Text style={styles.empty}>No results for “{query}”.</Text>
      ) : (
        filtered.map((f) => {
          const open = openId === f.id;
          return (
            <TouchableOpacity key={f.id} style={styles.faq} onPress={() => toggleFaq(f.id)} activeOpacity={0.9}>
              <View style={styles.faqHead}>
                <Text style={styles.faqQ}>{f.q}</Text>
                <ChevronDown size={16} color={COLORS.textDim} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
              </View>
              {open ? <Text style={styles.faqA}>{f.a}</Text> : null}
            </TouchableOpacity>
          );
        })
      )}

      <View style={styles.contact}>
        <View style={{ flex: 1 }}>
          <Text style={styles.contactTitle}>Still need help?</Text>
          <Text style={styles.contactSub}>Message our support team</Text>
        </View>
        <TouchableOpacity
          style={styles.chatBtn}
          onPress={() => Linking.openURL('mailto:support@wiamapp.com')}
        >
          <MessageCircle size={14} color={COLORS.navy} />
          <Text style={styles.chatText}>Chat →</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => Linking.openURL(`${legal}/privacy`)}>
        <Text style={styles.link}>Privacy Policy</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => Linking.openURL(`${legal}/terms`)}>
        <Text style={styles.link}>Terms of Service</Text>
      </TouchableOpacity>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, marginTop: 4,
  },
  search: { flex: 1, fontFamily: FONTS.regular, fontSize: 14, color: COLORS.text, padding: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  catCard: {
    width: '47%', backgroundColor: COLORS.navyCard, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.navyLine, padding: 14, gap: 4,
  },
  catCardOn: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  catTitle: { fontFamily: FONTS.semi, fontSize: 13, color: COLORS.text, marginTop: 6 },
  catTitleOn: { color: COLORS.navy },
  catSub: { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textDim },
  catSubOn: { color: COLORS.navy, opacity: 0.75 },
  section: {
    fontFamily: FONTS.semi, fontSize: 11, color: COLORS.textFaint, letterSpacing: 0.8,
    marginTop: 22, marginBottom: 10,
  },
  empty: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textDim, marginBottom: 12 },
  faq: {
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.navyLine, padding: 14, marginBottom: 10,
  },
  faqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  faqQ: { flex: 1, fontFamily: FONTS.semi, fontSize: 14, color: COLORS.text },
  faqA: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textDim, lineHeight: 20, marginTop: 10 },
  contact: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18,
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS.lg, borderWidth: 1,
    borderColor: COLORS.navyLine, padding: 16,
  },
  contactTitle: { fontFamily: FONTS.extraBold, fontSize: 15, color: COLORS.text },
  contactSub: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textDim, marginTop: 2 },
  chatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.gold,
    borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 10,
  },
  chatText: { fontFamily: FONTS.bold, fontSize: 12, color: COLORS.navy },
  link: { marginTop: 16, color: COLORS.gold, fontFamily: FONTS.semi, textAlign: 'center', fontSize: 13 },
});

export default HelpCenterScreen;
