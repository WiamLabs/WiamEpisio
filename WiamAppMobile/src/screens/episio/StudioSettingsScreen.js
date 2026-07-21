/**
 * Studio Settings + full public channel profile editor.
 * Layout: WiamStudio-Settings.html + public card fields for Creator Public Profile.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  ChevronRight, FileText, HelpCircle, Star, Wallet, Banknote, LogOut,
} from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';
import useAuthStore from '../../store/useAuthStore';
import studioEpisioApi from '../../api/studioEpisio';
import resolveUrl from '../../utils/resolveUrl';
import { pickCroppedImage } from '../../utils/pickMedia';

const Row = ({ icon: Icon, label, value, onPress, tag }) => (
  <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress}>
    <View style={styles.rowIcon}>
      <Icon size={15} color={COLORS.textDim} />
    </View>
    <Text style={styles.rowLabel}>{label}</Text>
    {tag ? <Text style={styles.statusTag}>{tag}</Text> : null}
    {value ? <Text style={styles.rowValue}>{value}</Text> : null}
    {onPress ? <ChevronRight size={14} color={COLORS.textFaint} /> : null}
  </TouchableOpacity>
);

const Field = ({ label, value, onChange, placeholder, multiline }) => (
  <View style={styles.fieldWrap}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[styles.fieldInput, multiline && styles.fieldMulti]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textFaint}
      multiline={!!multiline}
    />
  </View>
);

const StudioSettingsScreen = () => {
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [tier, setTier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    channel_name: '',
    tagline: '',
    bio: '',
    country: '',
    city: '',
    website_url: '',
    instagram: '',
    tiktok: '',
    youtube: '',
    twitter_x: '',
    facebook: '',
    avatar_url: '',
    banner_url: '',
    contact_email_public: '',
    genres: '',
  });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      studioEpisioApi.trustTier().catch(() => null),
      studioEpisioApi.getStudioProfile().catch(() => null),
    ]).then(([t, p]) => {
      setTier(t);
      const pr = p?.profile || {};
      setProfile({
        channel_name: pr.channel_name || user?.display_name || '',
        tagline: pr.tagline || '',
        bio: pr.bio || user?.bio || '',
        country: pr.country || '',
        city: pr.city || '',
        website_url: pr.website_url || '',
        instagram: pr.instagram || '',
        tiktok: pr.tiktok || '',
        youtube: pr.youtube || '',
        twitter_x: pr.twitter_x || '',
        facebook: pr.facebook || '',
        avatar_url: pr.avatar_url || '',
        banner_url: pr.banner_url || '',
        contact_email_public: pr.contact_email_public || '',
        genres: Array.isArray(pr.genres) ? pr.genres.join(', ') : (pr.genres || ''),
      });
    }).finally(() => setLoading(false));
  }, [user?.display_name, user?.bio]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pickAndUpload = async (kind) => {
    const uri = await pickCroppedImage(kind === 'banner' ? 'banner' : 'avatar');
    if (!uri) return;
    setSaving(true);
    try {
      if (kind === 'avatar') {
        const data = await studioEpisioApi.uploadChannelAvatar(uri);
        setProfile((p) => ({ ...p, avatar_url: data?.avatar_url || p.avatar_url }));
      } else {
        const data = await studioEpisioApi.uploadChannelBanner(uri);
        setProfile((p) => ({ ...p, banner_url: data?.banner_url || p.banner_url }));
      }
      Alert.alert('Uploaded', kind === 'avatar' ? 'Channel photo updated.' : 'Channel banner updated.');
    } catch (e) {
      Alert.alert('Upload', e?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async () => {
    if (!profile.channel_name.trim()) {
      Alert.alert('Channel name', 'Your public channel name is required.');
      return;
    }
    if (!profile.avatar_url || !profile.banner_url) {
      Alert.alert(
        'Channel media required',
        'Upload a profile photo and a channel banner so your page looks professional.',
      );
      return;
    }
    setSaving(true);
    try {
      const genres = profile.genres.split(',').map((g) => g.trim()).filter(Boolean);
      await studioEpisioApi.patchStudioProfile({
        ...profile,
        genres,
      });
      Alert.alert('Saved', 'Your public creator profile is updated.');
    } catch (e) {
      Alert.alert('Save failed', e?.message || 'Try again');
    } finally {
      setSaving(false);
    }
  };

  const displayName = profile.channel_name || user?.display_name || user?.username || 'Creator';
  const initial = (displayName[0] || 'C').toUpperCase();
  const tierLabel = {
    new: 'New Creator',
    rising: 'Rising Creator',
    trusted: 'Trusted Creator',
    elite: 'Elite Creator',
  }[tier?.tier || 'new'];

  return (
    <EpisioScreenShell
      title="Studio Settings"
      subtitle="Channel & payouts"
      footer={(
        <EpisioGoldButton label="Save public profile" onPress={saveProfile} loading={saving} />
      )}
    >
      <View style={styles.studioCard}>
        <TouchableOpacity style={styles.avatar} onPress={() => pickAndUpload('avatar')}>
          {profile.avatar_url ? (
            <Image source={{ uri: resolveUrl(profile.avatar_url) }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>{initial}</Text>
          )}
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{displayName}</Text>
          <Text style={styles.cardSub}>
            @{user?.username || 'creator'} · {tierLabel}
          </Text>
          <Text style={styles.tapHint}>Tap photo · crop square first</Text>
        </View>
      </View>

      <Text style={styles.groupTitle}>Channel banner (required)</Text>
      <TouchableOpacity style={styles.bannerBox} onPress={() => pickAndUpload('banner')} activeOpacity={0.9}>
        {profile.banner_url ? (
          <Image source={{ uri: resolveUrl(profile.banner_url) }} style={styles.bannerImg} />
        ) : (
          <Text style={styles.bannerHint}>Upload a wide banner · crop 16:9 first</Text>
        )}
      </TouchableOpacity>
      {profile.banner_url ? (
        <TouchableOpacity
          onPress={async () => {
            try {
              await studioEpisioApi.deleteChannelBanner();
              setProfile((p) => ({ ...p, banner_url: '' }));
            } catch (e) {
              Alert.alert('Delete', e?.message || 'Failed');
            }
          }}
        >
          <Text style={styles.deleteLink}>Remove banner</Text>
        </TouchableOpacity>
      ) : null}

      <Text style={styles.groupTitle}>Public channel (viewers see this)</Text>
      <View style={styles.formCard}>
        <Field label="Channel name" value={profile.channel_name} onChange={(v) => setProfile((p) => ({ ...p, channel_name: v }))} placeholder="Your studio / channel name" />
        <Field label="Tagline" value={profile.tagline} onChange={(v) => setProfile((p) => ({ ...p, tagline: v }))} placeholder="One-line hook for your page" />
        <Field label="Bio" value={profile.bio} onChange={(v) => setProfile((p) => ({ ...p, bio: v }))} placeholder="Tell viewers who you are" multiline />
        <Field label="Genres" value={profile.genres} onChange={(v) => setProfile((p) => ({ ...p, genres: v }))} placeholder="Romance, Thriller, Comedy" />
        <Field label="Country" value={profile.country} onChange={(v) => setProfile((p) => ({ ...p, country: v }))} placeholder="Your country" />
        <Field label="City" value={profile.city} onChange={(v) => setProfile((p) => ({ ...p, city: v }))} placeholder="City" />
        <Field label="Website" value={profile.website_url} onChange={(v) => setProfile((p) => ({ ...p, website_url: v }))} placeholder="https://" />
        <Field label="Instagram" value={profile.instagram} onChange={(v) => setProfile((p) => ({ ...p, instagram: v }))} placeholder="@handle or URL" />
        <Field label="TikTok" value={profile.tiktok} onChange={(v) => setProfile((p) => ({ ...p, tiktok: v }))} placeholder="@handle or URL" />
        <Field label="YouTube" value={profile.youtube} onChange={(v) => setProfile((p) => ({ ...p, youtube: v }))} placeholder="Channel URL" />
        <Field label="X / Twitter" value={profile.twitter_x} onChange={(v) => setProfile((p) => ({ ...p, twitter_x: v }))} placeholder="@handle" />
        <Field label="Facebook" value={profile.facebook} onChange={(v) => setProfile((p) => ({ ...p, facebook: v }))} placeholder="Page URL" />
        <Field label="Public contact email" value={profile.contact_email_public} onChange={(v) => setProfile((p) => ({ ...p, contact_email_public: v }))} placeholder="Optional" />
        {user?.id ? (
          <TouchableOpacity
            style={styles.previewLink}
            onPress={() => navigation.navigate('CreatorPublicProfile', { creatorId: user.id })}
          >
            <Text style={styles.previewLinkText}>Preview public profile</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={styles.groupTitle}>Publishing help</Text>
      <View style={styles.rowCard}>
        <Row icon={FileText} label="Specs guide" onPress={() => navigation.navigate('StudioSpecs')} />
        <Row icon={HelpCircle} label="Quality & review help" onPress={() => navigation.navigate('StudioHelpQuality')} />
        <Row icon={Star} label="Creator Trust Tier" value={tierLabel} onPress={() => navigation.navigate('CreatorTrustTier')} />
      </View>

      <Text style={styles.groupTitle}>Payouts</Text>
      <View style={styles.rowCard}>
        <Row icon={Wallet} label="Identity Verification" tag={user?.is_creator ? 'OPEN' : undefined} onPress={() => navigation.navigate('StudioPayoutKyc')} />
        <Row icon={Banknote} label="Bank account for payouts" onPress={() => navigation.navigate('StudioPayoutKyc')} />
        <Row icon={Banknote} label="Earnings overview" onPress={() => navigation.navigate('StudioEarnings', {})} />
      </View>

      {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 16 }} /> : null}

      <TouchableOpacity
        style={styles.signoutBtn}
        onPress={() => {
          logout();
          navigation.navigate('Main');
        }}
      >
        <LogOut size={16} color="#E4573D" style={{ marginRight: 8 }} />
        <Text style={styles.signoutText}>Exit WiamStudio</Text>
      </TouchableOpacity>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  studioCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.navyCard,
    borderRadius: 16, padding: 14, borderWidth: 1, borderColor: COLORS.navyLine, marginBottom: 18,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg: { width: 48, height: 48 },
  avatarText: { fontFamily: FONTS.bold, color: COLORS.navy, fontSize: 18 },
  cardName: { color: '#fff', fontFamily: FONTS.bold, fontSize: 16 },
  cardSub: { color: COLORS.textDim, fontFamily: FONTS.regular, fontSize: 12, marginTop: 2 },
  tapHint: { color: COLORS.gold, fontFamily: FONTS.medium, fontSize: 10, marginTop: 4 },
  bannerBox: {
    height: 110, borderRadius: 14, overflow: 'hidden', marginBottom: 8,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    alignItems: 'center', justifyContent: 'center',
  },
  bannerImg: { width: '100%', height: '100%' },
  bannerHint: { color: COLORS.textFaint, fontFamily: FONTS.medium, fontSize: 12, paddingHorizontal: 16, textAlign: 'center' },
  deleteLink: { color: '#EF4444', fontFamily: FONTS.medium, fontSize: 12, marginBottom: 14 },
  groupTitle: { color: COLORS.textFaint, fontFamily: FONTS.semi, fontSize: 11, marginBottom: 8, textTransform: 'uppercase' },
  formCard: {
    backgroundColor: COLORS.navyCard, borderRadius: 16, padding: 14, marginBottom: 18,
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  fieldWrap: { marginBottom: 12 },
  fieldLabel: { color: COLORS.textDim, fontFamily: FONTS.medium, fontSize: 11, marginBottom: 6 },
  fieldInput: {
    backgroundColor: COLORS.navy, borderRadius: 12, borderWidth: 1, borderColor: COLORS.navyLine,
    color: '#fff', paddingHorizontal: 12, paddingVertical: 10, fontFamily: FONTS.regular, fontSize: 13.5,
  },
  fieldMulti: { minHeight: 80, textAlignVertical: 'top' },
  previewLink: { marginTop: 4, alignItems: 'center' },
  previewLinkText: { color: COLORS.gold, fontFamily: FONTS.semi, fontSize: 13 },
  rowCard: {
    backgroundColor: COLORS.navyCard, borderRadius: 16, marginBottom: 16,
    borderWidth: 1, borderColor: COLORS.navyLine, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.navyLine,
  },
  rowIcon: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.navy,
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { flex: 1, color: '#fff', fontFamily: FONTS.medium, fontSize: 14 },
  rowValue: { color: COLORS.textDim, fontFamily: FONTS.regular, fontSize: 12, marginRight: 4 },
  statusTag: {
    color: COLORS.gold, fontFamily: FONTS.semi, fontSize: 10, marginRight: 6,
    borderWidth: 1, borderColor: COLORS.gold, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  signoutBtn: {
    marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E4573D55',
  },
  signoutText: { color: '#E4573D', fontFamily: FONTS.semi },
});

export default StudioSettingsScreen;
