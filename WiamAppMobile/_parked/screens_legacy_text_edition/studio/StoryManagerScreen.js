/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 (Text Edition park).
 * Do not wire into active navigation. Pending possible future Text Edition.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, RefreshControl, Image,
} from 'react-native';
import CachedImage from '../../components/common/CachedImage';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import AppBackground from '../../components/AppBackground';
import SkeletonLoader from '../../components/common/SkeletonLoader';
import studioApi from '../../api/studio';
import {
  ArrowLeft, Settings, Trash2, Upload, Send, FileText,
  Eye, EyeOff, Lock, ChevronRight, BookOpen, PenLine,
  Plus, CheckCheck, ChevronDown, ImagePlus, BarChart3, House, Clock,
} from 'lucide-react-native';
import BrandedFooter from '../../components/BrandedFooter';

const StoryManagerScreen = ({ navigation, route }) => {
  const { bookId } = route.params;
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('chapters');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [genres, setGenres] = useState([]);
  const [showGenres, setShowGenres] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishingAll, setPublishingAll] = useState(false);
  const [unitLabel, setUnitLabel] = useState('chapter');

  const load = useCallback(async () => {
    try {
      const s = await studioApi.getStory(bookId);
      setStory(s);
      setUnitLabel((s.content_unit_label || 'chapter').toLowerCase());
      setTitle(s.title || '');
      setAuthor(s.author || '');
      setDescription(s.description || '');
      setGenre(s.genre || '');
    } catch (e) {
      Alert.alert('Error', typeof e === 'string' ? e : 'Could not load story.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bookId]);

  useEffect(() => {
    load();
    studioApi.getGenres().then((d) => setGenres(d.genres || [])).catch(() => {});
  }, []);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await studioApi.updateSettings(bookId, { title, description, genre, author });
      Alert.alert('Saved', 'Story settings updated.');
      load();
    } catch (e) {
      Alert.alert('Error', typeof e === 'string' ? e : 'Could not save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUploadCover = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission', 'Camera roll permission is needed.');
    // No `allowsEditing` ΓÇö the OS crop box is too small. Server normalizes to 600├ù900.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.95,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    setUploadingCover(true);
    try {
      await studioApi.uploadCover(bookId, uri);
      Alert.alert('Done', 'Cover uploaded successfully.');
      load();
    } catch (e) {
      Alert.alert('Error', typeof e === 'string' ? e : 'Cover upload failed.');
    } finally {
      setUploadingCover(false);
    }
  };

  const handlePublish = (action) => {
    const label = action === 'draft' ? 'Move to Drafts' : action === 'complete' ? 'Publish as Complete' : 'Publish as Ongoing';
    Alert.alert(label, 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes', onPress: async () => {
          setPublishing(true);
          try {
            await studioApi.publishStory(bookId, action);
            Alert.alert('Done', action === 'draft' ? 'Story moved to drafts.' : 'Story published!');
            load();
          } catch (e) {
            Alert.alert('Error', typeof e === 'string' ? e : 'Publish failed.');
          } finally {
            setPublishing(false);
          }
        },
      },
    ]);
  };

  const handlePublishChapter = async (ch, publish) => {
    try {
      await studioApi.publishChapter(bookId, ch.chapter_number, publish);
      load();
    } catch (e) {
      Alert.alert('Error', typeof e === 'string' ? e : 'Failed.');
    }
  };

  const unitCap = (unitLabel || 'chapter').charAt(0).toUpperCase() + (unitLabel || 'chapter').slice(1);

  const handlePublishAllDrafts = () => {
    const draftCount = chapters.filter((c) => c.status !== 'published').length;
    if (draftCount === 0) return Alert.alert('Info', 'All chapters are already published.');
    Alert.alert('Publish All Drafts', `Publish ${draftCount} draft ${unitLabel}(s)?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Publish All', onPress: async () => {
          setPublishingAll(true);
          try {
            const res = await studioApi.publishAllDrafts(bookId);
            Alert.alert('Done', `${res.published_count || draftCount} ${unitLabel}(s) published!`);
            load();
          } catch (e) {
            Alert.alert('Error', typeof e === 'string' ? e : 'Failed to publish all.');
          } finally {
            setPublishingAll(false);
          }
        },
      },
    ]);
  };

  const handleAddChapter = async () => {
    try {
      const res = await studioApi.addChapter(bookId);
      navigation.navigate('ChapterEditor', {
        bookId,
        chapterNumber: res.chapter_number,
        storyTitle: story?.title,
      });
    } catch (e) {
      Alert.alert('Error', typeof e === 'string' ? e : 'Could not add chapter.');
    }
  };

  const handleDeleteStory = () => {
    Alert.alert(
      'Delete Story',
      `Permanently delete "${story?.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever', style: 'destructive', onPress: async () => {
            try {
              await studioApi.deleteStory(bookId);
              Alert.alert('Deleted', 'Story has been deleted.');
              navigation.goBack();
            } catch (e) {
              Alert.alert('Error', typeof e === 'string' ? e : 'Could not delete.');
            }
          },
        },
      ],
    );
  };

  const statusColor = (s) => {
    if (s === 'published') return '#2ecc71';
    if (s === 'draft') return COLORS.textMuted;
    if (s === 'ongoing') return '#5dade2';
    if (s === 'complete') return '#2ecc71';
    return '#f39c12';
  };

  if (loading) {
    return (
      <AppBackground>
        <View style={styles.loadWrap}>
          <SkeletonLoader.ListItem count={5} />
        </View>
      </AppBackground>
    );
  }

  const chapters = story?.chapters || [];
  const totalWords = chapters.reduce((sum, c) => sum + (c.word_count || 0), 0);
  const publishedCount = chapters.filter((c) => c.status === 'published').length;
  const draftCount = chapters.length - publishedCount;

  return (
    <AppBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.secondary} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft color={COLORS.white} size={24} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Main')} style={styles.homeBtn}>
            <House color={COLORS.secondary} size={20} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{story?.title || 'Story'}</Text>
            <Text style={styles.headerSub}>
              {story?.genre ? `${story.genre} ┬╖ ` : ''}{chapters.length} ch ┬╖ {totalWords.toLocaleString()} words
            </Text>
          </View>
          <TouchableOpacity
            style={styles.analyticsBtn}
            onPress={() => navigation.navigate('StoryAnalytics', { bookId, title: story?.title })}
            accessibilityLabel="View analytics"
          >
            <BarChart3 color={COLORS.secondary} size={18} />
          </TouchableOpacity>
          <View style={[styles.statusBadge, { backgroundColor: statusColor(story?.status) + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor(story?.status) }]}>
              {(story?.status || 'draft').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Cover + Quick Actions */}
        <View style={styles.coverRow}>
          <TouchableOpacity onPress={handleUploadCover} activeOpacity={0.7}>
            {story?.cover_url ? (
              <CachedImage source={{ uri: story.cover_url }} style={styles.coverImg} />
            ) : (
              <View style={[styles.coverImg, styles.coverPlaceholder]}>
                <ImagePlus color={COLORS.secondary} size={24} />
                <Text style={styles.coverPlaceholderText}>Add Cover</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.coverActions}>
            <TouchableOpacity style={styles.actionBtnPrimary} onPress={handleUploadCover} disabled={uploadingCover}>
              {uploadingCover ? <ActivityIndicator size={16} color={COLORS.black} /> : <Upload color={COLORS.black} size={16} />}
              <Text style={styles.actionBtnPrimaryText}>{uploadingCover ? 'Uploading...' : story?.cover_url ? 'Change Cover' : 'Upload Cover'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation.navigate('ChapterEditor', { bookId, chapterNumber: 1, storyTitle: story?.title })}
            >
              <PenLine color={COLORS.secondary} size={16} />
              <Text style={styles.actionBtnText}>Write</Text>
            </TouchableOpacity>
            {/* Stats row */}
            <View style={styles.miniStats}>
              <View style={styles.miniStat}>
                <Text style={styles.miniStatVal}>{publishedCount}</Text>
                <Text style={styles.miniStatLabel}>Published</Text>
              </View>
              <View style={styles.miniStatDivider} />
              <View style={styles.miniStat}>
                <Text style={styles.miniStatVal}>{draftCount}</Text>
                <Text style={styles.miniStatLabel}>Drafts</Text>
              </View>
              <View style={styles.miniStatDivider} />
              <View style={styles.miniStat}>
                <Text style={styles.miniStatVal}>{totalWords.toLocaleString()}</Text>
                <Text style={styles.miniStatLabel}>Words</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, tab === 'chapters' && styles.tabActive]} onPress={() => setTab('chapters')}>
            <Text style={[styles.tabText, tab === 'chapters' && styles.tabTextActive]}>{`${unitCap}s (${chapters.length})`}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'settings' && styles.tabActive]} onPress={() => setTab('settings')}>
            <Text style={[styles.tabText, tab === 'settings' && styles.tabTextActive]}>Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'publish' && styles.tabActive]} onPress={() => setTab('publish')}>
            <Text style={[styles.tabText, tab === 'publish' && styles.tabTextActive]}>Publish</Text>
          </TouchableOpacity>
        </View>

        {tab === 'chapters' && (
          <View>
            {/* Add Chapter + Publish All buttons */}
            <View style={styles.chActionRow}>
              <TouchableOpacity style={styles.addChBtn} onPress={handleAddChapter}>
                <Plus color={COLORS.black} size={18} />
                <Text style={styles.addChBtnText}>Add {unitCap}</Text>
              </TouchableOpacity>
              {draftCount > 0 && (
                <TouchableOpacity style={styles.pubAllBtn} onPress={handlePublishAllDrafts} disabled={publishingAll}>
                  {publishingAll ? <ActivityIndicator size={14} color={COLORS.white} /> : <CheckCheck color={COLORS.white} size={16} />}
                  <Text style={styles.pubAllBtnText}>Publish All ({draftCount})</Text>
                </TouchableOpacity>
              )}
            </View>

            {chapters.map((ch, idx) => (
              <TouchableOpacity
                key={ch.id || idx}
                style={styles.chRow}
                onPress={() => navigation.navigate('ChapterEditor', { bookId, chapterNumber: ch.chapter_number, storyTitle: story?.title })}
              >
                <View style={styles.chNum}>
                  <Text style={styles.chNumText}>{ch.chapter_number}</Text>
                </View>
                <View style={styles.chInfo}>
                  <Text style={styles.chTitle} numberOfLines={1}>
                    {ch.chapter_title || `${unitCap} ${ch.chapter_number}`}
                  </Text>
                  <Text style={styles.chMeta}>
                    {(ch.word_count || 0).toLocaleString()} words
                    {ch.updated_at ? ` ┬╖ ${new Date(ch.updated_at).toLocaleDateString()}` : ''}
                  </Text>
                </View>
                <View style={styles.chRight}>
                  {ch.status === 'published' ? (
                    <TouchableOpacity
                      style={[styles.chStatusBtn, { backgroundColor: statusColor('published') + '15' }]}
                      onPress={(e) => { e.stopPropagation?.(); handlePublishChapter(ch, false); }}
                    >
                      <Eye color={statusColor('published')} size={13} />
                      <Text style={[styles.chStatusText, { color: statusColor('published') }]}>Live</Text>
                    </TouchableOpacity>
                  ) : ch.is_scheduled ? (
                    <View style={[styles.chStatusBtn, { backgroundColor: COLORS.secondary + '15' }]}>
                      <Clock color={COLORS.secondary} size={13} />
                      <Text style={[styles.chStatusText, { color: COLORS.secondary }]}>Scheduled</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.chStatusBtn, { backgroundColor: statusColor('draft') + '15' }]}
                      onPress={(e) => { e.stopPropagation?.(); handlePublishChapter(ch, true); }}
                    >
                      <EyeOff color={statusColor('draft')} size={13} />
                      <Text style={[styles.chStatusText, { color: statusColor('draft') }]}>Draft</Text>
                    </TouchableOpacity>
                  )}
                  {ch.is_locked && <Lock color="#f39c12" size={13} />}
                  <ChevronRight color={COLORS.textMuted} size={16} />
                </View>
              </TouchableOpacity>
            ))}

            {chapters.length === 0 && (
              <View style={styles.emptyState}>
                <BookOpen color={COLORS.textMuted} size={40} />
                <Text style={styles.emptyTitle}>No {unitLabel}s yet</Text>
                <Text style={styles.emptyText}>{`Tap "Add ${unitCap}" to start writing your story.`}</Text>
              </View>
            )}
          </View>
        )}

        {tab === 'settings' && (
          <View>
            <Text style={styles.label}>Title</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholderTextColor={COLORS.textMuted} placeholder="Story title" maxLength={200} />

            <Text style={styles.label}>Author / Pen Name</Text>
            <TextInput style={styles.input} value={author} onChangeText={setAuthor} placeholderTextColor={COLORS.textMuted} placeholder="Pen name" maxLength={100} />

            <Text style={styles.label}>Genre</Text>
            <TouchableOpacity style={styles.genreBtn} onPress={() => setShowGenres(!showGenres)}>
              <Text style={genre ? styles.genreText : styles.genrePlaceholder}>{genre || 'Select genre'}</Text>
              <ChevronDown color={COLORS.textMuted} size={18} />
            </TouchableOpacity>
            {showGenres && (
              <View style={styles.genreList}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 180 }}>
                  {genres.map((g) => (
                    <TouchableOpacity key={g.id} style={styles.genreItem} onPress={() => { setGenre(g.name); setShowGenres(false); }}>
                      <Text style={[styles.genreItemText, genre === g.name && { color: COLORS.secondary, fontWeight: '700' }]}>{g.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <Text style={styles.label}>Synopsis</Text>
            <TextInput
              style={[styles.input, { minHeight: 100 }]}
              value={description} onChangeText={setDescription}
              placeholderTextColor={COLORS.textMuted} placeholder="Story synopsis"
              multiline textAlignVertical="top" maxLength={500}
            />
            <Text style={styles.charCount}>{description.length}/500</Text>

            <TouchableOpacity
              style={[styles.saveBtn, savingSettings && { opacity: 0.6 }]}
              onPress={handleSaveSettings} disabled={savingSettings}
            >
              {savingSettings ? <ActivityIndicator color={COLORS.black} /> : (
                <><Settings color={COLORS.black} size={18} /><Text style={styles.saveBtnText}>Save Settings</Text></>
              )}
            </TouchableOpacity>

            {/* Delete */}
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteStory}>
              <Trash2 color="#ef4444" size={18} />
              <Text style={styles.deleteBtnText}>Delete Story Permanently</Text>
            </TouchableOpacity>
          </View>
        )}

        {tab === 'publish' && (
          <View>
            {/* Story Status */}
            <View style={styles.publishCard}>
              <Text style={styles.publishCardTitle}>Story Status</Text>
              <Text style={styles.publishCardDesc}>
                Change your story's visibility. Readers can only see published stories.
              </Text>
              <View style={styles.publishRow}>
                {story?.status === 'draft' ? (
                  <>
                    <TouchableOpacity style={styles.pubBtn} onPress={() => handlePublish('ongoing')} disabled={publishing}>
                      <Send color={COLORS.white} size={16} />
                      <Text style={styles.pubBtnText}>Ongoing</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.pubBtn, { backgroundColor: '#2ecc71' }]} onPress={() => handlePublish('complete')} disabled={publishing}>
                      <Send color={COLORS.white} size={16} />
                      <Text style={styles.pubBtnText}>Complete</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {story?.status !== 'ongoing' && (
                      <TouchableOpacity style={styles.pubBtn} onPress={() => handlePublish('ongoing')} disabled={publishing}>
                        <Send color={COLORS.white} size={16} />
                        <Text style={styles.pubBtnText}>Ongoing</Text>
                      </TouchableOpacity>
                    )}
                    {story?.status !== 'complete' && (
                      <TouchableOpacity style={[styles.pubBtn, { backgroundColor: '#2ecc71' }]} onPress={() => handlePublish('complete')} disabled={publishing}>
                        <Send color={COLORS.white} size={16} />
                        <Text style={styles.pubBtnText}>Complete</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.pubBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]} onPress={() => handlePublish('draft')} disabled={publishing}>
                      <FileText color={COLORS.white} size={16} />
                      <Text style={styles.pubBtnText}>Draft</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>

            {/* Chapter Publishing */}
            <View style={styles.publishCard}>
              <Text style={styles.publishCardTitle}>{`${unitCap} Publishing`}</Text>
              <Text style={styles.publishCardDesc}>
                {`Publish ${unitLabel}s one by one, or publish all at once. Readers see published ${unitLabel}s only.`}
              </Text>
              <View style={{ gap: 6, marginTop: 8 }}>
                <Text style={styles.publishStat}>
                  <Text style={{ color: '#2ecc71', fontWeight: '700' }}>{publishedCount}</Text> published ┬╖ <Text style={{ color: COLORS.textMuted, fontWeight: '700' }}>{draftCount}</Text> draft
                </Text>
              </View>
              {draftCount > 0 && (
                <TouchableOpacity style={[styles.pubAllBtnLarge]} onPress={handlePublishAllDrafts} disabled={publishingAll}>
                  {publishingAll ? <ActivityIndicator size={16} color={COLORS.black} /> : <CheckCheck color={COLORS.black} size={18} />}
                  <Text style={styles.pubAllBtnLargeText}>{`Publish All ${draftCount} Draft ${unitCap}s`}</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.publishTip}>
              {`Tip: You can publish one ${unitLabel} at a time to keep readers engaged. Go to the ${unitCap}s tab and tap the status badge next to each ${unitLabel} to publish or unpublish it individually.`}
            </Text>
          </View>
        )}

        <BrandedFooter compact />
        <View style={{ height: 120 }} />
      </ScrollView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.lg },
  loadWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.xl, marginBottom: SPACING.lg },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  homeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(212,168,67,0.12)',
    borderWidth: 1, borderColor: 'rgba(212,168,67,0.3)',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.secondary, fontFamily: FONTS.display },
  headerSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  analyticsBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(212,168,67,0.12)',
    borderWidth: 1, borderColor: 'rgba(212,168,67,0.3)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 8,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  coverRow: { flexDirection: 'row', marginBottom: SPACING.lg, gap: 14 },
  coverImg: { width: 90, height: 135, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' },
  coverPlaceholder: { justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(212,168,67,0.25)', borderStyle: 'dashed' },
  coverPlaceholderText: { fontSize: 10, color: COLORS.secondary, fontWeight: '600', marginTop: 4 },
  coverActions: { flex: 1, justifyContent: 'space-between', gap: 8 },
  actionBtnPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.secondary, paddingVertical: 10, paddingHorizontal: 14, borderRadius: RADIUS.md },
  actionBtnPrimaryText: { fontSize: 13, color: COLORS.black, fontWeight: '700' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 9, paddingHorizontal: 14, borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  actionBtnText: { fontSize: 13, color: COLORS.secondary, fontWeight: '600' },
  miniStats: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: RADIUS.sm, paddingVertical: 8 },
  miniStat: { flex: 1, alignItems: 'center' },
  miniStatVal: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  miniStatLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  miniStatDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.06)' },
  tabs: { flexDirection: 'row', marginBottom: SPACING.lg, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.secondary },
  tabText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '600' },
  tabTextActive: { color: COLORS.secondary },
  chActionRow: { flexDirection: 'row', gap: 10, marginBottom: SPACING.md },
  addChBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.secondary, paddingVertical: 12, borderRadius: RADIUS.md },
  addChBtnText: { color: COLORS.black, fontSize: 14, fontWeight: '700' },
  pubAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#2ecc71', paddingVertical: 12, paddingHorizontal: 14, borderRadius: RADIUS.md },
  pubAllBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  chRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  chNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  chNumText: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  chInfo: { flex: 1, minWidth: 0 },
  chTitle: { fontSize: 15, fontWeight: '600', color: COLORS.white },
  chMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 3 },
  chRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chStatusBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  chStatusText: { fontSize: 10, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.white, marginTop: 12 },
  emptyText: { fontSize: 13, color: COLORS.textMuted, marginTop: 4, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: RADIUS.md, padding: SPACING.md, color: COLORS.white, fontSize: 16 },
  charCount: { fontSize: 12, color: COLORS.textMuted, textAlign: 'right', marginTop: 4 },
  genreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: RADIUS.md, padding: SPACING.md },
  genreText: { fontSize: 16, color: COLORS.white },
  genrePlaceholder: { fontSize: 16, color: COLORS.textMuted },
  genreList: { backgroundColor: 'rgba(20,20,30,0.98)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: RADIUS.md, marginTop: 4 },
  genreItem: { paddingVertical: 12, paddingHorizontal: SPACING.md, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  genreItemText: { fontSize: 15, color: COLORS.textSecondary },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.secondary, paddingVertical: 14, borderRadius: RADIUS.md, marginTop: 20 },
  saveBtnText: { color: COLORS.black, fontSize: 16, fontWeight: 'bold' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 32, paddingVertical: 14, borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.08)' },
  deleteBtnText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
  publishCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: RADIUS.md, padding: SPACING.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: SPACING.md },
  publishCardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.white, marginBottom: 6 },
  publishCardDesc: { fontSize: 13, color: COLORS.textMuted, lineHeight: 19 },
  publishStat: { fontSize: 14, color: COLORS.textSecondary },
  publishRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  pubBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#5dade2', paddingVertical: 13, borderRadius: RADIUS.md },
  pubBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  pubAllBtnLarge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.secondary, paddingVertical: 14, borderRadius: RADIUS.md, marginTop: 14 },
  pubAllBtnLargeText: { color: COLORS.black, fontSize: 15, fontWeight: '700' },
  publishTip: { fontSize: 13, color: COLORS.textMuted, lineHeight: 20, marginTop: 12, padding: SPACING.md, backgroundColor: 'rgba(212,168,67,0.06)', borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(212,168,67,0.15)' },
});

export default StoryManagerScreen;