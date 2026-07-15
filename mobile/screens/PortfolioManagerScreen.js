// © 2026 WiamApp. Powered by WiamLabs
// screens/PortfolioManagerScreen.js
// Worker adds/removes portfolio photos with captions
// Backend: GET/POST/DELETE /api/workers/portfolio

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView,
  ActivityIndicator, Image, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, goldGradient } from '../constants/colors';

const PAD = Colors.screenPad;
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function PortfolioManagerScreen({ navigation }) {
  const [portfolio, setPortfolio] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption,   setCaption]   = useState('');
  const [showAdd,   setShowAdd]   = useState(false);
  const [newImage,  setNewImage]  = useState(null);

  const fetchPortfolio = async () => {
    try {
      const res  = await fetch(`${BACKEND}/api/workers/portfolio`);
      const data = await res.json();
      setPortfolio(data.data || []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { fetchPortfolio(); }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8, allowsEditing: true, aspect: [4, 3],
    });
    if (!result.canceled && result.assets?.[0]) {
      setNewImage(result.assets[0]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8, allowsEditing: true, aspect: [4, 3],
    });
    if (!result.canceled && result.assets?.[0]) {
      setNewImage(result.assets[0]);
    }
  };

  const handleUpload = async () => {
    if (!newImage || uploading) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', {
        uri: newImage.uri, type: 'image/jpeg',
        name: `portfolio_${Date.now()}.jpg`,
      });
      formData.append('caption', caption);
      const res  = await fetch(`${BACKEND}/api/workers/portfolio`, {
        method: 'POST', body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPortfolio(prev => [data.data, ...prev]);
      setNewImage(null); setCaption(''); setShowAdd(false);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally { setUploading(false); }
  };

  const handleDelete = (id) => {
    Alert.alert('Remove Photo', 'Remove this photo from your portfolio?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await fetch(`${BACKEND}/api/workers/portfolio/${id}`, { method: 'DELETE' });
            setPortfolio(prev => prev.filter(p => p.id !== id));
          } catch { }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Portfolio</Text>
        <TouchableOpacity onPress={() => setShowAdd(!showAdd)}>
          <Ionicons name={showAdd ? 'close' : 'add-circle-outline'} size={24} color={Colors.gold} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Add new photo panel */}
        {showAdd && (
          <View style={s.addPanel}>
            <Text style={s.addTitle}>ADD PORTFOLIO PHOTO</Text>
            {newImage ? (
              <View style={s.previewWrap}>
                <Image source={{ uri: newImage.uri }} style={s.preview} resizeMode="cover" />
                <TouchableOpacity style={s.changePhotoBtn} onPress={() => setNewImage(null)}>
                  <Ionicons name="close-circle" size={22} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.pickRow}>
                <TouchableOpacity style={s.pickBtn} onPress={takePhoto}>
                  <Ionicons name="camera-outline" size={22} color={Colors.gold} />
                  <Text style={s.pickBtnText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.pickBtn} onPress={pickImage}>
                  <Ionicons name="images-outline" size={22} color={Colors.gold} />
                  <Text style={s.pickBtnText}>Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
            <TextInput
              style={s.captionInput}
              placeholder="Add a caption (optional)..."
              placeholderTextColor={Colors.textDim}
              value={caption}
              onChangeText={setCaption}
            />
            <TouchableOpacity onPress={handleUpload} disabled={!newImage || uploading} activeOpacity={0.85}>
              <LinearGradient
                colors={(!newImage || uploading) ? ['rgba(212,160,23,0.25)', 'rgba(160,120,16,0.25)'] : goldGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.uploadBtn}
              >
                {uploading
                  ? <ActivityIndicator color={Colors.navy} />
                  : <Text style={s.uploadBtnText}>Upload Photo</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Portfolio tip */}
        <View style={s.tip}>
          <Ionicons name="bulb-outline" size={14} color={Colors.gold} />
          <Text style={s.tipText}>
            Workers with 5+ portfolio photos get 3x more bookings. Show before & after results.
          </Text>
        </View>

        {/* Portfolio grid */}
        {loading ? (
          <ActivityIndicator color={Colors.gold} style={{ marginTop: 40 }} />
        ) : portfolio.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="images-outline" size={48} color="rgba(255,255,255,0.1)" />
            <Text style={s.emptyTitle}>No photos yet</Text>
            <Text style={s.emptyText}>Tap + to add your first portfolio photo</Text>
          </View>
        ) : (
          <View style={s.grid}>
            {portfolio.map((item) => (
              <View key={item.id} style={s.gridItem}>
                <Image source={{ uri: item.image_url }} style={s.gridImage} resizeMode="cover" />
                <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(item.id)}>
                  <Ionicons name="trash-outline" size={14} color={Colors.white} />
                </TouchableOpacity>
                {item.caption ? (
                  <View style={s.captionOverlay}>
                    <Text style={s.captionText} numberOfLines={2}>{item.caption}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.navy },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PAD, paddingVertical: 14 },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.navyCard, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.white, fontSize: 17, fontWeight: '700' },

  addPanel: {
    backgroundColor: Colors.navyCard, marginHorizontal: PAD, marginBottom: 16,
    borderRadius: Colors.cardRadius, borderWidth: 1, borderColor: Colors.navyLine, padding: 16,
  },
  addTitle:    { color: Colors.gold, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 14 },
  previewWrap: { position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  preview:     { width: '100%', height: 180, borderRadius: 12 },
  changePhotoBtn: { position: 'absolute', top: 8, right: 8 },
  pickRow:     { flexDirection: 'row', gap: 10, marginBottom: 12 },
  pickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12,
    backgroundColor: 'rgba(212,160,23,0.10)', borderWidth: 1, borderColor: 'rgba(212,160,23,0.25)',
  },
  pickBtnText:   { color: Colors.gold, fontSize: 14, fontWeight: '500' },
  captionInput: {
    backgroundColor: Colors.navySoft, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.navyLine,
    padding: 12, color: Colors.white, fontSize: 14, marginBottom: 12,
  },
  uploadBtn:         { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  uploadBtnText:     { color: Colors.navy, fontSize: 14, fontWeight: '700' },

  tip: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(212,160,23,0.10)', borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: 'rgba(212,160,23,0.25)',
    marginHorizontal: PAD, marginBottom: 16,
  },
  tipText: { color: Colors.textDim, fontSize: 12, lineHeight: 18, flex: 1 },

  empty:      { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTitle: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  emptyText:  { color: Colors.textDim, fontSize: 13 },

  grid:      { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: PAD, gap: 8 },
  gridItem:  { width: '48%', position: 'relative', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: Colors.navyLine },
  gridImage: { width: '100%', height: 160 },
  deleteBtn: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8,
    width: 30, height: 30, alignItems: 'center', justifyContent: 'center',
  },
  captionOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)', padding: 8,
  },
  captionText: { color: Colors.white, fontSize: 11, lineHeight: 15 },
});
