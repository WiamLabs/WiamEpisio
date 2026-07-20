/**
 * WiamEpisio-My-List-Choose-Mode.html
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Bookmark, Bell, ChevronRight } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const MODES = [
  {
    key: 'watchlist',
    title: 'Watchlist',
    sub: 'Series you saved to watch later',
    icon: Bookmark,
    screen: 'MyList',
    params: { tab: 'Following' },
  },
  {
    key: 'reminders',
    title: 'Reminders',
    sub: 'Get notified when new episodes drop',
    icon: Bell,
    screen: 'Reminders',
  },
];

const MyListChooseModeScreen = () => {
  const navigation = useNavigation();

  return (
    <EpisioScreenShell title="My List" subtitle="Choose a mode">
      {MODES.map((m) => {
        const Icon = m.icon;
        return (
          <TouchableOpacity
            key={m.key}
            style={styles.card}
            onPress={() => navigation.navigate(m.screen, m.params)}
          >
            <View style={styles.iconWrap}><Icon size={22} color={COLORS.gold} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{m.title}</Text>
              <Text style={styles.sub}>{m.sub}</Text>
            </View>
            <ChevronRight size={18} color={COLORS.textFaint} />
          </TouchableOpacity>
        );
      })}
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, marginBottom: 12,
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  iconWrap: {
    width: 48, height: 48, borderRadius: RADIUS.md, backgroundColor: COLORS.navySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: FONTS.semi, fontSize: 16, color: COLORS.text },
  sub: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textDim, marginTop: 4 },
});

export default MyListChooseModeScreen;
