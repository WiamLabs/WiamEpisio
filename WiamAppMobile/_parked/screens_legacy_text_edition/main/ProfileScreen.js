/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  Dimensions,
  TextInput,
  Switch,
  FlatList,
  Linking,
} from 'react-native';
import CachedImage from '../../components/common/CachedImage';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import useAuthStore from '../../store/useAuthStore';
import authApi from '../../api/auth';
import coinsApi from '../../api/coins';
import booksApi from '../../api/books';
import settingsApi from '../../api/settings';
import creatorApi from '../../api/creator';
import {
  LogOut,
  BookOpen,
  Star,
  Heart,
  Bell,
  Megaphone,
  Gift,
  Clock,
  LayoutGrid,
  PenTool,
  ShieldCheck,
  Coins,
  Smile,
  Trophy,
  Gem,
  Flame,
  Box,
  MessageSquare,
  ShieldAlert,
  Info,
  Bot,
  Briefcase,
  Settings,
  ChartBar,
  Users,
  FileText,
  Fingerprint,
  CheckCircle,
  Download,
  ExternalLink,
  Mail,
  Phone,
  Calendar,
  Eye,
  Lock,
  ChevronRight,
  Share2,
  Volume2,
  UserPlus,
  Bookmark,
} from 'lucide-react-native';
import BrandedFooter from '../../components/BrandedFooter';
import SkeletonLoader from '../../components/common/SkeletonLoader';
import LetterAvatar from '../../components/common/LetterAvatar';
import CircularCropModal from '../../components/common/CircularCropModal';
import resolveUrl from '../../utils/resolveUrl';
import { heavyTap, successNotification } from '../../utils/haptics';
import { useFocusEffect, useRoute } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const ProfileScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const { user, logout, isAuthenticated } = useAuthStore();
  const isFounder = !!(user?.is_founder || user?.role === 'founder');
  const isCreator = !!(user?.is_creator);
  const [activeTab, setActiveTab] = useState(route.params?.initialTab || 'overview');
  const [balance, setBalance] = useState(0);
  const [libraryBooks, setLibraryBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editFirst, setEditFirst] = useState(user?.first_name || '');
  const [editLast, setEditLast] = useState(user?.last_name || '');
  const [editBio, setEditBio] = useState(user?.bio || '');
  const [settingsPush, setSettingsPush] = useState(true);
  const [settingsEmail, setSettingsEmail] = useState(true);
  const [settingsSyncing, setSettingsSyncing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [deletePw, setDeletePw] = useState('');
  const [cropUri, setCropUri] = useState(null);
  const [showCrop, setShowCrop] = useState(false);
  // New state for rebuilt tabs
  const [followingList, setFollowingList] = useState([]);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [settingsData, setSettingsData] = useState(null);
  const [readerStats, setReaderStats] = useState(null);
  const [editUsername, setEditUsername] = useState(user?.username || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [editPronouns, setEditPronouns] = useState(user?.pronouns || '');

  const tabs = useMemo(() => {
    const rows = [
      { key: 'overview', label: 'Overview' },
      { key: 'account', label: 'Account' },
      { key: 'settings', label: 'Settings' },
      { key: 'security', label: 'Security' },
      { key: 'support', label: 'Support' },
      { key: 'following', label: 'Following' },
    ];
    if (isCreator || isFounder) {
      rows.push(
        { key: 'creatorHub', label: 'Creator Hub' },
        { key: 'creatorFollowers', label: 'Followers' },
      );
    }
    return rows;
  }, [isCreator, isFounder]);

  const [creatorDash, setCreatorDash] = useState(null);
  const [creatorStories, setCreatorStories] = useState([]);
  const [creatorEarnings, setCreatorEarnings] = useState(null);
  const [creatorFollowers, setCreatorFollowers] = useState([]);
  const [creatorPanelsLoading, setCreatorPanelsLoading] = useState(false);

  const loadCreatorPanels = useCallback(async () => {
    const u = useAuthStore.getState().user;
    if (!u) return;
    const creatorGate = !!(u.is_creator || u.is_founder || u.role === 'founder');
    if (!creatorGate) return;
    setCreatorPanelsLoading(true);
    try {
      const [d, stRes, ea, fo] = await Promise.all([
        creatorApi.getDashboard().catch(() => null),
        creatorApi.getMyStories().catch(() => ({ stories: [] })),
        creatorApi.getEarnings().catch(() => null),
        creatorApi.getFollowers().catch(() => ({ followers: [] })),
      ]);
      setCreatorDash(d);
      setCreatorStories(stRes?.stories || []);
      setCreatorEarnings(ea);
      setCreatorFollowers(fo?.followers || []);
    } catch {
      // non-fatal
    } finally {
      setCreatorPanelsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!(isCreator || isFounder)) return;
    loadCreatorPanels().catch(() => {});
  }, [isCreator, isFounder, loadCreatorPanels]);

  useEffect(() => {
    const keys = tabs.map((t) => t.key);
    if (!keys.includes(activeTab)) setActiveTab('overview');
  }, [tabs, activeTab]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const meRes = await authApi.me().catch(() => null);
        if (meRes?.user || meRes?.id) {
          const freshUser = meRes.user || meRes;
          const token = useAuthStore.getState().token;
          useAuthStore.getState().setAuth(freshUser, token);
        }

        const [balRes, libRes, settingsRes, followRes, statsRes] = await Promise.all([
          coinsApi.getBalance().catch(() => ({ balance: 0 })),
          (typeof booksApi.getMyLibrary === 'function' ? booksApi.getMyLibrary() : Promise.resolve({ books: [] })).catch(() => ({ books: [] })),
          settingsApi.get().catch(() => null),
          authApi.getFollowing().catch(() => ({ following: [], total: 0 })),
          (typeof booksApi.getReaderStats === 'function' ? booksApi.getReaderStats() : Promise.resolve(null)).catch(() => null),
        ]);
        
        setBalance(balRes?.balance || meRes?.coin_balance || 0);
        
        const booksArray = Array.isArray(libRes) ? libRes : (libRes?.books || []);
        setLibraryBooks(booksArray);

        if (settingsRes) {
          setSettingsData(settingsRes);
          if (settingsRes.notification_preferences) {
            setSettingsPush(settingsRes.notification_preferences.push_enabled !== false);
            setSettingsEmail(settingsRes.notification_preferences.email_enabled !== false);
          }
        }
        setFollowingList(followRes?.following || []);
        if (statsRes) setReaderStats(statsRes);
      } catch (err) {
          console.error("Profile Load Error:", err);
      } finally { setLoading(false); }
    };
    load();
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) return undefined;
      let cancelled = false;
      (async () => {
        try {
          const meRes = await authApi.me().catch(() => null);
          if (cancelled || !meRes) return;
          const freshUser = meRes.user || meRes;
          const token = useAuthStore.getState().token;
          await useAuthStore.getState().setAuth(freshUser, token);
          if (
            !!(freshUser?.is_creator || freshUser?.is_founder || freshUser?.role === 'founder')
          ) {
            await loadCreatorPanels();
          }
        } catch {
          // ignore
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [isAuthenticated, loadCreatorPanels])
  );

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => { heavyTap(); logout(); } },
    ]);
  };

  const toggleNotificationSetting = async (key, nextValue) => {
    setSettingsSyncing(true);
    try {
      await settingsApi.update({ [key]: nextValue });
      if (key === 'push_enabled') setSettingsPush(nextValue);
      if (key === 'email_notifications') setSettingsEmail(nextValue);
    } catch (err) {
      Alert.alert('Error', typeof err === 'string' ? err : 'Failed to update notification setting');
    } finally {
      setSettingsSyncing(false);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await authApi.updateProfile({ firstName: editFirst, lastName: editLast, bio: editBio });
      if (res.user) {
        const token = useAuthStore.getState().token;
        useAuthStore.getState().setAuth(res.user, token);
      }
      Alert.alert('Success', res.message || 'Profile updated');
    } catch (err) {
      Alert.alert('Error', typeof err === 'string' ? err : 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Please grant photo library access to upload an avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
    });
    if (result.canceled) return;
    const uri = result.assets?.[0]?.uri;
    if (!uri) return;
    setCropUri(uri);
    setShowCrop(true);
  };

  const handleCropSave = async (croppedUri) => {
    setShowCrop(false);
    setCropUri(null);
    setUploadingAvatar(true);
    try {
      const res = await authApi.uploadAvatar(croppedUri);
      if (res.avatar_url) {
        const token = useAuthStore.getState().token;
        const current = useAuthStore.getState().user;
        useAuthStore.getState().setAuth({ ...current, avatar_url: res.avatar_url }, token);
      }
      Alert.alert('Success', 'Avatar updated');
    } catch (err) {
      Alert.alert('Error', typeof err === 'string' ? err : 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      Alert.alert('Error', 'Please fill all password fields');
      return;
    }
    setSavingPw(true);
    try {
      const res = await authApi.changePassword(currentPw, newPw, confirmPw);
      Alert.alert('Success', res.message || 'Password changed');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      Alert.alert('Error', typeof err === 'string' ? err : 'Failed to change password');
    } finally {
      setSavingPw(false);
    }
  };

  const handleDeleteAccount = () => {
    if (!deletePw) {
      Alert.alert('Error', 'Enter your password to confirm deletion');
      return;
    }
    Alert.alert('Delete Account', 'This action is permanent. Are you absolutely sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await authApi.deleteAccount(deletePw);
          Alert.alert('Account Deleted', 'Your account has been deleted.');
          logout();
        } catch (err) {
          Alert.alert('Error', typeof err === 'string' ? err : 'Failed to delete account');
        }
      }},
    ]);
  };

  const roleBadge = isFounder
    ? { label: 'Founder', bg: 'rgba(231,76,60,0.15)', color: '#e74c3c' }
    : isCreator
    ? { label: 'Creator', bg: 'rgba(212,168,67,0.15)', color: COLORS.secondary }
    : { label: 'Watcher', bg: 'rgba(212,160,23,0.15)', color: COLORS.secondary };

  const avatarUri = resolveUrl(user?.avatar_url);
  const displayName = user?.display_name || user?.first_name || 'User';

  /* ── Components ── */
  const QuickLink = ({ icon: Icon, label, color, onPress, textIcon }) => (
    <TouchableOpacity style={s.ql} onPress={onPress} activeOpacity={0.7}>
      {textIcon ? <Text style={{ fontSize: 18, color }}>{textIcon}</Text> : <Icon size={18} color={color} />}
      <Text style={s.qlText}>{label}</Text>
    </TouchableOpacity>
  );

  const SupportLink = ({ icon: Icon, title, sub, color, onPress }) => (
    <TouchableOpacity style={s.supportLink} onPress={onPress} activeOpacity={0.7}>
      <Icon size={18} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={s.supportTitle}>{title}</Text>
        <Text style={s.supportSub}>{sub}</Text>
      </View>
    </TouchableOpacity>
  );

  const StatCard = ({ label, value, isGold }) => (
    <View style={s.stat}>
      <Text style={[s.statVal, isGold && { color: COLORS.secondary }]}>{value}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  );

  /* ══════════ TAB RENDERERS ══════════ */

  const renderOverview = () => {
    const readingBooks = Array.isArray(libraryBooks) ? libraryBooks.filter(b => b?.reading_progress?.current_chapter > 0) : [];
    const rs = readerStats?.stats || readerStats || {};
    return (
      <View style={s.pad}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.qlRow}>
          <QuickLink icon={Bell} label="Alerts" color="#fbbf24" onPress={() => navigation.navigate('Notifications')} />
          <QuickLink icon={Megaphone} label="Bulletin" color="#60a5fa" onPress={() => navigation.navigate('Bulletin')} />
          <QuickLink icon={Coins} label="Wallet" color={COLORS.secondary} onPress={() => navigation.navigate('Wallet')} />
          <QuickLink icon={Bookmark} label="Library" color="#60a5fa" onPress={() => navigation.navigate('Library')} />
          <QuickLink icon={Gem} label="Premium" color="#c084fc" onPress={() => navigation.navigate('PremiumScreen')} />
          <QuickLink textIcon="\u2726" label="Elite" color={COLORS.secondary} onPress={() => navigation.navigate('WiamElite')} />
          <QuickLink icon={Gift} label="Gifts" color="#e879f9" onPress={() => navigation.navigate('Gifts')} />
          <QuickLink icon={Star} label="Programs" color="#9b59b6" onPress={() => navigation.navigate('Programs')} />
        </ScrollView>

        {(isCreator || isFounder) ? (
          <>
            <View style={s.secHead}>
              <ChartBar size={16} color={COLORS.secondary} />
              <Text style={s.secTitle}>Creator workspace</Text>
            </View>
            <Text style={s.secSub}>Your stories, readers, and reach</Text>
            {creatorPanelsLoading && !creatorDash ? (
              <View style={{ marginBottom: 16 }}><SkeletonLoader.ListItem count={2} /></View>
            ) : (
              <View style={[s.statsGrid, { marginBottom: 16 }]}>
                <StatCard label="TOTAL VIEWS" value={String(creatorDash?.total_views ?? 0)} />
                <StatCard label="FOLLOWERS" value={String(creatorDash?.followers_count ?? 0)} />
                <StatCard label="STORIES" value={String(creatorDash?.stories_count ?? 0)} />
                <StatCard label="AVG RATING" value={String(creatorDash?.avg_rating ?? 0)} />
              </View>
            )}
            <View style={[s.card, { marginBottom: 20 }]}>
              <View style={s.cardHead}><PenTool size={14} color={COLORS.secondary} /><Text style={s.cardTitle}>Write & publish</Text></View>
              <Text style={s.cardDesc}>Manage your stories and analytics on the web dashboard.</Text>
              <TouchableOpacity style={s.goldBtn} onPress={() => Linking.openURL('https://wiamapp.com/studio')}>
                <Text style={s.goldBtnText}>Open WiamStudio on Web</Text>
              </TouchableOpacity>
            </View>
            <View style={s.secHead}><LayoutGrid size={16} color={COLORS.secondary} /><Text style={s.secTitle}>Watching</Text></View>
            <Text style={s.secSub}>Your personal reader activity</Text>
          </>
        ) : (
          <>
            <View style={s.secHead}><LayoutGrid size={16} color={COLORS.secondary} /><Text style={s.secTitle}>Overview</Text></View>
            <Text style={s.secSub}>Your reading activity and account summary</Text>
          </>
        )}

        <View style={s.statsGrid}>
          <StatCard label="BOOKS READ" value={String(rs.books_started ?? libraryBooks.length)} />
          <StatCard label="CHAPTERS" value={String(rs.chapters_read ?? 0)} />
          <StatCard label="REVIEWS" value={String(rs.reviews_written ?? 0)} />
          <StatCard label="FOLLOWING" value={String(followingList.length)} />
          <StatCard label="STREAK" value={String(rs.current_streak ?? 0)} />
          <StatCard label="COINS" value={String(Math.floor(balance || 0))} isGold />
        </View>

        {readingBooks.length > 0 && (
          <View style={s.card}>
            <View style={s.cardHead}><BookOpen size={14} color={COLORS.secondary} /><Text style={s.cardTitle}>Continue watching</Text></View>
            <FlatList
              horizontal showsHorizontalScrollIndicator={false}
              data={readingBooks.slice(0, 6)}
              keyExtractor={i => `cr-${i.id}`}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.libBook} onPress={() => navigation.navigate('Main', { screen: 'MainTabs', params: { screen: 'Library' } })}>
                  {item.cover_url ? <CachedImage source={{ uri: item.cover_url }} style={s.libCover} /> : <View style={[s.libCover, s.libPh]}><BookOpen size={20} color="rgba(212,168,67,0.4)" /></View>}
                  <Text style={s.libTitle} numberOfLines={2}>{item.title}</Text>
                  {item.reading_progress && <Text style={s.libMeta}>Ch {item.reading_progress.current_chapter}</Text>}
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {!(isCreator || isFounder) && (
          <View style={[s.card, { borderColor: 'rgba(212,168,67,0.15)', backgroundColor: 'rgba(212,168,67,0.03)' }]}>
            <View style={s.cardHead}><PenTool size={14} color={COLORS.secondary} /><Text style={s.cardTitle}>Become a Creator</Text></View>
            <Text style={s.cardDesc}>Share your stories with thousands of readers. Start writing today.</Text>
            <TouchableOpacity style={s.goldBtn} onPress={() => navigation.navigate('Apply')}><Text style={s.goldBtnText}>Apply Now</Text></TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const creatorGate = !!(isCreator || isFounder);

  const renderCreatorHub = () => {
    if (!creatorGate) return renderOverview();
    const months = creatorEarnings?.months || [];
    return (
      <View style={s.pad}>
        <View style={s.secHead}><ChartBar size={16} color={COLORS.secondary} /><Text style={s.secTitle}>Creator Hub</Text></View>
        <Text style={s.secSub}>Your stories, earnings, and tools — all in one place.</Text>

        {creatorPanelsLoading && !creatorDash ? (
          <SkeletonLoader.ListItem count={3} />
        ) : (
          <View style={[s.statsGrid, { marginBottom: 16 }]}>
            <StatCard label="TOTAL VIEWS" value={String(creatorDash?.total_views ?? 0)} />
            <StatCard label="FOLLOWERS" value={String(creatorDash?.followers_count ?? 0)} />
            <StatCard label="STORIES" value={String(creatorDash?.stories_count ?? 0)} />
            <StatCard label="EARNINGS" value={creatorEarnings?.total_coins != null ? String(creatorEarnings.total_coins) : '0'} isGold />
          </View>
        )}

        <TouchableOpacity style={s.card} onPress={() => navigation.getParent()?.navigate('Studio')}>
          <View style={s.cardHead}><PenTool size={14} color={COLORS.secondary} /><Text style={s.cardTitle}>WiamStudio</Text></View>
          <Text style={s.cardDesc}>Create stories, chapters, covers, publishing.</Text>
          <Text style={{ color: COLORS.secondary, fontWeight: '600', fontSize: 13 }}>Open →</Text>
        </TouchableOpacity>

        {creatorStories.length > 0 && (
          <View style={s.card}>
            <View style={s.cardHead}><BookOpen size={14} color={COLORS.secondary} /><Text style={s.cardTitle}>Your Stories ({creatorStories.length})</Text></View>
            {creatorStories.slice(0, 5).map((st) => (
              <TouchableOpacity
                key={`cs-${st.id}`}
                style={[s.supportLink, { marginBottom: 6 }]}
                onPress={() => navigation.getParent()?.navigate('Studio', { screen: 'NewStory' })}
              >
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flex: 1 }}>
                  {st.cover_url ? (
                    <CachedImage source={{ uri: resolveUrl(st.cover_url) || st.cover_url }} style={{ width: 36, height: 54, borderRadius: 6 }} />
                  ) : (
                    <View style={[s.libPh, { width: 36, height: 54, borderRadius: 6 }]}>
                      <BookOpen size={16} color="rgba(212,168,67,0.4)" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={s.supportTitle} numberOfLines={1}>{st.title}</Text>
                    <Text style={s.supportSub}>{(st.status || 'draft')} · {st.chapter_count ?? 0} ch · {st.views ?? 0} views</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {months.length > 0 && (
          <View style={s.card}>
            <View style={s.cardHead}><Coins size={14} color={COLORS.secondary} /><Text style={s.cardTitle}>Recent Earnings</Text></View>
            {months.slice(0, 3).map((m) => (
              <View key={`ce-${m.year}-${m.month}`} style={[s.supportLink, { marginBottom: 6 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.supportTitle}>{m.month}/{m.year}</Text>
                  <Text style={s.supportSub}>{(m.total_coins ?? 0)} coins{m.creator_share_ghs != null ? ` · ${Number(m.creator_share_ghs).toFixed(2)} GHS` : ''}</Text>
                </View>
              </View>
            ))}
            <TouchableOpacity style={[s.goldBtnSm, { marginTop: 8 }]} onPress={() => navigation.getParent()?.navigate('Studio', { screen: 'Earnings' })}>
              <Text style={s.goldBtnText}>All Earnings</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={s.card} onPress={() => Linking.openURL('https://wiamapp.com/dashboard?tab=subscriptions')}>
          <View style={s.cardHead}><Star size={14} color={COLORS.secondary} /><Text style={s.cardTitle}>Subscriptions</Text></View>
          <Text style={s.cardDesc}>Manage your creator subscription tiers on the web dashboard.</Text>
          <Text style={{ color: COLORS.secondary, fontWeight: '600', fontSize: 13 }}>Manage on web →</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.card} onPress={() => Linking.openURL('https://wiamapp.com/dashboard?tab=stories')}>
          <View style={s.cardHead}><ExternalLink size={14} color={COLORS.secondary} /><Text style={s.cardTitle}>Full Web Dashboard</Text></View>
          <Text style={s.cardDesc}>Advanced analytics, payouts, and creator tools.</Text>
          <Text style={{ color: COLORS.secondary, fontWeight: '600', fontSize: 13 }}>Open wiamapp.com →</Text>
        </TouchableOpacity>

        <View style={[s.card, { borderColor: 'rgba(212,168,67,0.15)', backgroundColor: 'rgba(212,168,67,0.03)' }]}>
          <View style={s.cardHead}><Gem size={14} color={COLORS.secondary} /><Text style={s.cardTitle}>Creator Pro</Text></View>
          <Text style={s.cardDesc}>Advanced creator tools, priority support, and analytics — coming soon.</Text>
          <View style={[s.goldBtnSm, { backgroundColor: 'rgba(212,168,67,0.15)' }]}>
            <Text style={[s.goldBtnText, { color: COLORS.secondary }]}>Coming Soon</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderCreatorFollowers = () => {
    if (!creatorGate) return renderOverview();
    if (creatorPanelsLoading && (!creatorFollowers || creatorFollowers.length === 0)) {
      return (
        <View style={s.pad}>
          <View style={s.secHead}><Users size={16} color={COLORS.secondary} /><Text style={s.secTitle}>Followers</Text></View>
          <SkeletonLoader.ListItem count={4} />
        </View>
      );
    }
    if (!creatorFollowers.length) {
      return (
        <View style={s.pad}>
          <View style={s.secHead}><Users size={16} color={COLORS.secondary} /><Text style={s.secTitle}>Followers</Text></View>
          <Text style={s.secSub}>When readers follow you, they show up here.</Text>
        </View>
      );
    }
    return (
      <View style={s.pad}>
        <View style={s.secHead}><Users size={16} color={COLORS.secondary} /><Text style={s.secTitle}>Followers</Text></View>
        <Text style={[s.secSub, { marginBottom: 10 }]}>
          {creatorFollowers.length} follower{creatorFollowers.length === 1 ? '' : 's'}
        </Text>
        {creatorFollowers.map((f, idx) => (
          <View key={`cf-${f.id ?? f.wiam_id ?? idx}`} style={[s.supportLink, { marginBottom: 8 }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.supportTitle}>{f.display_name || f.username || 'Reader'}</Text>
              <Text style={s.supportSub}>@{f.username || 'reader'}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  /* ══════════ ACCOUNT TAB ══════════ */
  const renderAccount = () => (
    <View style={s.pad}>
      <View style={s.secHead}><PenTool size={16} color={COLORS.secondary} /><Text style={s.secTitle}>Account</Text></View>
      <Text style={s.secSub}>Manage your profile and personal information</Text>

      <View style={s.card}>
        <View style={s.cardHead}><Text style={s.cardTitle}>Profile Photo</Text></View>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }} onPress={handlePickAvatar} disabled={uploadingAvatar}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={s.avatarLg} />
          ) : (
            <LetterAvatar name={displayName} size={80} fontSize={28} borderWidth={3} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginBottom: 4 }}>{uploadingAvatar ? 'Uploading...' : 'Tap to upload a new photo'}</Text>
            <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>JPG, PNG or GIF. Max 2MB.</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={s.card}>
        <View style={s.cardHead}><Text style={s.cardTitle}>Personal Information</Text></View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={s.formLbl}>First Name</Text>
            <TextInput style={s.formInput} value={editFirst} onChangeText={setEditFirst} placeholderTextColor={COLORS.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.formLbl}>Last Name</Text>
            <TextInput style={s.formInput} value={editLast} onChangeText={setEditLast} placeholderTextColor={COLORS.textMuted} />
          </View>
        </View>
        <Text style={s.formLbl}>Username</Text>
        <TextInput style={s.formInput} value={editUsername} onChangeText={setEditUsername} placeholder="@username" placeholderTextColor={COLORS.textMuted} autoCapitalize="none" />
        <Text style={s.formLbl}>Bio</Text>
        <TextInput style={[s.formInput, { height: 80, textAlignVertical: 'top' }]} multiline value={editBio} onChangeText={setEditBio} placeholder="About you" placeholderTextColor={COLORS.textMuted} />
        <Text style={s.formLbl}>Pronouns</Text>
        <TextInput style={s.formInput} value={editPronouns} onChangeText={setEditPronouns} placeholder="e.g. she/her, he/him, they/them" placeholderTextColor={COLORS.textMuted} />
        <TouchableOpacity style={[s.goldBtn, { alignSelf: 'stretch', marginTop: 16 }]} onPress={handleSaveProfile} disabled={savingProfile}>
          <Text style={s.goldBtnText}>{savingProfile ? 'Saving...' : 'Save Profile'}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.card}>
        <View style={s.cardHead}><Mail size={14} color={COLORS.secondary} /><Text style={s.cardTitle}>Contact & Identity</Text></View>
        <Text style={s.formLbl}>Email</Text>
        <TextInput style={[s.formInput, { opacity: 0.5 }]} value={user?.email || ''} editable={false} />
        <Text style={s.formLbl}>Phone</Text>
        <TextInput style={s.formInput} value={editPhone} onChangeText={setEditPhone} placeholder="Phone number" placeholderTextColor={COLORS.textMuted} keyboardType="phone-pad" />
        <Text style={s.formLbl}>Date of Birth</Text>
        <TextInput style={[s.formInput, { opacity: 0.5 }]} value={user?.date_of_birth || 'Not set'} editable={false} />
        <Text style={s.formLbl}>Region</Text>
        <TextInput style={[s.formInput, { opacity: 0.5 }]} value={user?.account_region || 'Not set'} editable={false} />
      </View>

      <View style={s.card}>
        <View style={s.cardHead}><Gem size={14} color="#c084fc" /><Text style={s.cardTitle}>Membership</Text></View>
        <View style={s.supportLink}>
          <View style={{ flex: 1 }}>
            <Text style={s.supportTitle}>Premium Status</Text>
            <Text style={s.supportSub}>{(user?.premium_status === 'active' || user?.premium_status === 'trial') ? `Active (${user?.premium_plan || 'Premium'})` : 'Not subscribed'}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('PremiumScreen')}>
            <Text style={{ color: COLORS.secondary, fontSize: 12, fontWeight: '600' }}>Manage</Text>
          </TouchableOpacity>
        </View>
        <View style={[s.supportLink, { marginTop: 6 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.supportTitle}>Coin Balance</Text>
            <Text style={s.supportSub}>{Math.floor(balance || 0)} coins</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Wallet')}>
            <Text style={{ color: COLORS.secondary, fontSize: 12, fontWeight: '600' }}>Wallet</Text>
          </TouchableOpacity>
        </View>
        <View style={[s.supportLink, { marginTop: 6 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.supportTitle}>Date Joined</Text>
            <Text style={s.supportSub}>{user?.date_joined ? new Date(user.date_joined).toLocaleDateString() : '—'}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  /* ══════════ SETTINGS TAB ══════════ */
  const renderSettings = () => {
    const np = settingsData?.notification_preferences || {};
    const pp = settingsData?.privacy_preferences || {};
    return (
      <View style={s.pad}>
        <View style={s.secHead}><Settings size={16} color={COLORS.secondary} /><Text style={s.secTitle}>Settings</Text></View>
        <Text style={s.secSub}>Notifications, privacy, and preferences</Text>

        <View style={s.card}>
          <View style={s.cardHead}><Bell size={14} color={COLORS.secondary} /><Text style={s.cardTitle}>Notifications</Text></View>
          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}><Text style={s.toggleTitle}>Push Notifications</Text><Text style={s.toggleDesc}>Receive push notifications</Text></View>
            <Switch value={settingsPush} onValueChange={(v) => toggleNotificationSetting('push_enabled', v)} trackColor={{ true: COLORS.secondary }} disabled={settingsSyncing} />
          </View>
          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}><Text style={s.toggleTitle}>Email Updates</Text><Text style={s.toggleDesc}>Receive email newsletters</Text></View>
            <Switch value={settingsEmail} onValueChange={(v) => toggleNotificationSetting('email_notifications', v)} trackColor={{ true: COLORS.secondary }} disabled={settingsSyncing} />
          </View>
          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}><Text style={s.toggleTitle}>New Chapters</Text><Text style={s.toggleDesc}>When followed creators publish</Text></View>
            <Switch value={np.new_chapter !== false} onValueChange={(v) => toggleNotificationSetting('new_chapter', v)} trackColor={{ true: COLORS.secondary }} disabled={settingsSyncing} />
          </View>
          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}><Text style={s.toggleTitle}>New Followers</Text><Text style={s.toggleDesc}>When someone follows you</Text></View>
            <Switch value={np.new_follower !== false} onValueChange={(v) => toggleNotificationSetting('new_follower', v)} trackColor={{ true: COLORS.secondary }} disabled={settingsSyncing} />
          </View>
          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}><Text style={s.toggleTitle}>Comments</Text><Text style={s.toggleDesc}>Replies and new comments</Text></View>
            <Switch value={np.comments !== false} onValueChange={(v) => toggleNotificationSetting('comments', v)} trackColor={{ true: COLORS.secondary }} disabled={settingsSyncing} />
          </View>
          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}><Text style={s.toggleTitle}>Likes</Text><Text style={s.toggleDesc}>When someone likes your content</Text></View>
            <Switch value={np.likes !== false} onValueChange={(v) => toggleNotificationSetting('likes', v)} trackColor={{ true: COLORS.secondary }} disabled={settingsSyncing} />
          </View>
          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}><Text style={s.toggleTitle}>Mentions</Text><Text style={s.toggleDesc}>When you are mentioned</Text></View>
            <Switch value={np.mentions !== false} onValueChange={(v) => toggleNotificationSetting('mentions', v)} trackColor={{ true: COLORS.secondary }} disabled={settingsSyncing} />
          </View>
          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}><Text style={s.toggleTitle}>Announcements</Text><Text style={s.toggleDesc}>Platform news and updates</Text></View>
            <Switch value={np.announcements !== false} onValueChange={(v) => toggleNotificationSetting('announcements', v)} trackColor={{ true: COLORS.secondary }} disabled={settingsSyncing} />
          </View>
          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}><Text style={s.toggleTitle}>Coins</Text><Text style={s.toggleDesc}>Coin balance changes</Text></View>
            <Switch value={np.coins !== false} onValueChange={(v) => toggleNotificationSetting('coins', v)} trackColor={{ true: COLORS.secondary }} disabled={settingsSyncing} />
          </View>
          <View style={[s.toggleRow, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1 }}><Text style={s.toggleTitle}>Elite</Text><Text style={s.toggleDesc}>WiamElite story updates</Text></View>
            <Switch value={np.elite !== false} onValueChange={(v) => toggleNotificationSetting('elite', v)} trackColor={{ true: COLORS.secondary }} disabled={settingsSyncing} />
          </View>
        </View>

        <View style={s.card}>
          <View style={s.cardHead}><Volume2 size={14} color={COLORS.secondary} /><Text style={s.cardTitle}>Notification Sound</Text></View>
          <Text style={s.secSub}>Current: {np.sound || 'chime'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['chime', 'bell', 'drop', 'ping', 'marimba'].map((snd) => (
              <TouchableOpacity
                key={snd}
                style={[s.soundChip, (np.sound || 'chime') === snd && s.soundChipActive]}
                onPress={() => toggleNotificationSetting('sound', snd)}
              >
                <Text style={[s.soundChipText, (np.sound || 'chime') === snd && { color: '#000' }]}>{snd}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.card}>
          <View style={s.cardHead}><Eye size={14} color={COLORS.secondary} /><Text style={s.cardTitle}>Privacy</Text></View>
          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}><Text style={s.toggleTitle}>Profile Visible</Text><Text style={s.toggleDesc}>Others can see your profile</Text></View>
            <Switch value={pp.profile_visible !== false} onValueChange={(v) => toggleNotificationSetting('profile_visible', v)} trackColor={{ true: COLORS.secondary }} disabled={settingsSyncing} />
          </View>
          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}><Text style={s.toggleTitle}>Watch activity</Text><Text style={s.toggleDesc}>Show what you're watching</Text></View>
            <Switch value={pp.show_reading_activity !== false} onValueChange={(v) => toggleNotificationSetting('show_reading_activity', v)} trackColor={{ true: COLORS.secondary }} disabled={settingsSyncing} />
          </View>
          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}><Text style={s.toggleTitle}>Show Library</Text><Text style={s.toggleDesc}>Others can see your library</Text></View>
            <Switch value={pp.show_library !== false} onValueChange={(v) => toggleNotificationSetting('show_library', v)} trackColor={{ true: COLORS.secondary }} disabled={settingsSyncing} />
          </View>
          <View style={[s.toggleRow, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1 }}><Text style={s.toggleTitle}>Show Favorites</Text><Text style={s.toggleDesc}>Others can see your favorites</Text></View>
            <Switch value={pp.show_favorites === true} onValueChange={(v) => toggleNotificationSetting('show_favorites', v)} trackColor={{ true: COLORS.secondary }} disabled={settingsSyncing} />
          </View>
        </View>
      </View>
    );
  };

  /* ══════════ SECURITY TAB ══════════ */
  const renderSecurity = () => (
    <View style={s.pad}>
      <View style={s.secHead}><Lock size={16} color={COLORS.secondary} /><Text style={s.secTitle}>Security</Text></View>
      <Text style={s.secSub}>Password, authentication, and account safety</Text>

      <View style={s.card}>
        <View style={s.cardHead}><ShieldCheck size={14} color={COLORS.secondary} /><Text style={s.cardTitle}>Change Password</Text></View>
        <Text style={s.formLbl}>Current Password</Text>
        <TextInput style={s.formInput} secureTextEntry value={currentPw} onChangeText={setCurrentPw} placeholder="Current password" placeholderTextColor={COLORS.textMuted} />
        <Text style={s.formLbl}>New Password</Text>
        <TextInput style={s.formInput} secureTextEntry value={newPw} onChangeText={setNewPw} placeholder="New password" placeholderTextColor={COLORS.textMuted} />
        <Text style={s.formLbl}>Confirm</Text>
        <TextInput style={s.formInput} secureTextEntry value={confirmPw} onChangeText={setConfirmPw} placeholder="Confirm password" placeholderTextColor={COLORS.textMuted} />
        <TouchableOpacity style={s.goldBtnSm} onPress={handleChangePassword} disabled={savingPw}>
          <Text style={s.goldBtnText}>{savingPw ? 'Updating...' : 'Update Password'}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.card}>
        <View style={s.cardHead}><Fingerprint size={14} color={COLORS.secondary} /><Text style={s.cardTitle}>Two-Factor Authentication</Text></View>
        <Text style={s.cardDesc}>{user?.two_factor_enabled ? 'Enabled — your account has extra protection.' : 'Not enabled yet. Enable 2FA for extra security.'}</Text>
        <View style={[s.goldBtnSm, { backgroundColor: 'rgba(212,168,67,0.15)' }]}>
          <Text style={[s.goldBtnText, { color: COLORS.secondary }]}>Coming Soon</Text>
        </View>
      </View>

      <View style={s.card}>
        <View style={s.cardHead}><ShieldAlert size={14} color="#f59e0b" /><Text style={s.cardTitle}>Account Warnings</Text></View>
        <Text style={s.cardDesc}>View any warnings or restrictions on your account.</Text>
        <TouchableOpacity style={s.goldBtnSm} onPress={() => navigation.navigate('AccountSafety')}>
          <Text style={s.goldBtnText}>View Warnings</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[s.card, { borderColor: 'rgba(248,113,113,0.2)' }]} onPress={handleLogout}>
        <View style={s.cardHead}><LogOut size={14} color="#f87171" /><Text style={[s.cardTitle, { color: '#f87171' }]}>Log Out</Text></View>
        <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>Sign out of your account on this device.</Text>
      </TouchableOpacity>

      <View style={[s.card, { borderColor: 'rgba(231,76,60,0.2)' }]}>
        <View style={s.cardHead}><ShieldAlert size={14} color="#e74c3c" /><Text style={[s.cardTitle, { color: '#e74c3c' }]}>Delete Account</Text></View>
        <Text style={{ color: COLORS.textMuted, fontSize: 12, marginBottom: 8 }}>This action is permanent and cannot be undone.</Text>
        <Text style={s.formLbl}>Enter your password to confirm</Text>
        <TextInput style={s.formInput} secureTextEntry value={deletePw} onChangeText={setDeletePw} placeholder="Password" placeholderTextColor={COLORS.textMuted} />
        <TouchableOpacity style={[s.goldBtnSm, { backgroundColor: '#e74c3c' }]} onPress={handleDeleteAccount}>
          <Text style={s.goldBtnText}>Delete My Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  /* ══════════ SUPPORT TAB ══════════ */
  const renderSupport = () => (
    <View style={s.pad}>
      <View style={s.secHead}><Info size={16} color={COLORS.secondary} /><Text style={s.secTitle}>Support</Text></View>
      <Text style={s.secSub}>Help, feedback, and legal information</Text>

      <View style={s.card}>
        <SupportLink icon={Info} title="Help Center" sub="FAQs, guides & live chat support" color="#38bdf8" onPress={() => navigation.navigate('HelpCenter')} />
        <SupportLink icon={MessageSquare} title="Send Feedback" sub="Report bugs or suggest features" color="#34d399" onPress={() => navigation.navigate('Feedback')} />
      </View>

      <View style={s.card}>
        <View style={s.cardHead}><FileText size={14} color={COLORS.secondary} /><Text style={s.cardTitle}>Legal</Text></View>
        <SupportLink icon={FileText} title="Terms & Conditions" sub="Platform rules and usage terms" color="#facc15" onPress={() => Linking.openURL('https://wiamapp.com/terms')} />
        <SupportLink icon={ShieldCheck} title="Privacy Policy" sub="How we protect your data" color="#4ade80" onPress={() => Linking.openURL('https://wiamapp.com/privacy')} />
        <SupportLink icon={Users} title="Community Guidelines" sub="Rules for creators & readers" color="#a78bfa" onPress={() => Linking.openURL('https://wiamapp.com/community-guidelines')} />
        <SupportLink icon={Fingerprint} title="Privacy Center" sub="Data handling & protection" color="#06b6d4" onPress={() => Linking.openURL('https://wiamapp.com/privacy')} />
      </View>

      <View style={s.card}>
        <View style={s.cardHead}><Info size={14} color={COLORS.secondary} /><Text style={s.cardTitle}>About</Text></View>
        <SupportLink icon={Info} title="About WiamLabs" sub="Our mission, team & story" color={COLORS.secondary} onPress={() => Linking.openURL('https://wiamapp.com/about')} />
        <SupportLink icon={Briefcase} title="Careers" sub="Join the WiamLabs team" color="#38bdf8" onPress={() => navigation.navigate('Careers')} />
        <View style={[s.supportLink, { marginBottom: 0 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.supportTitle}>App Version</Text>
            <Text style={s.supportSub}>WiamApp v1.0.0</Text>
          </View>
        </View>
      </View>
    </View>
  );

  /* ══════════ FOLLOWING TAB ══════════ */
  const renderFollowing = () => {
    const loadFollowing = async () => {
      setFollowingLoading(true);
      try {
        const res = await authApi.getFollowing();
        setFollowingList(res?.following || []);
      } catch { /* ignore */ }
      finally { setFollowingLoading(false); }
    };

    if (followingLoading && followingList.length === 0) {
      return (
        <View style={s.pad}>
          <View style={s.secHead}><UserPlus size={16} color={COLORS.secondary} /><Text style={s.secTitle}>Following</Text></View>
          <SkeletonLoader.ListItem count={4} />
        </View>
      );
    }

    return (
      <View style={s.pad}>
        <View style={s.secHead}><UserPlus size={16} color={COLORS.secondary} /><Text style={s.secTitle}>Following</Text></View>
        <Text style={s.secSub}>Creators you follow ({followingList.length})</Text>

        {followingList.length === 0 ? (
          <View style={s.emptyWrap}>
            <UserPlus size={40} color={COLORS.textMuted} />
            <Text style={s.emptyTitle}>You're not following anyone yet.</Text>
            <Text style={{ color: COLORS.textMuted, fontSize: 12, marginBottom: 16, textAlign: 'center' }}>
              Follow your favorite creators to see their updates in your Bulletin feed.
            </Text>
            <TouchableOpacity style={s.goldBtn} onPress={() => navigation.navigate('Browse')}>
              <Text style={s.goldBtnText}>Discover Creators</Text>
            </TouchableOpacity>
          </View>
        ) : (
          followingList.map((c, idx) => (
            <TouchableOpacity
              key={`fol-${c.id ?? c.wiam_id ?? idx}`}
              style={[s.supportLink, { marginBottom: 8 }]}
              onPress={() => navigation.navigate('CreatorProfile', { creatorId: c.wiam_id || c.id })}
            >
              {c.avatar_url ? (
                <CachedImage source={{ uri: c.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20 }} />
              ) : (
                <LetterAvatar name={c.display_name || c.username || 'Creator'} size={40} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.supportTitle}>{c.display_name || c.username || 'Creator'}</Text>
                <Text style={s.supportSub}>@{c.username || 'creator'} · {c.follower_count ?? 0} followers</Text>
              </View>
              <ChevronRight size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))
        )}
      </View>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'account':
        return renderAccount();
      case 'settings':
        return renderSettings();
      case 'security':
        return renderSecurity();
      case 'support':
        return renderSupport();
      case 'following':
        return renderFollowing();
      case 'creatorHub':
        return renderCreatorHub();
      case 'creatorFollowers':
        return renderCreatorFollowers();
      default:
        return renderOverview();
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={[s.container, { paddingTop: insets.top + 24, paddingHorizontal: 24 }]}>
        <Text style={{ color: COLORS.text, fontFamily: FONTS.display, fontSize: 28, marginBottom: 8 }}>
          Your profile
        </Text>
        <Text style={{ color: COLORS.textMuted, lineHeight: 20, marginBottom: 24 }}>
          You are browsing as a guest. Account screens will return with the new WiamEpisio auth design.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}
      contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 8, paddingBottom: 24 }}>

      <View style={s.profileRow}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={s.avatar} />
        ) : (
          <LetterAvatar name={displayName} size={44} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.profileName}>{user?.display_name || 'Reader'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <View style={[s.rolePill, { backgroundColor: roleBadge.bg }]}>
              <Text style={[s.rolePillText, { color: roleBadge.color }]}>{roleBadge.label}</Text>
            </View>
            <Text style={s.profileRole}>{user?.email || ''}</Text>
          </View>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabsRow}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[
              s.tab,
              activeTab === t.key && s.tabActive,
              t.special && activeTab === t.key && { borderColor: t.special.borderColor },
            ]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[
              s.tabText,
              activeTab === t.key && s.tabTextActive,
              t.special && activeTab === t.key && { color: t.special.color },
            ]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {renderTabContent()}

      <View style={{ marginTop: 'auto', paddingTop: 24 }}>
        <BrandedFooter compact />
      </View>

      <CircularCropModal
        visible={showCrop}
        imageUri={cropUri}
        onCancel={() => { setShowCrop(false); setCropUri(null); }}
        onSave={handleCropSave}
      />
    </ScrollView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  profileRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2, borderColor: 'rgba(212,168,67,0.5)',
    backgroundColor: 'rgba(212,168,67,0.15)',
  },
  avatarInitials: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(212,168,67,0.5)',
    backgroundColor: COLORS.secondary,
  },
  avatarInitialsText: { fontSize: 16, fontWeight: '700', color: '#000' },
  profileName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  profileRole: { fontSize: 11, color: COLORS.textMuted },
  rolePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  rolePillText: { fontSize: 10, fontWeight: '700' },
  tabsRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 6 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  tabActive: {
    backgroundColor: 'rgba(212,168,67,0.15)',
    borderColor: 'rgba(212,168,67,0.3)',
  },
  tabText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  tabTextActive: { color: COLORS.secondary },
  pad: { paddingHorizontal: 16, paddingTop: 12 },
  secHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  secTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  secSub: { fontSize: 13, color: COLORS.textMuted, marginBottom: 20 },
  qlRow: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  ql: {
    alignItems: 'center', gap: 3, paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', minWidth: 60,
  },
  qlText: { fontSize: 9, color: COLORS.textMuted },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  stat: {
    width: (width - 32 - 12) / 2,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14,
    padding: 18, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  statVal: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  statLbl: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  card: {
    backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: 16, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  cardDesc: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 14 },
  goldBtn: {
    backgroundColor: COLORS.secondary, borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 20, alignItems: 'center',
    alignSelf: 'flex-start', marginTop: 4,
  },
  goldBtnSm: {
    backgroundColor: COLORS.secondary, borderRadius: 10,
    paddingVertical: 6, paddingHorizontal: 14, alignItems: 'center',
    alignSelf: 'flex-start', marginTop: 4,
  },
  goldBtnText: { color: '#000', fontWeight: '600', fontSize: 13 },
  supportLink: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
  },
  supportTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  supportSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  bookGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridBook: { width: (width - 32 - 40 - 24) / 3 },
  gridCover: {
    width: '100%', aspectRatio: 2 / 3, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  gridTitle: { fontSize: 11, fontWeight: '600', color: COLORS.text, marginTop: 6, lineHeight: 14 },
  libBook: { width: 120, marginRight: 12 },
  libCover: { width: 120, height: 180, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' },
  libPh: { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(114,47,55,0.3)' },
  libTitle: { fontSize: 11, fontWeight: '500', color: COLORS.text, marginTop: 6 },
  libMeta: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  formLbl: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 12 },
  formInput: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, color: COLORS.text, fontSize: 14,
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  toggleTitle: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  toggleDesc: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  avatarLg: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: COLORS.secondary },
  avatarInitialsLg: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.secondary,
    borderWidth: 3, borderColor: 'rgba(212,168,67,0.5)',
  },
  initialsText: { fontSize: 28, fontWeight: '700', color: '#000' },
  soundChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  soundChipActive: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  soundChipText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, textTransform: 'capitalize' },
  emptyWrap: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { color: COLORS.textMuted, fontSize: 14, marginTop: 12, marginBottom: 16 },
  footer: { paddingVertical: 30, alignItems: 'center' },
  footerText: { fontSize: 11, color: COLORS.textMuted, letterSpacing: 1 },
});

export default ProfileScreen;