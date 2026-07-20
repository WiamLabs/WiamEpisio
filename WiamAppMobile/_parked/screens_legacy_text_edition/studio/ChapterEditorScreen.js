/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 (Text Edition park).
 * Do not wire into active navigation. Pending possible future Text Edition.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import AppBackground from '../../components/AppBackground';
import SkeletonLoader from '../../components/common/SkeletonLoader';
import studioApi from '../../api/studio';
import NativeRichEditor from '../../components/NativeRichEditor';
import {
  ArrowLeft, Save, ChevronLeft, ChevronRight, Plus, MoreVertical,
  Eye, EyeOff, BookOpen, House, Clock,
} from 'lucide-react-native';

const AUTOSAVE_MS = 30000;

const ChapterEditorScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { bookId, chapterNumber: initCh, storyTitle } = route.params;
  const [chNum, setChNum] = useState(initCh || 1);
  const [chTitle, setChTitle] = useState('');
  const [chStatus, setChStatus] = useState('draft');
  const [scheduledAt, setScheduledAt] = useState(null);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [totalChapters, setTotalChapters] = useState(1);
  const [showMenu, setShowMenu] = useState(false);
  const [initialBody, setInitialBody] = useState('');
  const [unitLabel, setUnitLabel] = useState('chapter');
  const timerRef = useRef(null);
  const bodyRef = useRef('');
  const editorRef = useRef(null);
  const unitCap = (unitLabel || 'chapter').charAt(0).toUpperCase() + (unitLabel || 'chapter').slice(1);

  const stripHtmlForCount = (html) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  };

  const countWords = (text) => {
    const plain = stripHtmlForCount(text);
    if (!plain) return 0;
    return plain.split(/\s+/).filter(Boolean).length;
  };

  const loadChapter = useCallback(async (num) => {
    setLoading(true);
    try {
      const ch = await studioApi.getChapter(bookId, num);
      setChTitle(ch.chapter_title || '');
      setUnitLabel((ch.unit_label || 'chapter').toLowerCase());
      setChStatus(ch.status || 'draft');
      const body = ch.body || '';
      bodyRef.current = body;
      setInitialBody(body);
      setWordCount(ch.word_count || countWords(body));
      setCharCount(stripHtmlForCount(body).length);
      setChNum(num);
      setDirty(false);
      setLastSaved(ch.updated_at ? new Date(ch.updated_at) : null);
    } catch (e) {
      Alert.alert('Error', typeof e === 'string' ? e : 'Could not load chapter.');
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  const loadStoryInfo = useCallback(async () => {
    try {
      const s = await studioApi.getStory(bookId);
      setTotalChapters(s.chapters?.length || 1);
      setUnitLabel((s.content_unit_label || 'chapter').toLowerCase());
    } catch {}
  }, [bookId]);

  useEffect(() => {
    loadChapter(initCh || 1);
    loadStoryInfo();
  }, []);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (dirty) doSave(true);
    }, AUTOSAVE_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [dirty, chNum, chTitle]);

  const doSave = async (auto = false) => {
    if (saving) return;
    setSaving(true);
    try {
      const wc = countWords(bodyRef.current);
      await studioApi.saveChapter(bookId, {
        chapter_number: chNum,
        chapter_title: chTitle,
        body: bodyRef.current,
        word_count: wc,
      });
      setWordCount(wc);
      setDirty(false);
      setLastSaved(new Date());
    } catch (e) {
      if (!auto) Alert.alert('Save Error', typeof e === 'string' ? e : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditorChange = useCallback((data) => {
    bodyRef.current = data.html || '';
    setWordCount(data.wordCount || 0);
    setCharCount(data.charCount || 0);
    setDirty(true);
  }, []);

  const goToChapter = async (num) => {
    if (dirty) await doSave();
    loadChapter(num);
    loadStoryInfo();
  };

  const handleAddChapter = async () => {
    if (dirty) await doSave();
    try {
      const res = await studioApi.addChapter(bookId);
      setTotalChapters((prev) => prev + 1);
      loadChapter(res.chapter_number);
    } catch (e) {
      Alert.alert('Error', typeof e === 'string' ? e : 'Could not add chapter.');
    }
  };

  const handleDeleteChapter = () => {
    if (totalChapters <= 1) return Alert.alert('Cannot Delete', `Cannot delete the only ${unitLabel}.`);
    Alert.alert(`Delete ${unitCap}`, `Delete ${unitCap} ${chNum}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await studioApi.deleteChapter(bookId, chNum);
            setTotalChapters((prev) => Math.max(1, prev - 1));
            loadChapter(Math.max(1, chNum - 1));
            loadStoryInfo();
          } catch (e) {
            Alert.alert('Error', typeof e === 'string' ? e : 'Could not delete chapter.');
          }
        },
      },
    ]);
  };

  const handlePublishToggle = async () => {
    if (dirty) await doSave();
    const publish = chStatus !== 'published';
    try {
      await studioApi.publishChapter(bookId, chNum, publish);
      setChStatus(publish ? 'published' : 'draft');
      Alert.alert(
        publish ? 'Published' : 'Unpublished',
        publish ? `${unitCap} is now live!` : `${unitCap} moved to draft.`
      );
    } catch (e) {
      Alert.alert('Error', typeof e === 'string' ? e : 'Failed to update chapter status.');
    }
  };

  const handleBack = async () => {
    if (dirty) await doSave();
    navigation.goBack();
  };

  const fmtTime = (d) => {
    if (!d) return '';
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  if (loading) {
    return (
      <AppBackground>
        <View style={styles.loadingWrap}>
          <SkeletonLoader.ListItem count={3} />
          <Text style={styles.loadingText}>Loading chapter...</Text>
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        {/* Top Bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity onPress={handleBack} style={styles.iconBtn}>
            <ArrowLeft color={COLORS.white} size={22} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Main')} style={styles.iconBtn}>
            <House color={COLORS.secondary} size={18} />
          </TouchableOpacity>
          <View style={styles.topCenter}>
            <Text style={styles.topTitle} numberOfLines={1}>{storyTitle || 'Story'}</Text>
            <Text style={styles.topSub}>{unitCap} {chNum} of {totalChapters}</Text>
          </View>
          {/* Publish toggle ΓÇö three-state: Live, Scheduled, Draft. */}
          <TouchableOpacity
            onPress={handlePublishToggle}
            style={[
              styles.publishBtn,
              chStatus === 'published' && styles.publishBtnActive,
              chStatus !== 'published' && scheduledAt && styles.publishBtnScheduled,
            ]}
          >
            {chStatus === 'published' ? (
              <Eye color="#2ecc71" size={14} />
            ) : scheduledAt ? (
              <Clock color={COLORS.secondary} size={14} />
            ) : (
              <EyeOff color={COLORS.textMuted} size={14} />
            )}
            <Text
              style={[
                styles.publishBtnText,
                chStatus === 'published' && styles.publishBtnTextActive,
                chStatus !== 'published' && scheduledAt && styles.publishBtnTextScheduled,
              ]}
            >
              {chStatus === 'published' ? 'Live' : scheduledAt ? 'Scheduled' : 'Draft'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => doSave()} style={styles.iconBtn}>
            {saving ? <ActivityIndicator size={18} color={COLORS.secondary} /> : <Save color={COLORS.secondary} size={22} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowMenu(!showMenu)} style={styles.iconBtn}>
            <MoreVertical color={COLORS.textMuted} size={22} />
          </TouchableOpacity>
        </View>

        {/* Dropdown Menu */}
        {showMenu && (
          <View style={[styles.menu, { top: insets.top + 52 }]}>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); handleAddChapter(); }}>
              <Plus color={COLORS.secondary} size={16} />
              <Text style={styles.menuText}>Add New {unitCap}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); handlePublishToggle(); }}>
              {chStatus === 'published' ? <EyeOff color={COLORS.textMuted} size={16} /> : <Eye color="#2ecc71" size={16} />}
              <Text style={styles.menuText}>{chStatus === 'published' ? `Unpublish ${unitCap}` : `Publish ${unitCap}`}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); navigation.navigate('StoryManager', { bookId }); }}>
              <BookOpen color={COLORS.textSecondary} size={16} />
              <Text style={styles.menuText}>Story Manager</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => { setShowMenu(false); handleDeleteChapter(); }}>
              <Text style={[styles.menuText, { color: '#ef4444' }]}>Delete This {unitCap}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Chapter Title */}
        <View style={styles.titleWrap}>
          <TextInput
            style={styles.chTitleInput}
            placeholder={`${unitCap} Title`}
            placeholderTextColor={COLORS.textMuted}
            value={chTitle}
            onChangeText={(t) => { setChTitle(t); setDirty(true); }}
            maxLength={100}
          />
        </View>

        {/* Native Rich Text Editor (App Store compliant ΓÇö no raw WebView) */}
        <View style={styles.editorWrap}>
          <NativeRichEditor
            initialContent={initialBody}
            placeholder={`Start writing your ${unitLabel} here...`}
            onChange={handleEditorChange}
            editorRef={editorRef}
            style={{ flex: 1 }}
          />
        </View>

        {/* Stats Bar */}
        <View style={styles.statsBar}>
          <Text style={styles.statItem}>{wordCount.toLocaleString()} words</Text>
          <View style={styles.statDot} />
          <Text style={styles.statItem}>{charCount.toLocaleString()} chars</Text>
          <View style={styles.statDot} />
          <Text style={styles.statItem}>{readTime} min read</Text>
          {lastSaved && (
            <>
              <View style={styles.statDot} />
              <Text style={styles.statItemSaved}>
                {saving ? 'Saving...' : `Saved ${fmtTime(lastSaved)}`}
              </Text>
            </>
          )}
          {dirty && !saving && <View style={styles.dirtyDot} />}
        </View>

        {/* Bottom Nav Bar */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8) }]}>
          <TouchableOpacity
            onPress={() => chNum > 1 && goToChapter(chNum - 1)}
            disabled={chNum <= 1}
            style={[styles.navBtn, chNum <= 1 && styles.navBtnDisabled]}
          >
            <ChevronLeft color={chNum > 1 ? COLORS.white : COLORS.textMuted} size={20} />
            <Text style={[styles.navBtnText, chNum <= 1 && { color: COLORS.textMuted }]}>Prev</Text>
          </TouchableOpacity>

          <View style={styles.bottomCenter}>
            <Text style={styles.chNavLabel}>{unitCap} {chNum}</Text>
          </View>

          <TouchableOpacity
            onPress={() => chNum < totalChapters ? goToChapter(chNum + 1) : handleAddChapter()}
            style={styles.navBtn}
          >
            {chNum < totalChapters ? (
              <>
                <Text style={styles.navBtnText}>Next</Text>
                <ChevronRight color={COLORS.white} size={20} />
              </>
            ) : (
              <>
                <Text style={[styles.navBtnText, { color: COLORS.secondary }]}>New</Text>
                <Plus color={COLORS.secondary} size={20} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.textMuted, marginTop: 12, fontSize: 14 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8,
    paddingBottom: 6,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  iconBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  topCenter: { flex: 1, marginHorizontal: 4 },
  topTitle: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  topSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  publishBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  publishBtnActive: { backgroundColor: 'rgba(46,204,113,0.12)' },
  publishBtnScheduled: { backgroundColor: 'rgba(212,168,67,0.12)' },
  publishBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  publishBtnTextActive: { color: '#2ecc71' },
  publishBtnTextScheduled: { color: COLORS.secondary },
  menu: {
    position: 'absolute', right: 12, zIndex: 100,
    backgroundColor: 'rgba(20,20,30,0.98)', borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', minWidth: 200,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  menuText: { fontSize: 15, color: COLORS.white },
  titleWrap: { paddingHorizontal: SPACING.lg, paddingTop: 10, paddingBottom: 4 },
  chTitleInput: {
    fontSize: 20, fontWeight: 'bold', color: COLORS.white,
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  editorWrap: {
    flex: 1,
    marginTop: 2,
    marginHorizontal: 0,
    backgroundColor: '#08081a',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  statsBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 6, paddingHorizontal: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  statItem: { fontSize: 11, color: COLORS.textMuted, fontWeight: '500' },
  statItemSaved: { fontSize: 11, color: COLORS.textMuted },
  statDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 8 },
  dirtyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.secondary, marginLeft: 8 },
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  navBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { fontSize: 13, color: COLORS.white, fontWeight: '600' },
  bottomCenter: { alignItems: 'center' },
  chNavLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
});

export default ChapterEditorScreen;