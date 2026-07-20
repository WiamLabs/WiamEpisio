import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import apiClient from '../../api/client';
import { ChevronLeft, MessageSquare, Send } from 'lucide-react-native';

const TYPES = [
  { key: 'suggestion', label: 'Suggestion' },
  { key: 'bug', label: 'Bug Report' },
  { key: 'ui', label: 'UI/Design Issue' },
  { key: 'reading', label: 'Reading Problem' },
  { key: 'other', label: 'Other' },
];

const FeedbackScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [type, setType] = useState('suggestion');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!message.trim()) { Alert.alert('Required', 'Please enter your feedback.'); return; }
    setLoading(true);
    try {
      await apiClient.post('/feedback', { type, message: message.trim() });
      Alert.alert('Thank you!', 'Your feedback has been submitted successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <ChevronLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Feedback</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={s.card}>
            <MessageSquare size={24} color={COLORS.secondary} />
            <Text style={s.cardTitle}>We'd love to hear from you</Text>
            <Text style={s.cardSub}>Help us improve WiamApp. Your feedback matters.</Text>
          </View>

          <Text style={s.label}>Type</Text>
          <View style={s.typeRow}>
            {TYPES.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[s.typePill, type === t.key && s.typePillActive]}
                onPress={() => setType(t.key)}
              >
                <Text style={[s.typeText, type === t.key && s.typeTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Your Feedback</Text>
          <TextInput
            style={s.input}
            multiline
            numberOfLines={6}
            value={message}
            onChangeText={setMessage}
            placeholder="Describe your feedback, suggestion, or issue..."
            placeholderTextColor={COLORS.textMuted}
            textAlignVertical="top"
          />

          <TouchableOpacity style={s.btn} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color="#000" /> : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Send size={16} color="#000" />
                <Text style={s.btnText}>Submit Feedback</Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  card: { alignItems: 'center', paddingVertical: 24, gap: 8, marginBottom: 20 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  cardSub: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8, marginTop: 16 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typePill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  typePillActive: { backgroundColor: 'rgba(212,168,67,0.15)', borderColor: 'rgba(212,168,67,0.3)' },
  typeText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  typeTextActive: { color: COLORS.secondary },
  input: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 14, color: COLORS.text, fontSize: 14, minHeight: 120, marginTop: 4 },
  btn: { backgroundColor: COLORS.secondary, borderRadius: 28, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  btnText: { color: '#000', fontSize: 15, fontWeight: '700' },
});

export default FeedbackScreen;
