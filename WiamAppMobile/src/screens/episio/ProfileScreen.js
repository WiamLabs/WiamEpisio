/**
 * Logged-in: WiamEpisio-Profile.html
 * Guest: WiamEpisio-Profile-Guest.html
 * Empty catalog / guest state still keeps full HTML structure — never a blank CTA shell.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  ChevronRight, Crown, Coins, Wallet, Star, Camera, Bell, Settings,
  CircleHelp as HelpIcon, LogOut, User, Play, Download, MonitorPlay,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../constants/theme';
import useAuthStore from '../../store/useAuthStore';
import coinsApi from '../../api/coins';
import authApi from '../../api/auth';
import studioEpisioApi from '../../api/studioEpisio';
import resolveUrl from '../../utils/resolveUrl';

const MenuRowIcon = ({ icon: Icon, title, sub, onPress, iconFill }) => (
  <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.75}>
    <View style={styles.menuIcon}>
      <Icon size={17} color={COLORS.gold} fill={iconFill ? COLORS.gold : 'transparent'} />
    </View>
    <View style={styles.menuText}>
      <Text style={styles.menuTitle}>{title}</Text>
      {sub ? <Text style={styles.menuSub}>{sub}</Text> : null}
    </View>
    <ChevronRight size={16} color={COLORS.textFaint} />
  </TouchableOpacity>
);

/** Guest menu row — Profile-Guest.html (title + optional gold value, no icon box). */
const GuestMenuRow = ({ title, value, trailing, onPress, last }) => (
  <TouchableOpacity
    style={[styles.guestMenuRow, last && styles.menuRowLast]}
    onPress={onPress}
    activeOpacity={0.75}
  >
    <Text style={styles.guestMenuTitle}>{title}</Text>
    {value != null ? (
      <View style={styles.guestMenuValue}>
        <Coins size={13} color={COLORS.gold} fill={COLORS.gold} />
        <Text style={styles.guestMenuValueText}>{value}</Text>
      </View>
    ) : null}
    {trailing ? <Text style={styles.guestMenuTrailing}>{trailing}</Text> : null}
    <ChevronRight size={16} color={COLORS.textFaint} style={{ marginLeft: 6 }} />
  </TouchableOpacity>
);

const ProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const [balance, setBalance] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [myListCount, setMyListCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setRefreshing(false);
      return;
    }
    try {
      const [b, following, rem] = await Promise.all([
        coinsApi.getBalance(),
        authApi.getFollowing().catch(() => ({ following: [], total: 0 })),
        studioEpisioApi.listReminders().catch(() => ({ reminders: [] })),
      ]);
      setBalance(b?.balance ?? b?.coins ?? 0);
      setFollowingCount(following?.total ?? (following?.following || []).length ?? 0);
      setMyListCount((rem?.reminders || rem?.items || []).length);
    } catch { /* keep */ } finally {
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  /* ── Guest = Profile-Guest.html ── */
  if (!isAuthenticated) {
    return (
      <ScrollView
        style={[styles.root, { paddingTop: insets.top }]}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
      >
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} hitSlop={12}>
            <Settings size={19} color={COLORS.textFaint} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.guestRow} onPress={() => navigation.navigate('Login')} activeOpacity={0.85}>
          <View style={styles.guestAvatar}>
            <User size={24} color={COLORS.textFaint} />
          </View>
          <View>
            <View style={styles.loginLinkRow}>
              <Text style={styles.loginLink}>Log in</Text>
              <ChevronRight size={14} color={COLORS.textFaint} />
            </View>
            <Text style={styles.idText}>ID Guest · Following 0</Text>
          </View>
        </TouchableOpacity>

        <LinearGradient
          colors={[COLORS.gold, COLORS.goldDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.joinBanner}
        >
          <View style={styles.joinGlow} />
          <View style={{ flex: 1 }}>
            <Text style={styles.joinTitle}>Join Membership</Text>
            <Text style={styles.joinSub}>29% off · Enjoy exclusive benefits</Text>
          </View>
          <TouchableOpacity style={styles.joinBtn} onPress={() => navigation.navigate('Member')}>
            <Text style={styles.joinBtnText}>Join</Text>
          </TouchableOpacity>
        </LinearGradient>

        <View style={styles.perksRow}>
          {[
            { Icon: Play, label: '16K+\nseries' },
            { Icon: Star, label: 'Daily\npoints', fill: true },
            { Icon: Download, label: 'Download' },
            { Icon: MonitorPlay, label: '1080p\nquality' },
          ].map(({ Icon, label, fill }) => (
            <View key={label} style={styles.perk}>
              <Icon
                size={20}
                color={COLORS.textFaint}
                fill={fill ? COLORS.textFaint : 'transparent'}
              />
              <Text style={styles.perkText}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.guestMenuGroup}>
          {/* Guests must log in before wallet / coins / rewards */}
          <GuestMenuRow title="Top Up" onPress={() => navigation.navigate('Login')} />
          <GuestMenuRow title="My Wallet" value={0} onPress={() => navigation.navigate('Login')} />
          <GuestMenuRow title="Earn Rewards" onPress={() => navigation.navigate('Login')} />
          <GuestMenuRow title="History" onPress={() => navigation.navigate('Login')} />
          <GuestMenuRow
            title="Download"
            last
            onPress={() => navigation.navigate('Login')}
          />
        </View>

        <View style={styles.guestMenuGroup}>
          <GuestMenuRow
            title="Language"
            trailing="English"
            onPress={() => navigation.navigate('Settings')}
          />
          <GuestMenuRow
            title="Help & Feedback"
            last
            onPress={() => navigation.navigate('HelpCenter')}
          />
        </View>

        <Text style={styles.footer}>© 2026 WiamEpisio · Powered by WiamLabs</Text>
      </ScrollView>
    );
  }

  /* ── Logged-in = Profile.html ── */
  const name = user?.display_name || user?.username || user?.first_name || 'Viewer';
  const avatar = resolveUrl(user?.avatar_url);
  const isMember = !!(user?.is_vip || user?.vip || user?.membership);

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top + 8 }]}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          tintColor={COLORS.gold}
        />
      }
    >
      <View style={styles.header}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatarImg} />
        ) : (
          <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.avatar}>
            <Text style={styles.avatarLetter}>{(name || 'W')[0].toUpperCase()}</Text>
          </LinearGradient>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.handle} numberOfLines={1}>
            {user?.phone || user?.email || `@${user?.username || 'member'}`}
          </Text>
          {isMember ? (
            <View style={styles.memberBadge}>
              <Crown size={10} color={COLORS.gold} fill={COLORS.gold} />
              <Text style={styles.memberBadgeText}>Weekly Member</Text>
            </View>
          ) : null}
        </View>
      </View>

      <LinearGradient
        colors={[COLORS.navyCard, COLORS.navySoft]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.wallet}
      >
        <TouchableOpacity style={styles.walletItem} onPress={() => navigation.navigate('BuyCoins')}>
          <View style={styles.walletValueRow}>
            <Coins size={15} color={COLORS.gold} fill={COLORS.gold} />
            <Text style={styles.walletValue}>{balance}</Text>
          </View>
          <Text style={styles.walletLabel}>Coins</Text>
        </TouchableOpacity>
        <View style={styles.walletDivider} />
        <TouchableOpacity style={styles.walletItem} onPress={() => navigation.navigate('MyList')}>
          <Text style={styles.walletValue}>{followingCount}</Text>
          <Text style={styles.walletLabel}>Following</Text>
        </TouchableOpacity>
        <View style={styles.walletDivider} />
        <TouchableOpacity style={styles.walletItem} onPress={() => navigation.navigate('MyList')}>
          <Text style={styles.walletValue}>{myListCount}</Text>
          <Text style={styles.walletLabel}>In My List</Text>
        </TouchableOpacity>
      </LinearGradient>

      <Text style={[styles.sectionLabel, { marginTop: 0 }]}>Membership & Wallet</Text>
      <View style={styles.menuGroup}>
        <MenuRowIcon
          icon={Crown}
          title="Membership"
          sub={isMember ? 'VIP status & coins' : 'Join for exclusive benefits'}
          onPress={() => navigation.navigate('Member')}
        />
        <MenuRowIcon icon={Coins} title="Buy Coins" iconFill onPress={() => navigation.navigate('BuyCoins')} />
        <MenuRowIcon icon={Wallet} title="Transaction History" onPress={() => navigation.navigate('TransactionHistory')} />
        <MenuRowIcon icon={Star} title="Daily Rewards & Points" onPress={() => navigation.navigate('DailyRewards')} />
      </View>

      <Text style={styles.sectionLabel}>Become a Creator</Text>
      <View style={styles.menuGroup}>
        <MenuRowIcon
          icon={Camera}
          title="Upload Your Own Series"
          sub="Apply to become a WiamEpisio Creator"
          onPress={() => navigation.navigate(user?.is_creator ? 'StudioHome' : 'CreatorApplyInviteOnly')}
        />
      </View>

      <Text style={styles.sectionLabel}>Watch & rewards</Text>
      <View style={styles.menuGroup}>
        <MenuRowIcon icon={Download} title="Downloads" onPress={() => navigation.navigate('DownloadsManager')} />
        <MenuRowIcon icon={MonitorPlay} title="Watch History" onPress={() => navigation.navigate('WatchHistory')} />
        <MenuRowIcon icon={Bell} title="Reminders" onPress={() => navigation.navigate('Reminders')} />
        <MenuRowIcon icon={Play} title="Invite Friends" onPress={() => navigation.navigate('InviteFriends')} />
      </View>

      <Text style={styles.sectionLabel}>Account</Text>
      <View style={styles.menuGroup}>
        <MenuRowIcon icon={Bell} title="Notifications" onPress={() => navigation.navigate('Notifications')} />
        <MenuRowIcon icon={Settings} title="Settings" onPress={() => navigation.navigate('Settings')} />
        <MenuRowIcon icon={HelpIcon} title="Help Center" onPress={() => navigation.navigate('HelpCenter')} />
        <MenuRowIcon icon={User} title="About WiamEpisio" onPress={() => navigation.navigate('About')} />
      </View>

      <TouchableOpacity style={styles.signOut} onPress={() => logout()}>
        <LogOut size={16} color="#EF4444" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>© 2026 WiamEpisio · Powered by WiamLabs</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },

  /* Guest — Profile-Guest.html */
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingVertical: 10 },
  guestRow: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 18 },
  guestAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  loginLink: { fontSize: 15, fontFamily: FONTS.bold, color: '#fff' },
  idText: { marginTop: 3, fontSize: 11.5, color: COLORS.textFaint, fontFamily: FONTS.regular },
  joinBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    overflow: 'hidden',
  },
  joinGlow: {
    position: 'absolute',
    right: -20,
    top: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.navy,
    opacity: 0.15,
  },
  joinTitle: { fontSize: 15, fontFamily: FONTS.extraBold, color: COLORS.navy, marginBottom: 3 },
  joinSub: { fontSize: 11, color: '#3A2E05', fontFamily: FONTS.regular },
  joinBtn: {
    marginLeft: 12,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.navy,
  },
  joinBtnText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.gold },
  perksRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 14,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.navyLine,
  },
  perk: { alignItems: 'center', gap: 6, width: 64 },
  perkText: {
    fontSize: 10,
    color: COLORS.textFaint,
    textAlign: 'center',
    fontFamily: FONTS.regular,
    lineHeight: 13,
  },
  guestMenuGroup: {
    borderRadius: 20,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    overflow: 'hidden',
    marginBottom: 16,
  },
  guestMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.navyLine,
  },
  menuRowLast: { borderBottomWidth: 0 },
  guestMenuTitle: { flex: 1, fontSize: 13.5, fontFamily: FONTS.medium, color: '#fff' },
  guestMenuValue: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  guestMenuValueText: { fontSize: 12.5, fontFamily: FONTS.semi, color: COLORS.gold },
  guestMenuTrailing: { fontSize: 12.5, color: COLORS.textFaint, fontFamily: FONTS.regular },

  /* Logged-in — Profile.html */
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, marginBottom: 6 },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: 64, height: 64, borderRadius: 32 },
  avatarLetter: { fontSize: 24, fontFamily: FONTS.extraBold, color: COLORS.navy },
  name: { fontSize: 17, fontFamily: FONTS.bold, color: '#fff' },
  handle: { marginTop: 2, fontSize: 12, color: COLORS.textFaint, fontFamily: FONTS.regular },
  memberBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(212,160,23,0.14)',
  },
  memberBadgeText: { fontSize: 10, fontFamily: FONTS.bold, color: COLORS.gold },
  wallet: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    paddingVertical: 16,
    marginBottom: 20,
  },
  walletItem: { flex: 1, alignItems: 'center' },
  walletValueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  walletValue: { fontSize: 17, fontFamily: FONTS.extraBold, color: '#fff' },
  walletLabel: { marginTop: 3, fontSize: 10, color: COLORS.textFaint, fontFamily: FONTS.regular },
  walletDivider: { width: 1, height: 32, backgroundColor: COLORS.navyLine },
  sectionLabel: {
    fontSize: 11,
    fontFamily: FONTS.bold,
    color: COLORS.textFaint,
    marginBottom: 10,
    marginLeft: 4,
    marginTop: 18,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  menuGroup: {
    backgroundColor: COLORS.navyCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 13,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.navyLine,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(212,160,23,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: { flex: 1 },
  menuTitle: { fontSize: 13.5, fontFamily: FONTS.medium, color: '#fff' },
  menuSub: { marginTop: 2, fontSize: 11, color: COLORS.textFaint, fontFamily: FONTS.regular },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    backgroundColor: 'rgba(239,68,68,0.08)',
    marginTop: 22,
  },
  signOutText: { color: '#EF4444', fontFamily: FONTS.semi, fontSize: 13.5 },
  footer: {
    textAlign: 'center',
    marginTop: 18,
    paddingBottom: 6,
    fontSize: 10,
    color: '#3A3A56',
    fontFamily: FONTS.regular,
  },
});

export default ProfileScreen;
