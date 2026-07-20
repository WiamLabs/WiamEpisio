/**
 * Series comments — live API /series/:id/comments
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Send } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import apiClient from '../../api/client';
import useAuthStore from '../../store/useAuthStore';

const SeriesCommentsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const seriesId = route.params?.seriesId;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!seriesId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get(`/series/${seriesId}/comments`);
      setComments(data?.comments || []);
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not load comments');
    } finally {
      setLoading(false);
    }
  }, [seriesId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    if (!isAuthenticated) {
      navigation.navigate('LoginRequiredSheet', {
        title: 'Sign in to comment',
        message: 'Create a free account to join the conversation.',
      });
      return;
    }
    setSending(true);
    try {
      await apiClient.post(`/series/${seriesId}/comments`, { body });
      setText('');
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not post');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <ChevronLeft size={17} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.h1}>Comments</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 20, paddingBottom: 12 }}
          ListEmptyComponent={(
            <Text style={styles.empty}>No comments yet — be the first.</Text>
          )}
          ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.name}>{item.user?.display_name || 'Watcher'}</Text>
              <Text style={styles.body}>{item.body}</Text>
              {(item.replies || []).map((r) => (
                <Text key={r.id} style={styles.reply}>{r.body}</Text>
              ))}
            </View>
          )}
        />
      )}

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Add a comment…"
          placeholderTextColor={COLORS.textFaint}
          maxLength={2000}
        />
        <TouchableOpacity style={styles.send} onPress={send} disabled={sending || !text.trim()}>
          {sending ? <ActivityIndicator color={COLORS.navy} /> : <Send size={16} color={COLORS.navy} />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingBottom: 12,
  },
  back: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  h1: { fontSize: 17, fontFamily: FONTS.bold, color: '#fff' },
  empty: { textAlign: 'center', color: COLORS.textFaint, marginTop: 40, fontFamily: FONTS.medium },
  error: { color: '#EF4444', marginBottom: 12, fontFamily: FONTS.medium },
  row: {
    backgroundColor: COLORS.navyCard, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  name: { fontFamily: FONTS.bold, color: COLORS.gold, fontSize: 12, marginBottom: 4 },
  body: { fontFamily: FONTS.regular, color: '#fff', fontSize: 14, lineHeight: 20 },
  reply: {
    marginTop: 8, marginLeft: 10, fontSize: 12.5, color: '#C9C9DE', fontFamily: FONTS.regular,
  },
  composer: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.navyLine,
  },
  input: {
    flex: 1, backgroundColor: COLORS.navyCard, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 10, color: '#fff', fontFamily: FONTS.regular, fontSize: 14,
  },
  send: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center',
  },
});

export default SeriesCommentsScreen;
