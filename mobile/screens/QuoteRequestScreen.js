// © 2026 WiamApp. Powered by WiamLabs
// screens/QuoteRequestScreen.js
// Customer posts a job — verified workers send quotes within 2 hours
// Backend: POST /api/quotes (via lib/api/quotes.js)

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet,  StatusBar,
  ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getCategories } from '../lib/api/workers';
import { postQuoteRequest } from '../lib/api/quotes';
import { uploadImage } from '../lib/api/uploads';
import { localToUsd } from '../lib/api/currency';

const BG      = '#FFFFFF';
const NAVY    = '#0D0D2B';
const GOLD    = '#D4A017';
const GOLD_BG = 'rgba(212,160,23,0.10)';
const GOLD_BD = 'rgba(212,160,23,0.25)';
const BORDER  = '#EBEBEB';
const MUTED   = '#888899';
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

const DATES = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i);
  return {
    key:     d.toISOString().split('T')[0],
    display: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
  };
});

export default function QuoteRequestScreen({ navigation, route }) {
  const preselectedCategory = route?.params?.categoryId || null;

  const [categories,  setCategories]  = useState([]);
  const [catsLoading,  setCatsLoading] = useState(true);
  const [category,    setCategory]    = useState(preselectedCategory);
  const [description, setDescription] = useState('');
  const [address,     setAddress]     = useState('');
  const [date,        setDate]        = useState(DATES[0].key);
  const [budget,      setBudget]      = useState('');
  const [photos,      setPhotos]      = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [uploadStage,  setUploadStage] = useState('');
  const [error,       setError]       = useState('');

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await getCategories();
        setCategories(data || []);
      } catch {
        setCategories([]);
      } finally {
        setCatsLoading(false);
      }
    };
    loadCategories();
  }, []);

  const canSubmit = category && description.length >= 15 && address;

  const pickPhoto = async () => {
    if (photos.length >= 3) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPhotos(p => [...p, result.assets[0].uri]);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError('');
    try {
      // Upload any attached photos for real before submitting — these
      // are local device URIs until now, the worker can never see them
      // unless they actually reach Cloudinary first.
      let photoUrls = [];
      if (photos.length > 0) {
        setUploadStage('Uploading photos...');
        photoUrls = await Promise.all(photos.map((uri) => uploadImage(uri, 'quote_requests')));
      }

      // Budget is entered in GHS on screen but stored in USD in the
      // database (Section 5/3 — money is always USD internally), so
      // this converts using the real cached exchange rate, never a
      // guessed factor.
      let budgetMaxUsd = null;
      if (budget) {
        setUploadStage('Converting budget...');
        budgetMaxUsd = await localToUsd(parseFloat(budget), 'GHS');
      }

      setUploadStage('Posting your request...');
      const result = await postQuoteRequest({
        categoryId: category,
        description,
        locationAddress: address,
        preferredDate: date,
        budgetMinUsd: null,
        budgetMaxUsd,
        photoUrls,
      });

      navigation.replace('QuotesList', { requestId: result.id });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setUploadStage('');
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={NAVY} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Get Quotes</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView
          contentContainerStyle={s.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.intro}>
            Post your job. Verified workers near you send quotes within 2 hours.
          </Text>

          {/* Category */}
          <Text style={s.label}>SELECT CATEGORY *</Text>
          {catsLoading ? (
            <ActivityIndicator color={NAVY} style={{ marginVertical: 10 }} />
          ) : (
            <View style={s.catGrid}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[s.catChip, category === cat.id && s.catChipActive]}
                  onPress={() => setCategory(cat.id)}
                >
                  <Ionicons
                    name={cat.icon || 'briefcase-outline'}
                    size={18}
                    color={category === cat.id ? NAVY : MUTED}
                  />
                  <Text style={[s.catName, category === cat.id && s.catNameActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Description */}
          <Text style={s.label}>DESCRIBE THE JOB *</Text>
          <TextInput
            style={s.textarea}
            placeholder="Describe exactly what you need done. The more detail you give, the better quotes you will receive..."
            placeholderTextColor={MUTED}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
          <View style={s.charCountRow}>
            <Text style={[s.charCount, description.length < 15 && description.length > 0 && { color: '#EF4444' }]}>
              {description.length} characters {description.length < 15 ? `(${15 - description.length} more needed)` : ''}
            </Text>
            {description.length >= 15 && (
              <Ionicons name="checkmark-circle" size={13} color="#22C55E" />
            )}
          </View>

          {/* Address */}
          <Text style={s.label}>JOB LOCATION *</Text>
          <View style={s.inputWrap}>
            <Ionicons name="location-outline" size={17} color={MUTED} style={s.inputIcon} />
            <TextInput
              style={[s.input, { flex: 1 }]}
              placeholder="Street address or area"
              placeholderTextColor={MUTED}
              value={address}
              onChangeText={setAddress}
            />
          </View>

          {/* Preferred date */}
          <Text style={s.label}>PREFERRED DATE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.datesRow}>
            {DATES.map(d => (
              <TouchableOpacity
                key={d.key}
                style={[s.datePill, date === d.key && s.datePillActive]}
                onPress={() => setDate(d.key)}
              >
                <Text style={[s.datePillText, date === d.key && s.datePillTextActive]}>
                  {d.display}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Budget */}
          <Text style={s.label}>YOUR BUDGET (OPTIONAL)</Text>
          <View style={s.inputWrap}>
            <Text style={s.currencyLabel}>GHS</Text>
            <TextInput
              style={[s.input, { flex: 1 }]}
              placeholder="Enter your maximum budget"
              placeholderTextColor={MUTED}
              value={budget}
              onChangeText={setBudget}
              keyboardType="numeric"
            />
          </View>
          <Text style={s.fieldNote}>Workers will send quotes based on this. Leave blank if unsure.</Text>

          {/* Photos */}
          <Text style={s.label}>PHOTOS (OPTIONAL, MAX 3)</Text>
          <View style={s.photosRow}>
            {photos.map((uri, i) => (
              <View key={i} style={s.photoThumb}>
                <Image source={{ uri }} style={s.photoImg} resizeMode="cover" />
                <TouchableOpacity
                  style={s.photoRemove}
                  onPress={() => setPhotos(p => p.filter((_, pi) => pi !== i))}
                >
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 3 && (
              <TouchableOpacity style={s.photoAdd} onPress={pickPhoto}>
                <Ionicons name="camera-outline" size={22} color={MUTED} />
                <Text style={s.photoAddText}>Add Photo</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Notice */}
          <View style={s.notice}>
            <Ionicons name="information-circle-outline" size={15} color={GOLD} style={{ flexShrink: 0, marginTop: 1 }} />
            <Text style={s.noticeText}>
              Workers have 2 hours to send quotes. You will be notified instantly. Choose the best quote and book directly — payment is protected by escrow.
            </Text>
          </View>

          {/* Error */}
          {error ? (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Submit */}
          <TouchableOpacity
            style={[s.submitBtn, (!canSubmit || loading) && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color={NAVY} />
                  {uploadStage ? <Text style={s.submitBtnText}>{uploadStage}</Text> : null}
                </View>
              : <>
                  <Text style={[s.submitBtnText, !canSubmit && { color: 'rgba(13,13,43,0.4)' }]}>
                    Post Job Request
                  </Text>
                  {canSubmit && <Ionicons name="arrow-forward" size={16} color={NAVY} style={{ marginLeft: 6 }} />}
                </>
            }
          </TouchableOpacity>

          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: BORDER,
  },
  headerTitle: { color: NAVY, fontSize: 17, fontWeight: '700' },
  container:   { flexGrow: 1, padding: 20 },
  intro:       { color: MUTED, fontSize: 13, lineHeight: 20, marginBottom: 20 },

  label: { color: MUTED, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10, marginTop: 18 },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: 0.5,
    borderColor: BORDER, backgroundColor: '#F5F5F8',
  },
  catChipActive:  { backgroundColor: GOLD_BG, borderColor: GOLD },
  catName:        { color: MUTED, fontSize: 12, fontWeight: '500' },
  catNameActive:  { color: GOLD, fontWeight: '600' },

  textarea: {
    backgroundColor: '#F5F5F8', borderRadius: 13,
    borderWidth: 0.5, borderColor: BORDER,
    padding: 13, color: NAVY, fontSize: 14,
    lineHeight: 22, minHeight: 110,
  },
  charCountRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 4 },
  charCount: { color: MUTED, fontSize: 11 },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F5F8', borderRadius: 12,
    borderWidth: 0.5, borderColor: BORDER,
    paddingHorizontal: 13, paddingVertical: 13,
  },
  inputIcon:    { marginRight: 8 },
  input:        { color: NAVY, fontSize: 14 },
  currencyLabel:{ color: GOLD, fontSize: 14, fontWeight: '600', marginRight: 10, paddingRight: 10, borderRightWidth: 0.5, borderRightColor: BORDER },
  fieldNote:    { color: '#CCC', fontSize: 11, marginTop: 5 },

  datesRow: { marginBottom: 4 },
  datePill: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20,
    borderWidth: 0.5, borderColor: BORDER,
    backgroundColor: '#F5F5F8', marginRight: 8,
  },
  datePillActive:    { backgroundColor: NAVY, borderColor: NAVY },
  datePillText:      { color: MUTED, fontSize: 13 },
  datePillTextActive:{ color: '#FFF', fontWeight: '600' },

  photosRow: { flexDirection: 'row', gap: 10 },
  photoThumb:{ width: 80, height: 80, borderRadius: 12, position: 'relative' },
  photoImg:  { width: 80, height: 80, borderRadius: 12 },
  photoRemove:{ position: 'absolute', top: -6, right: -6 },
  photoAdd: {
    width: 80, height: 80, borderRadius: 12,
    backgroundColor: '#F5F5F8', borderWidth: 1.5,
    borderColor: BORDER, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  photoAddText: { color: MUTED, fontSize: 10 },

  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 9,
    backgroundColor: GOLD_BG, borderWidth: 0.5, borderColor: GOLD_BD,
    borderRadius: 12, padding: 13, marginTop: 20,
  },
  noticeText: { color: NAVY, fontSize: 12, lineHeight: 18, flex: 1 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 10, padding: 12, marginTop: 14,
  },
  errorText: { color: '#EF4444', fontSize: 12, flex: 1 },

  submitBtn: {
    backgroundColor: GOLD, borderRadius: 13, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', marginTop: 20,
  },
  submitBtnDisabled: { backgroundColor: 'rgba(212,160,23,0.25)' },
  submitBtnText:     { color: NAVY, fontSize: 15, fontWeight: '700' },
});
