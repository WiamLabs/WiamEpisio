import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  RefreshControl, TextInput, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import booksApi from '../../api/books';
import { ArrowLeft, Trash2, Edit3, BookOpen, Lock, Globe, Check } from 'lucide-react-native';
import resolveUrl from '../../utils/resolveUrl';

const ReadingListDetailScreen = ({ navigation, route }) => {
  const { listId } = route.params;
  const insets = useSafeAreaInsets();
  const [list, setList] = useState(null);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [isOwner, setIsOwner] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await booksApi.getReadingList(listId);
      const data = res.list || {};
      setList(data);
      setBooks(data.books || []);
      setIsOwner(data.is_owner || false);
      setEditName(data.name || '');
      setEditDesc(data.description || '');
    } catch (e) {
      console.error('Error fetching reading list', e);
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const saveEdit = async () => {
    try {
      const res = await booksApi.updateReadingList(listId, { name: editName, description: editDesc });
      setList(res.list || list);
      setEditing(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to save changes');
    }
  };

  const toggleVisibility = async () => {
    try {
      const res = await booksApi.updateReadingList(listId, { is_public: !list.is_public });
      setList(res.list || list);
    } catch (e) {
      Alert.alert('Error', 'Failed to update visibility');
    }
  };

  const removeBook = async (contentId) => {
    Alert.alert('Remove Book', 'Remove this book from the list?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await booksApi.removeFromReadingList(listId, contentId);
            setBooks((prev) => prev.filter((b) => b.id !== contentId));
            setList((prev) => prev ? { ...prev, item_count: Math.max(0, (prev.item_count || 1) - 1) } : prev);
          } catch (e) {
            Alert.alert('Error', 'Failed to remove book');
          }
        },
      },
    ]);
  };

  const deleteList = () => {
    Alert.alert('Delete List', `Delete "${list?.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await booksApi.deleteReadingList(listId);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete list');
          }
        },
      },
    ]);
  };

  const renderBook = ({ item }) => (
    <TouchableOpacity
      style={styles.bookCard}
      onPress={() => navigation.navigate('BookDetail', { bookId: item.id })}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: resolveUrl(item.cover_url) || 'https://via.placeholder.com/150x225' }}
        style={styles.bookCover}
      />
      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.bookAuthor} numberOfLines={1}>{item.author}</Text>
        {item.list_note ? <Text style={styles.bookNote} numberOfLines={2}>{item.list_note}</Text> : null}
        {item.genre ? (
          <View style={styles.genreBadge}>
            <Text style={styles.genreText}>{item.genre}</Text>
          </View>
        ) : null}
      </View>
      {isOwner && (
        <TouchableOpacity style={styles.removeBtn} onPress={() => removeBook(item.id)} hitSlop={10}>
          <Trash2 size={16} color="#ef4444" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <ArrowLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {editing ? (
            <TextInput
              style={styles.editInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="List name"
              placeholderTextColor={COLORS.textMuted}
              autoFocus
            />
          ) : (
            <Text style={styles.headerTitle} numberOfLines={1}>{list?.name || 'Reading List'}</Text>
          )}
        </View>
        {isOwner && !editing && (
          <TouchableOpacity onPress={() => setEditing(true)} hitSlop={12}>
            <Edit3 size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
        {editing && (
          <TouchableOpacity onPress={saveEdit} hitSlop={12}>
            <Check size={20} color={COLORS.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Meta bar */}
      {list && !editing && (
        <View style={styles.metaBar}>
          <Text style={styles.metaText}>{list.item_count || 0} book{list.item_count !== 1 ? 's' : ''}</Text>
          {isOwner && (
            <TouchableOpacity style={styles.visBtn} onPress={toggleVisibility}>
              {list.is_public ? <Globe size={14} color={COLORS.textMuted} /> : <Lock size={14} color={COLORS.textMuted} />}
              <Text style={styles.visText}>{list.is_public ? 'Public' : 'Private'}</Text>
            </TouchableOpacity>
          )}
          {isOwner && (
            <TouchableOpacity onPress={deleteList} hitSlop={10}>
              <Trash2 size={16} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Description edit */}
      {editing && (
        <View style={styles.descEditWrap}>
          <TextInput
            style={styles.descInput}
            value={editDesc}
            onChangeText={setEditDesc}
            placeholder="Description (optional)"
            placeholderTextColor={COLORS.textMuted}
            multiline
            maxLength={300}
          />
        </View>
      )}

      {/* Description display */}
      {!editing && list?.description ? (
        <Text style={styles.description}>{list.description}</Text>
      ) : null}

      {/* Book list */}
      <FlatList
        data={books}
        renderItem={renderBook}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchList} tintColor={COLORS.secondary} />
        }
        ListEmptyComponent={
          !loading && (
            <View style={styles.empty}>
              <BookOpen color={COLORS.textMuted} size={56} strokeWidth={1} />
              <Text style={styles.emptyTitle}>No books in this list</Text>
              <Text style={styles.emptySub}>Add books from the book detail page</Text>
            </View>
          )
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  editInput: {
    fontSize: 18, fontWeight: '700', color: COLORS.text,
    borderBottomWidth: 1, borderBottomColor: COLORS.secondary, paddingBottom: 4,
  },
  metaBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: SPACING.md, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  metaText: { fontSize: 13, color: COLORS.textMuted, flex: 1 },
  visBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  visText: { fontSize: 12, color: COLORS.textMuted },
  descEditWrap: { paddingHorizontal: SPACING.md, paddingVertical: 8 },
  descInput: {
    fontSize: 14, color: COLORS.text, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', borderRadius: RADIUS.sm,
    padding: 10, minHeight: 60, textAlignVertical: 'top',
  },
  description: {
    fontSize: 13, color: COLORS.textMuted, lineHeight: 19,
    paddingHorizontal: SPACING.md, paddingVertical: 6,
  },
  listContent: { padding: SPACING.md, paddingBottom: 40 },
  bookCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  bookCover: {
    width: 56, height: 84, borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  bookInfo: { flex: 1, marginLeft: SPACING.md, justifyContent: 'center' },
  bookTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  bookAuthor: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  bookNote: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4, fontStyle: 'italic' },
  genreBadge: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 6,
  },
  genreText: { fontSize: 10, color: COLORS.textMuted },
  removeBtn: { padding: 8 },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: SPACING.xl },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginTop: SPACING.md },
  emptySub: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 19 },
});

export default ReadingListDetailScreen;
