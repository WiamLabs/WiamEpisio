import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import useAuthStore from '../store/useAuthStore';
import LetterAvatar from '../components/common/LetterAvatar';
import resolveUrl from '../utils/resolveUrl';
import {
  BookOpen,
  LayoutGrid,
  PenTool,
  LogOut,
  Star,
  Bell,
  Megaphone,
  Coins,
  Gift,
  Heart,
  Smile,
  Clock,
  Flame,
  Box,
  Trophy,
  Gem,
  MessageSquare,
  ShieldAlert,
  Info,
  Bot,
  Briefcase,
  ChartBar,
  Users,
  Settings,
  Wallet,
  Download,
  Calendar,
} from 'lucide-react-native';

const CustomDrawerContent = (props) => {
  const { user, logout } = useAuthStore();
  const currentRoute = props.state.routeNames?.[props.state.index] || '';

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  const NavItem = ({ icon: Icon, label, color, active, onPress, badge }) => (
    <TouchableOpacity
      style={[styles.navItem, active && styles.activeItem]}
      onPress={onPress}
    >
      <Icon color={active ? COLORS.secondary : (color || COLORS.textSecondary)} size={20} />
      <Text style={[styles.navLabel, active && styles.activeLabel]} numberOfLines={1}>{label}</Text>
      {badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );

  const isCreator = !!(user?.is_creator);
  const roleBadge = isCreator
    ? { label: 'Creator', bg: 'rgba(212,168,67,0.15)', color: COLORS.secondary }
    : { label: 'Reader', bg: 'rgba(255,255,255,0.06)', color: COLORS.textMuted };

  return (
    <View style={styles.container}>
      <DrawerContentScrollView {...props} contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.avatarWrapper}>
            {resolveUrl(user?.avatar_url) ? (
              <Image source={{ uri: resolveUrl(user.avatar_url) }} style={styles.avatar} />
            ) : (
              <LetterAvatar name={user?.display_name || 'U'} size={46} letters={2} borderWidth={0} />
            )}
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.name} numberOfLines={1}>{user?.display_name || 'Reader'}</Text>
            <Text style={styles.email} numberOfLines={1}>{user?.email || ''}</Text>
            <View style={[styles.roleBadge, { backgroundColor: roleBadge.bg }]}>
              <Text style={[styles.roleBadgeText, { color: roleBadge.color }]}>{roleBadge.label}</Text>
            </View>
          </View>
        </View>

        {/* Personal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal</Text>
          <NavItem icon={LayoutGrid} label="Overview" active={currentRoute === 'MainTabs'} onPress={() => props.navigation.navigate('MainTabs')} />
          <NavItem icon={BookOpen} label="My Library" onPress={() => { props.navigation.navigate('MainTabs', { screen: 'Library' }); }} />
          <NavItem icon={Wallet} label="Wiam Coins" color={COLORS.secondary} onPress={() => props.navigation.navigate('Wallet')} />
          <NavItem icon={Download} label="Offline Reading" color="#60a5fa" onPress={() => props.navigation.navigate('OfflineReading')} />
          <NavItem icon={Settings} label="Settings" onPress={() => props.navigation.navigate('Settings')} />
        </View>

        {/* Explore */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Explore</Text>
          <NavItem icon={Bell} label="Notifications" color="#fbbf24" onPress={() => props.navigation.navigate('Notifications')} />
          {isCreator ? (
            <NavItem
              icon={ChartBar}
              label="WiamStudio"
              color={COLORS.secondary}
              onPress={() => props.navigation.getParent()?.navigate('Studio')}
            />
          ) : null}
          <NavItem icon={Megaphone} label="Bulletin Feed" color="#60a5fa" onPress={() => props.navigation.navigate('Bulletin')} />
          <NavItem icon={Calendar} label="Release Schedule" color="#38bdf8" onPress={() => props.navigation.navigate('Schedule')} />
          <NavItem icon={Gift} label="My Sticker Gifts" color="#e879f9" onPress={() => props.navigation.navigate('Gifts')} />
          {isCreator ? <NavItem icon={Smile} label="Sticker History" color="#fb923c" onPress={() => props.navigation.navigate('Gifts')} /> : null}
          <NavItem icon={Clock} label="Coin History" color="#a78bfa" onPress={() => props.navigation.navigate('CoinHistory')} />
          <NavItem icon={Heart} label="Tip History" color="#ec4899" onPress={() => props.navigation.navigate('TipHistory')} />
          <NavItem icon={Box} label="Programs" color="#9b59b6" onPress={() => props.navigation.navigate('Programs')} />
          <NavItem icon={Flame} label="Reading Streaks" color="#e74c3c" onPress={() => props.navigation.navigate('ReadingStreaks')} />
          <NavItem icon={Star} label="WiamElite" color={COLORS.secondary} onPress={() => props.navigation.navigate('WiamElite')} />
          <NavItem icon={Trophy} label="WiamApex" color={COLORS.secondary} onPress={() => props.navigation.navigate('WiamElite')} />
          <NavItem icon={Gem} label="WiamPremium" color="#c084fc" onPress={() => props.navigation.navigate('PremiumScreen')} />
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <NavItem icon={MessageSquare} label="Feedback" color="#34d399" onPress={() => props.navigation.navigate('Feedback')} />
          <NavItem icon={ShieldAlert} label="Account Safety" color="#f87171" onPress={() => props.navigation.navigate('AccountSafety')} />
          <NavItem icon={Info} label="Help Center" color="#60a5fa" onPress={() => props.navigation.navigate('HelpCenter')} />
          <NavItem icon={Bot} label="WiamBot Chat" color="#2dd4bf" onPress={() => props.navigation.navigate('WiamBot')} />
          <NavItem icon={Briefcase} label="Careers" color="#38bdf8" onPress={() => props.navigation.navigate('Careers')} />
        </View>

        {/* Become a Creator (readers only — creators use WiamStudio in the drawer & Profile) */}
        {!isCreator && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.becomeCreator} onPress={() => props.navigation.navigate('Apply')}>
              <PenTool color={COLORS.secondary} size={18} />
              <Text style={styles.becomeCreatorText}>Become a Creator</Text>
            </TouchableOpacity>
          </View>
        )}

      </DrawerContentScrollView>

      {/* Footer / Logout */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut color="#f87171" size={20} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
        <Text style={styles.versionText}>WiamApp v1.0.0</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08081a',
  },
  scrollContent: {
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  avatarWrapper: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'rgba(212,168,67,0.5)',
    padding: 2,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  avatarInitials: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    backgroundColor: 'rgba(114,47,55,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialsText: {
    color: COLORS.secondary,
    fontSize: 16,
    fontWeight: '700',
  },
  headerInfo: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  name: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  email: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  section: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
    marginLeft: SPACING.sm,
    marginTop: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: 1,
  },
  activeItem: {
    backgroundColor: 'rgba(212, 168, 67, 0.1)',
  },
  navLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginLeft: SPACING.md,
    fontWeight: '500',
    flex: 1,
  },
  activeLabel: {
    color: COLORS.secondary,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: COLORS.secondary,
    borderRadius: 10,
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    alignItems: 'center',
  },
  badgeText: {
    color: COLORS.black,
    fontSize: 10,
    fontWeight: '700',
  },
  becomeCreator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
  },
  becomeCreatorText: {
    color: COLORS.secondary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: SPACING.md,
  },
  footer: {
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  logoutText: {
    color: '#f87171',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: SPACING.md,
  },
  versionText: {
    color: COLORS.textMuted,
    fontSize: 10,
  },
});

export default CustomDrawerContent;
