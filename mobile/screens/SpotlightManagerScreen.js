// © 2026 WiamApp. Powered by WiamLabs
// screens/SpotlightManagerScreen.js
// Worker creates and manages spotlight posts
// V2 Plan: Basic+ workers only. Posts go through pending review before appearing publicly.
// Backend: GET /api/spotlight/mine, POST /api/spotlight, DELETE /api/spotlight/:id

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView,
  ActivityIndicator, Image, TextInput,
  RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, goldGradient } from '../constants/colors';

const PAD = Colors.screenPad;
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

const STATUS_CONFIG = {
  pending:  { label: 'Under Review', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  approved: { label: 'Live',         color: '#22C55E', bg: 'rgba(34,197,94,0.15)'  },
  rejected: { label: 'Rejected',     color: '#EF4444', bg: 'rgba(239,68,68,0.15)'  },
};

export default function SpotlightManagerScreen({ navigation }) {
  const [posts,      setPosts]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newImage,   setNewImage]   = useState(null);
  const [caption,    setCaption]    = useState('');
  const [uploading,  setUploading]  = useState(false);
  const [freeLeft,   setFreeLeft]   = useState(0);

  const fetchPosts = async () => {
    try {
      const res  = await fetch(`${BACKEND}/api/spotlight/mine`);
      const data = await res.json();
      setPosts(data.data || []);
      setFreeLeft(data.free_posts_remaining ?? 0);
    } catch { } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchPosts(); }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85, allowsEditing: true, aspect: [1, 1],
    });
    if (!result.canceled && result.assets?.[0]) setNewImage(result.assets[0]);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85, allowsEditing: true, aspect: [1, 1],
    });
    if (!result.canceled && result.assets?.[0]) setNewImage(result.assets[0]);
  };

  const handleCreate = async () => {
    if (!newImage || !caption.trim() || uploading) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('media', {
        uri: newImage.uri, type: 'image/jpeg',
        name: `spotlight_${Date.now()}.jpg`,
      });
      formData.append('caption', caption.trim());
      const res  = await fetch(`${BACKEND}/api/spotlight`, {
        method: 'POST', body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPosts(prev => [data.data, ...prev]);
      setNewImage(null); setCaption(''); setShowCreate(false);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally { setUploading(false); }
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Post', 'Delete this spotlight post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await fetch(`${BACKEND}/api/spotlight/${id}`, { method: 'DELETE' });
            setPosts(prev => prev.filter(p => p.id !== id));
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
        <Text style={s.headerTitle}>Spotlight</Text>
        <TouchableOpacity onPress={() => setShowCreate(!showCreate)}>
          <Ionicons name={showCreate ? 'close' : 'add-circle-outline'} size={24} color={Colors.gold} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchPosts(); }}
            tintColor={Colors.gold} />
        }
      >
        {/* Free posts remaining */}
        <View style={s.freeCard}>
          <Ionicons name="megaphone-outline" size={18} color={Colors.gold} />
          <View style={s.freeInfo}>
            <Text style={s.freeTitle}>Free posts this month</Text>
            <Text style={s.freeDesc}>
              {freeLeft > 0
                ? `${freeLeft} free post${freeLeft !== 1 ? 's' : ''} remaining — use them!`
                : 'No free posts left this month. Upgrade for more.'}
            </Text>
          </View>
          <View style={s.freeBadge}>
            <Text style={s.freeBadgeText}>{freeLeft}</Text>
          </View>
        </View>

        {/* Create panel */}
        {showCreate && (
          <View style={s.createPanel}>
            <Text style={s.createTitle}>CREATE SPOTLIGHT POST</Text>
            <Text style={s.createHint}>
              Show your best work. Posts are reviewed before going live. Professional content only.
            </Text>

            {newImage ? (
              <View style={s.previewWrap}>
                <Image source={{ uri: newImage.uri }} style={s.preview} />
                <TouchableOpacity style={s.removeImg} onPress={() => setNewImage(null)}>
                  <Ionicons name="close-circle" size={22} color="rgba(255,255,255,0.9)" />
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
              placeholder="Describe your work (what you did, materials used, result)..."
              placeholderTextColor={Colors.textDim}
              value={caption}
              onChangeText={setCaption}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <TouchableOpacity onPress={handleCreate} disabled={!newImage || !caption.trim() || uploading} activeOpacity={0.85}>
              <LinearGradient
                colors={(!newImage || !caption.trim() || uploading) ? ['rgba(212,160,23,0.25)', 'rgba(160,120,16,0.25)'] : goldGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.postBtn}
              >
                {uploading
                  ? <ActivityIndicator color={Colors.navy} />
                  : <>
                      <Ionicons name="megaphone-outline" size={16} color={Colors.navy} />
                      <Text style={s.postBtnText}>Submit for Review</Text>
                    </>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Posts list */}
        {loading ? (
          <ActivityIndicator color={Colors.gold} style={{ marginTop: 40 }} />
        ) : posts.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="megaphone-outline" size={48} color="rgba(255,255,255,0.1)" />
            <Text style={s.emptyTitle}>No spotlight posts yet</Text>
            <Text style={s.emptyText}>Show your best work — tap + to create your first post</Text>
          </View>
        ) : (
          <View style={s.postsList}>
            {posts.map(post => {
              const sc = STATUS_CONFIG[post.status] || STATUS_CONFIG.pending;
              return (
                <View key={post.id} style={s.postCard}>
                  <View style={s.postImageWrap}>
                    <Image source={{ uri: post.media_url }} style={s.postImage} resizeMode="cover" />
                    <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[s.statusText, { color: sc.color }]}>{sc.label}</Text>
                    </View>
                  </View>
                  <View style={s.postInfo}>
                    <Text style={s.postCaption} numberOfLines={2}>{post.caption}</Text>
                    <View style={s.postMeta}>
                      <Text style={s.postDate}>
                        {new Date(post.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </Text>
                      {post.status === 'approved' && (
                        <View style={s.viewsRow}>
                          <Ionicons name="eye-outline" size={12} color={Colors.textDim} />
                          <Text style={s.viewsText}>{post.views || 0} views</Text>
                        </View>
                      )}
                      {post.status === 'rejected' && post.rejection_reason && (
                        <Text style={s.rejectionReason} numberOfLines={1}>
                          Reason: {post.rejection_reason}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(post.id)}>
                      <Ionicons name="trash-outline" size={14} color="#EF4444" />
                      <Text style={s.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
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

  freeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(212,160,23,0.10)', borderWidth: 1, borderColor: 'rgba(212,160,23,0.25)',
    borderRadius: 14, marginHorizontal: PAD, marginBottom: 14, padding: 14,
  },
  freeInfo:      { flex: 1 },
  freeTitle:     { color: Colors.white, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  freeDesc:      { color: Colors.textDim, fontSize: 11 },
  freeBadge:     { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  freeBadgeText: { color: Colors.navy, fontSize: 14, fontWeight: '800' },

  createPanel: {
    backgroundColor: Colors.navyCard, marginHorizontal: PAD, marginBottom: 16,
    borderRadius: Colors.cardRadius, borderWidth: 1, borderColor: Colors.navyLine, padding: 16,
  },
  createTitle: { color: Colors.gold, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  createHint:  { color: Colors.textDim, fontSize: 12, lineHeight: 18, marginBottom: 14 },
  previewWrap: { position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  preview:     { width: '100%', height: 200, borderRadius: 12 },
  removeImg:   { position: 'absolute', top: 8, right: 8 },
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
    padding: 12, color: Colors.white, fontSize: 14,
    lineHeight: 22, minHeight: 80, marginBottom: 12,
  },
  postBtn:         { borderRadius: 12, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  postBtnText:     { color: Colors.navy, fontSize: 14, fontWeight: '700' },

  empty:      { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTitle: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  emptyText:  { color: Colors.textDim, fontSize: 13, textAlign: 'center', paddingHorizontal: 30 },

  postsList: { paddingHorizontal: PAD, gap: 12 },
  postCard: {
    backgroundColor: Colors.navyCard, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.navyLine,
    flexDirection: 'row', overflow: 'hidden',
  },
  postImageWrap: { width: 90, position: 'relative' },
  postImage:     { width: 90, height: 90 },
  statusBadge:   { position: 'absolute', bottom: 4, left: 4, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  statusText:    { fontSize: 9, fontWeight: '700' },
  postInfo:      { flex: 1, padding: 12 },
  postCaption:   { color: Colors.white, fontSize: 13, lineHeight: 18, marginBottom: 6 },
  postMeta:      { gap: 3, marginBottom: 8 },
  postDate:      { color: Colors.textDim, fontSize: 11 },
  viewsRow:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewsText:     { color: Colors.textDim, fontSize: 11 },
  rejectionReason:{ color: Colors.error, fontSize: 11 },
  deleteBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  deleteBtnText: { color: Colors.error, fontSize: 12 },
});
