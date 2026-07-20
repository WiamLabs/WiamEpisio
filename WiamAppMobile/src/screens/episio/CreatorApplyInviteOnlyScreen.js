/**
 * Layout: WiamEpisio-Creator-Apply-Intro-InviteOnly.html
 * Keyboard avoids covering waitlist / invite fields.
 */
import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { X, Lock, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import useAuthStore from '../../store/useAuthStore';

const CreatorApplyInviteOnlyScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const patchUser = useAuthStore((s) => s.patchUser);
  const scrollRef = useRef(null);
  const [email, setEmail] = useState('');
  const [workLink, setWorkLink] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [busy, setBusy] = useState(false);

  const scrollToEnd = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 120);
  };

  const joinWaitlist = async () => {
    if (!email.trim()) {
      Alert.alert('Waitlist', 'Email is required');
      return;
    }
    setBusy(true);
    try {
      await studioEpisioApi.joinWaitlist({ email: email.trim(), work_link: workLink.trim() });
      Keyboard.dismiss();
      Alert.alert("You're on the list", "We'll reach out when applications open or if we invite you sooner.");
      navigation.goBack();
    } catch (e) {
      Alert.alert('Waitlist', e?.message || 'Could not join');
    } finally {
      setBusy(false);
    }
  };

  const useInvite = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Invite', 'Enter your invite code');
      return;
    }
    setBusy(true);
    try {
      const data = await studioEpisioApi.redeemInvite(inviteCode.trim());
      try {
        await patchUser({ is_creator: true, creator_application_status: 'accepted' });
        const me = await (await import('../../api/auth')).default.me();
        if (me?.user) await patchUser(me.user);
        else if (me?.is_creator != null) await patchUser(me);
      } catch { /* still open studio */ }
      Keyboard.dismiss();
      Alert.alert(
        'Studio unlocked',
        data?.message || 'Welcome to WiamStudio. Complete your public channel profile next.',
        [{
          text: 'Open Studio',
          onPress: () => navigation.replace('StudioHome'),
        }],
      );
    } catch (e) {
      Alert.alert('Invite', e?.message || 'Invalid or used invite code');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <LinearGradient colors={['#1a1030', COLORS.navy]} style={styles.hero}>
        <TouchableOpacity style={styles.close} onPress={() => navigation.goBack()}>
          <X size={16} color="#fff" />
        </TouchableOpacity>
        <View style={styles.badge}>
          <Lock size={12} color={COLORS.gold} />
          <Text style={styles.badgeText}>INVITE ONLY</Text>
        </View>
        <Text style={styles.h1}>WiamStudio is by invitation right now</Text>
        <Text style={styles.heroP}>We're keeping the first wave small on purpose.</Text>
      </LinearGradient>

      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          padding: 20,
          paddingBottom: Math.max(insets.bottom, 24) + 120,
        }}
      >
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Applications aren't open yet</Text>
          <Text style={styles.statusText}>
            We're personally reviewing every creator in this first phase to set the quality bar —
            finished seasons, strong trailer, and full QC — before opening WiamStudio to everyone.
          </Text>
        </View>

        <Text style={styles.whyTitle}>Why we're doing it this way</Text>
        {[
          'Every series on WiamEpisio must be finished, well-shot, and worth a viewer\'s time.',
          'Standards we set now become the rules that scale later.',
          'Public applications open once we can review at scale.',
        ].map((t) => (
          <View key={t} style={styles.whyItem}>
            <Check size={14} color={COLORS.gold} />
            <Text style={styles.whyText}>{t}</Text>
          </View>
        ))}

        <View style={styles.waitlist}>
          <Text style={styles.waitTitle}>Join the waitlist</Text>
          <Text style={styles.waitSub}>We'll reach out when applications open, or invite you sooner.</Text>
          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor={COLORS.textFaint}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            onFocus={scrollToEnd}
          />
          <TextInput
            style={styles.input}
            placeholder="Link to your work (optional)"
            placeholderTextColor={COLORS.textFaint}
            value={workLink}
            onChangeText={setWorkLink}
            autoCapitalize="none"
            onFocus={scrollToEnd}
          />
          <TouchableOpacity style={styles.btn} onPress={joinWaitlist} disabled={busy}>
            {busy ? <ActivityIndicator color={COLORS.navy} /> : (
              <Text style={styles.btnText}>Join Waitlist</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => { setShowCode((v) => !v); setTimeout(scrollToEnd, 50); }}>
          <Text style={styles.haveCode}>
            Already have an invite code? <Text style={{ color: COLORS.gold }}>Enter it here</Text>
          </Text>
        </TouchableOpacity>
        {showCode ? (
          <View style={{ marginTop: 12, marginBottom: 40 }}>
            <TextInput
              style={styles.input}
              placeholder="Invite code"
              placeholderTextColor={COLORS.textFaint}
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              onFocus={scrollToEnd}
            />
            <TouchableOpacity style={styles.btn} onPress={useInvite} disabled={busy}>
              <Text style={styles.btnText}>Continue with invite</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  hero: { paddingHorizontal: 20, paddingBottom: 28, paddingTop: 8 },
  close: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end',
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: 'rgba(212,160,23,0.15)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginTop: 16,
  },
  badgeText: { color: COLORS.gold, fontFamily: FONTS.extraBold, fontSize: 10, letterSpacing: 0.8 },
  h1: { marginTop: 14, fontSize: 22, fontFamily: FONTS.extraBold, color: '#fff', lineHeight: 28 },
  heroP: { marginTop: 8, fontSize: 13, color: COLORS.textDim, fontFamily: FONTS.regular },
  statusCard: {
    backgroundColor: COLORS.navyCard, borderRadius: 16, borderWidth: 1, borderColor: COLORS.navyLine, padding: 16, marginBottom: 18,
  },
  statusTitle: { fontSize: 13.5, fontFamily: FONTS.extraBold, color: '#fff', marginBottom: 8 },
  statusText: { fontSize: 12, color: COLORS.textDim, lineHeight: 18, fontFamily: FONTS.regular },
  whyTitle: {
    fontSize: 12, fontFamily: FONTS.extraBold, color: COLORS.textDim,
    letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 10,
  },
  whyItem: { flexDirection: 'row', gap: 9, marginBottom: 10 },
  whyText: { flex: 1, fontSize: 12, color: '#D9D9E8', lineHeight: 18, fontFamily: FONTS.regular },
  waitlist: {
    marginTop: 16, backgroundColor: COLORS.navyCard, borderRadius: 16, borderWidth: 1,
    borderColor: COLORS.navyLine, padding: 16, marginBottom: 16,
  },
  waitTitle: { fontSize: 14, fontFamily: FONTS.extraBold, color: '#fff' },
  waitSub: { marginTop: 6, marginBottom: 14, fontSize: 12, color: COLORS.textDim, lineHeight: 17, fontFamily: FONTS.regular },
  input: {
    backgroundColor: COLORS.navySoft, borderRadius: 12, borderWidth: 1, borderColor: COLORS.navyLine,
    color: COLORS.text, fontFamily: FONTS.regular, fontSize: 13.5, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10,
  },
  btn: { backgroundColor: COLORS.gold, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnText: { fontFamily: FONTS.extraBold, color: COLORS.navy, fontSize: 14 },
  haveCode: { textAlign: 'center', color: COLORS.textDim, fontFamily: FONTS.semi, fontSize: 12.5 },
});

export default CreatorApplyInviteOnlyScreen;
