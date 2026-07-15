// © 2026 WiamApp. Powered by WiamLabs
// screens/ChatScreen.js — PRODUCTION real-time Supabase messages

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, FlatList,
  TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  useAudioRecorder,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
} from 'expo-audio';
import { Colors } from '../constants/colors';
import { useAuth } from '../lib/AuthContext';
import { getMessages, sendMessage, sendVoiceMessage, markMessagesAsRead, subscribeToMessages } from '../lib/api/messages';
import { supabase } from '../lib/supabase';
import GoldAvatar from '../components/ui/GoldAvatar';
import VerifiedBadge from '../components/VerifiedBadge';

const PAD   = Colors.screenPad;
const RED   = Colors.error;

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function ChatScreen({ navigation, route }) {
  const { bookingId, workerName, workerId } = route.params || {};
  const { user } = useAuth();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [messages,  setMessages]  = useState([]);
  const [text,      setText]      = useState('');
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(false);
  const [otherParty, setOtherParty] = useState({ verifiedBadge: false, subscriptionTier: null, userId: null });
  const flatRef = useRef(null);

  // Voice recording state
  const [isRecording,     setIsRecording]     = useState(false);
  const [recordingMillis, setRecordingMillis] = useState(0);
  const [sendingVoice,    setSendingVoice]    = useState(false);
  const recordingTimer = useRef(null);

  // Determine receiver ID
  // otherParty.userId is fetched directly from the booking (see the
  // useEffect below) and is always correct — workerId from route
  // params is optional and often missing, so it's no longer the
  // source of truth for who the message actually goes to.
  const receiverId = otherParty.userId || workerId || null;

  // Fetch the other party's badge status directly from the booking —
  // never trusted purely from navigation params, since those can be
  // stale (e.g. a badge earned/lost since the chat list was last
  // loaded). Section 8B requires the badge to be visible here.
  useEffect(() => {
    if (!bookingId || !user?.id) return;
    supabase
      .from('bookings')
      .select(`
        customer_id, worker_id, business_id,
        worker_profiles (verified_badge, subscription_tier, user_id)
      `)
      .eq('id', bookingId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const isCustomer = data.customer_id === user.id;
        const otherUserId = isCustomer
          ? data.worker_profiles?.user_id
          : (data.business_id || data.customer_id);
        if (isCustomer) {
          setOtherParty({
            verifiedBadge: data.worker_profiles?.verified_badge || false,
            subscriptionTier: data.worker_profiles?.subscription_tier || null,
            userId: otherUserId,
          });
        } else {
          setOtherParty({ verifiedBadge: false, subscriptionTier: null, userId: otherUserId });
        }
        // Customers never carry a Checkmark badge (Section 4B), so
        // when the current user IS the worker, otherParty stays at
        // the default false/null — correct, no badge to show.
      })
      .catch(() => {});
  }, [bookingId, user?.id]);

  const handleChatMenu = () => {
    Alert.alert(workerName || 'Chat options', '', [
      {
        text: 'Block this person',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Block ' + (workerName || 'this person') + '?',
            'They will no longer be able to message or book you. You can unblock them anytime from Settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Block',
                style: 'destructive',
                onPress: async () => {
                  if (!otherParty.userId) {
                    Alert.alert('Error', 'Could not identify this user. Try again.');
                    return;
                  }
                  try {
                    await supabase.from('user_blocks').insert({
                      blocker_id: user.id,
                      blocked_id: otherParty.userId,
                    });
                    Alert.alert('Blocked', `${workerName || 'This person'} can no longer contact you.`);
                    navigation.goBack();
                  } catch (e) {
                    Alert.alert('Error', 'Could not block. Try again.');
                  }
                },
              },
            ]
          );
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  useEffect(() => {
    if (!bookingId) return;

    // Load initial messages
    getMessages(bookingId)
      .then(data => {
        setMessages(data || []);
        setLoading(false);
        if (user?.id) markMessagesAsRead(bookingId, user.id).catch(() => {});
      })
      .catch(e => { console.warn('Chat load error:', e.message); setLoading(false); });

    // Real-time subscription
    const sub = subscribeToMessages(bookingId, (newMsg) => {
      setMessages(prev => {
        if (prev.find(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      if (newMsg.receiver_id === user?.id) {
        markMessagesAsRead(bookingId, user.id).catch(() => {});
      }
    });

    return () => sub.unsubscribe();
  }, [bookingId]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!text.trim() || !user?.id || !bookingId) return;
    const msgText = text.trim();
    setText('');
    setSending(true);

    // Optimistic update
    const optimistic = {
      id: `opt_${Date.now()}`,
      booking_id: bookingId,
      sender_id: user.id,
      message: msgText,
      created_at: new Date().toISOString(),
      is_read: false,
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      const saved = await sendMessage({
        bookingId,
        senderId:   user.id,
        receiverId: receiverId,
        text:       msgText,
      });
      // Replace optimistic with real
      setMessages(prev => prev.map(m => m.id === optimistic.id ? saved : m));
    } catch (e) {
      // Real failure handling — keeping the optimistic bubble would
      // show the sender a message that was actually rejected (most
      // importantly: blocked). Remove it and restore their draft.
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setText(msgText);
      Alert.alert('Could not send', e.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  const startRecording = async () => {
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Microphone needed', 'Allow microphone access to send voice messages.');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      setRecordingMillis(0);

      recordingTimer.current = setInterval(() => {
        setRecordingMillis(prev => prev + 1000);
      }, 1000);
    } catch (e) {
      Alert.alert('Could not start recording', e.message);
    }
  };

  const stopAndSend = async () => {
    if (!isRecording) return;

    clearInterval(recordingTimer.current);
    setIsRecording(false);
    setSendingVoice(true);

    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });

      const uri = recorder.uri;
      setRecordingMillis(0);

      if (!uri) throw new Error('Recording URI is empty — try again.');

      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append('file', {
        uri,
        name: `voice_${Date.now()}.m4a`,
        type: 'audio/mp4',
      });

      const uploadRes = await fetch(`${BACKEND_URL}/api/uploads/voice`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: formData,
      });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadJson.error || 'Upload failed.');

      const voiceUrl = uploadJson.url;

      const saved = await sendVoiceMessage({
        bookingId,
        senderId:   user.id,
        receiverId: receiverId,
        voiceUrl,
      });
      setMessages(prev => [...prev, saved]);
    } catch (e) {
      Alert.alert('Could not send voice message', e.message || 'Please try again.');
    } finally {
      setSendingVoice(false);
    }
  };

  const cancelRecording = async () => {
    if (!isRecording) return;
    clearInterval(recordingTimer.current);
    try {
      await recorder.stop();
    } catch {}
    setIsRecording(false);
    setRecordingMillis(0);
  };

  // Format mm:ss for the recording timer
  const formatDuration = (ms) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
    const secs = (totalSecs % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const renderMessage = ({ item, index }) => {
    const isMe = item.sender_id === user?.id;
    const showTime = index === 0 ||
      new Date(item.created_at).getMinutes() !==
      new Date(messages[index - 1]?.created_at).getMinutes();

    return (
      <View>
        {showTime && (
          <Text style={styles.timeLabel}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
        <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
          {!isMe && (
            <GoldAvatar name={workerName || 'Chat'} size={28} />
          )}
          <View style={styles.bubbleWrap}>
            <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
              {item.voice_url ? (
                <View style={styles.voiceMsg}>
                  <Ionicons name="mic" size={16} color={isMe ? Colors.navy : Colors.gold} />
                  <Text style={[styles.voiceText, isMe && styles.voiceTextMe]}>Voice message</Text>
                </View>
              ) : (
                <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.message}</Text>
              )}
            </View>
            <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />
        <ActivityIndicator color={Colors.gold} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </TouchableOpacity>
          <GoldAvatar name={workerName || 'Chat'} size={38} online />
          <View style={styles.headerInfo}>
            <View style={styles.headerNameRow}>
              <Text style={styles.headerName}>{workerName || 'Chat'}</Text>
              {otherParty.verifiedBadge && <VerifiedBadge color="blue" size={13} />}
            </View>
            <Text style={styles.headerSub}>Online · Booking #{bookingId?.slice(-6)}</Text>
          </View>
          <TouchableOpacity onPress={handleChatMenu} style={styles.menuBtn}>
            <Ionicons name="ellipsis-vertical" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.escrowBanner}>
          <Ionicons name="lock-closed-outline" size={15} color={Colors.gold} />
          <Text style={styles.escrowText}>
            Messages are tied to this booking. Keep payment and job details inside WiamApp.
          </Text>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Ionicons name="chatbubbles-outline" size={48} color={Colors.navyLine} />
              <Text style={styles.emptyChatText}>No messages yet</Text>
              <Text style={styles.emptyChatSub}>Send a message to get started</Text>
            </View>
          }
        />

        {/* Input bar */}
        <View style={styles.inputBar}>
          {isRecording ? (
            // ── RECORDING MODE ──────────────────────────────
            <>
              <TouchableOpacity onPress={cancelRecording} style={styles.cancelVoiceBtn}>
                <Ionicons name="trash-outline" size={20} color={RED} />
              </TouchableOpacity>
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingTimer}>{formatDuration(recordingMillis)}</Text>
                <Text style={styles.recordingHint}>Recording… slide left to cancel</Text>
              </View>
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: RED }]}
                onPress={stopAndSend}
                disabled={sendingVoice}
              >
                {sendingVoice
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Ionicons name="stop" size={18} color="#fff" />
                }
              </TouchableOpacity>
            </>
          ) : (
            // ── TEXT MODE ────────────────────────────────────
            <>
              <TouchableOpacity style={styles.plusBtn} activeOpacity={0.85}>
                <Ionicons name="add" size={20} color={Colors.gold} />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder="Type a message..."
                placeholderTextColor={Colors.textFaint}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={1000}
                returnKeyType="send"
                onSubmitEditing={handleSend}
              />
              {text.trim() ? (
                <TouchableOpacity
                  style={[styles.sendBtn, sending && { opacity: 0.5 }]}
                  onPress={handleSend}
                  disabled={sending}
                >
                  {sending
                    ? <ActivityIndicator color={Colors.navy} size="small" />
                    : <Ionicons name="send" size={16} color={Colors.navy} />
                  }
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.micBtn}
                  onPress={startRecording}
                  disabled={sendingVoice}
                >
                  {sendingVoice
                    ? <ActivityIndicator color={Colors.navy} size="small" />
                    : <Ionicons name="mic" size={20} color={Colors.navy} />
                  }
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: Colors.navy },
  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAD, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.navyLine, gap: 11 },
  backBtn:         { padding: 4 },
  menuBtn:         { padding: 4, marginLeft: 'auto' },
  headerInfo:      { flex: 1 },
  headerNameRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  headerName:      { fontSize: 14.5, fontWeight: '600', color: Colors.white },
  headerSub:       { fontSize: 11, color: Colors.success, marginTop: 1 },
  escrowBanner:    { flexDirection: 'row', alignItems: 'center', gap: 9, marginHorizontal: PAD, marginTop: 12, marginBottom: 4, padding: 10, paddingHorizontal: 13, borderRadius: 14, backgroundColor: 'rgba(212,160,23,0.1)', borderWidth: 1, borderColor: 'rgba(212,160,23,0.25)' },
  escrowText:      { flex: 1, fontSize: 11, color: '#D9BE6E', lineHeight: 16 },
  messagesList:    { paddingHorizontal: PAD, paddingVertical: 14, flexGrow: 1, gap: 10 },
  timeLabel:       { textAlign: 'center', fontSize: 10.5, color: Colors.textFaint, marginVertical: 6 },
  msgRow:          { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  msgRowMe:        { flexDirection: 'row-reverse' },
  bubbleWrap:      { maxWidth: '74%' },
  bubble:          { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 10 },
  bubbleThem:      { backgroundColor: Colors.navyCard, borderBottomLeftRadius: 5 },
  bubbleMe:        { backgroundColor: Colors.gold, borderBottomRightRadius: 5 },
  bubbleText:      { fontSize: 13, color: '#E4E4EF', lineHeight: 18 },
  bubbleTextMe:    { color: Colors.navy, fontWeight: '500' },
  bubbleTime:      { fontSize: 9.5, color: Colors.textFaint, marginTop: 3 },
  bubbleTimeMe:    { textAlign: 'right', color: '#A0A0B8' },
  voiceMsg:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  voiceText:       { fontSize: 14, color: Colors.gold },
  voiceTextMe:     { color: Colors.navy },

  cancelVoiceBtn:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239,68,68,0.12)' },
  recordingIndicator:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordingDot:        { width: 10, height: 10, borderRadius: 5, backgroundColor: RED },
  recordingTimer:      { fontSize: 14, fontWeight: '700', color: RED },
  recordingHint:       { fontSize: 11, color: Colors.textDim, flex: 1 },
  plusBtn:             { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.navyCard, alignItems: 'center', justifyContent: 'center' },
  micBtn:              { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  emptyChat:       { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyChatText:   { fontSize: 16, color: Colors.textDim, fontWeight: '600' },
  emptyChatSub:    { fontSize: 13, color: Colors.textDim },
  inputBar:        { flexDirection: 'row', alignItems: 'flex-end', gap: 9, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 22, borderTopWidth: 1, borderTopColor: '#1C1C38', backgroundColor: Colors.navySoft },
  input:           { flex: 1, backgroundColor: Colors.navyCard, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 9, fontSize: 13, color: Colors.white, maxHeight: 120 },
  sendBtn:         { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
});
