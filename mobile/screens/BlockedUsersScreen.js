// © 2026 WiamApp. Powered by WiamLabs
// screens/BlockedUsersScreen.js
// Manage who you've blocked — shared by Worker and Customer settings.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, FlatList,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../constants/colors';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

const NAVY = Colors.navyDeep || Colors.navy;
const GOLD = Colors.gold;
const WHITE = '#FFFFFF';
const MUTED = '#888899';
const BORDER = '#EBEBEB';

export default function BlockedUsersScreen({ navigation }) {
  const { user } = useAuth();
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState(null);

  const loadBlocks = async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('user_blocks')
        .select('id, reason, created_at, blocked:blocked_id (id, full_name, avatar_url, role)')
        .eq('blocker_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBlocks(data || []);
    } catch (e) {
      console.warn('Load blocks error:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadBlocks(); }, [user?.id]));

  const handleUnblock = (block) => {
    Alert.alert(
      'Unblock',
      `${block.blocked?.full_name || 'This person'} will be able to contact and book you again. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setUnblockingId(block.id);
            try {
              await supabase.from('user_blocks').delete().eq('id', block.id);
              setBlocks(prev => prev.filter(b => b.id !== block.id));
            } catch (e) {
              Alert.alert('Error', 'Could not unblock. Try again.');
            } finally {
              setUnblockingId(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => (
    <View style={s.row}>
      <View style={s.avatar}>
        <Text style={s.avatarText}>{(item.blocked?.full_name || '?')[0]?.toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.name}>{item.blocked?.full_name || 'Unknown user'}</Text>
        <Text style={s.sub}>
          Blocked {new Date(item.created_at).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
      </View>
      <TouchableOpacity
        style={s.unblockBtn}
        onPress={() => handleUnblock(item)}
        disabled={unblockingId === item.id}
      >
        {unblockingId === item.id
          ? <ActivityIndicator color={GOLD} size="small" />
          : <Text style={s.unblockText}>Unblock</Text>
        }
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={WHITE} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Blocked Users</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={GOLD} style={{ marginTop: 60 }} />
      ) : blocks.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="checkmark-done-circle-outline" size={48} color="#DDD" />
          <Text style={s.emptyTitle}>No one blocked</Text>
          <Text style={s.emptyText}>People you block from a chat will show up here. They can't message or book you while blocked.</Text>
        </View>
      ) : (
        <FlatList
          data={blocks}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WHITE },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: NAVY, paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { padding: 2 },
  headerTitle: { color: WHITE, fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8F8FA', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: BORDER },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: GOLD, fontWeight: '700', fontSize: 15 },
  name: { fontSize: 14.5, fontWeight: '600', color: NAVY },
  sub: { fontSize: 12, color: MUTED, marginTop: 2 },
  unblockBtn: { borderWidth: 1, borderColor: GOLD, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, minWidth: 76, alignItems: 'center' },
  unblockText: { color: GOLD, fontWeight: '700', fontSize: 12.5 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: NAVY },
  emptyText: { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 19 },
});
