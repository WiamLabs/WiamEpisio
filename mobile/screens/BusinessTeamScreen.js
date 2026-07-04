// © 2026 WiamApp. Powered by WiamLabs
// screens/BusinessTeamScreen.js
// Business manages their permanent team of workers — invite, assign, remove
// Backend: GET /api/business/team

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, FlatList, Alert, TextInput, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

const NAVY   = Colors.navyDeep;
const NAVY2  = Colors.navyMid;
const GOLD   = Colors.gold;
const WHITE  = Colors.white;
const MUTED  = 'rgba(255,255,255,0.45)';
const BORDER = 'rgba(255,255,255,0.09)';


const STATUS_CONFIG = {
  active:   { label: 'Available', color: '#22C55E', bg: 'rgba(34,197,94,0.12)'  },
  on_job:   { label: 'On Job',    color: GOLD,      bg: 'rgba(212,160,23,0.12)' },
  inactive: { label: 'Inactive',  color: MUTED,     bg: 'rgba(255,255,255,0.07)'},
};

export default function BusinessTeamScreen({ navigation }) {
  const { user } = useAuth();
  const [team,     setTeam]     = useState([]);
  const [search,   setSearch]   = useState('');
  const [showInvite, setShowInvite]   = useState(false);
  const [invitePhone, setInvitePhone] = useState('');
  const [loading,    setLoading]      = useState(true);

  // Load real team from Supabase
  const loadTeam = async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('business_team_members')
        .select(`
          id, status, role, joined_at, is_hidden_from_search,
          worker_profiles(
            id, average_rating, total_jobs_done, is_available,
            users(full_name, phone)
          )
        `)
        .eq('business_id', user.id)
        .order('joined_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map(m => ({
        id:       m.id,
        name:     m.worker_profiles?.users?.full_name || 'Worker',
        role:     m.role || 'Team Member',
        jobsDone: m.worker_profiles?.total_jobs_done || 0,
        rating:   m.worker_profiles?.average_rating  || 0,
        status:   m.worker_profiles?.is_available ? 'active' : 'inactive',
        since:    new Date(m.joined_at).toLocaleDateString('en-GH', { month: 'short', year: 'numeric' }),
        phone:    m.worker_profiles?.users?.phone || '',
        workerId: m.worker_profiles?.id,
        isHidden: m.is_hidden_from_search || false,
      }));
      setTeam(mapped);
    } catch (e) {
      console.warn('Team load error:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTeam(); }, [user?.id]);

  const filtered = team.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.role.toLowerCase().includes(search.toLowerCase())
  );

  const handleRemove = (member) => {
    Alert.alert('Remove Team Member', `Remove ${member.name} from your team?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await supabase
              .from('business_team_members')
              .delete()
              .eq('id', member.id)
              .eq('business_id', user.id);
            setTeam(prev => prev.filter(m => m.id !== member.id));
            Alert.alert('Removed', `${member.name} has been removed from your team.`);
          } catch (e) {
            Alert.alert('Error', 'Could not remove member. Try again.');
          }
        },
      },
    ]);
  };

  // Hide a team member from public customer search (Section 17B) —
  // optimistic update with rollback if the write actually fails,
  // so the toggle never silently lies about its own state.
  const handleToggleHidden = async (member) => {
    const nextValue = !member.isHidden;
    setTeam(prev => prev.map(m => m.id === member.id ? { ...m, isHidden: nextValue } : m));
    try {
      const { error } = await supabase
        .from('business_team_members')
        .update({ is_hidden_from_search: nextValue })
        .eq('id', member.id)
        .eq('business_id', user.id);
      if (error) throw error;
    } catch (e) {
      setTeam(prev => prev.map(m => m.id === member.id ? { ...m, isHidden: !nextValue } : m));
      Alert.alert('Error', 'Could not update visibility. Try again.');
    }
  };

  // ChatScreen is keyed by booking, not by a bare worker ID — find
  // the most recent booking with this worker first, rather than
  // navigating with an ID that messages.js has no way to use.
  const handleMessage = async (member) => {
    try {
      const { data: booking } = await supabase
        .from('bookings')
        .select('id')
        .eq('business_id', user.id)
        .eq('worker_id', member.workerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!booking) {
        Alert.alert('No active job yet', `Book ${member.name} for a job first — chat opens automatically once they accept.`);
        return;
      }
      navigation.navigate('ChatRoom', { bookingId: booking.id, workerName: member.name, workerId: member.workerId });
    } catch {
      Alert.alert('Error', 'Could not open chat. Try again.');
    }
  };

  const handleInvite = async () => {
    if (!invitePhone.trim()) {
      Alert.alert('Required', 'Please enter a phone number.');
      return;
    }
    try {
      // Look up worker by phone number
      const { data: workerUser } = await supabase
        .from('users')
        .select('id, worker_profiles(id)')
        .eq('phone', invitePhone.trim())
        .eq('role', 'worker')
        .single();

      if (!workerUser || !workerUser.worker_profiles?.id) {
        Alert.alert('Not found', 'No worker found with that phone number. Make sure they have a WiamApp worker account.');
        return;
      }

      // Add to team
      const { error } = await supabase
        .from('business_team_members')
        .insert({
          business_id:       user.id,
          worker_profile_id: workerUser.worker_profiles.id,
          status:            'active',
          role:              'Team Member',
          joined_at:         new Date().toISOString(),
        });

      if (error) throw error;

      Alert.alert('✅ Added', 'Worker has been added to your team.');
      setInvitePhone('');
      setShowInvite(false);
      loadTeam(); // Refresh list
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not add worker. Try again.');
    }
  };

  const activeCount   = team.filter(m => m.status === 'active').length;
  const onJobCount    = team.filter(m => m.status === 'on_job').length;

  const renderMember = ({ item }) => {
    const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.inactive;
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</Text>
          </View>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{item.name}</Text>
            <Text style={styles.memberRole}>{item.role}</Text>
            <Text style={styles.memberSince}>Since {item.since}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="briefcase-outline" size={14} color={MUTED} />
            <Text style={styles.statText}>{item.jobsDone} jobs</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="star" size={14} color={GOLD} />
            <Text style={styles.statText}>{item.rating} rating</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="call-outline" size={14} color={MUTED} />
            <Text style={styles.statText}>{item.phone}</Text>
          </View>
        </View>

        <View style={styles.visibilityRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.visibilityLabel}>Hide from public search</Text>
            <Text style={styles.visibilitySub}>Customers can't find or book them outside your team</Text>
          </View>
          <Switch
            value={item.isHidden}
            onValueChange={() => handleToggleHidden(item)}
            trackColor={{ false: 'rgba(255,255,255,0.15)', true: GOLD }}
            thumbColor={WHITE}
          />
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.msgBtn}
            onPress={() => handleMessage(item)}
          >
            <Ionicons name="chatbubble-outline" size={14} color={GOLD} />
            <Text style={styles.msgBtnText}>Message</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.assignBtn}
            onPress={() => Alert.alert(
              'Job Assignment',
              'Assigning a specific booking directly to a team member is a Growth plan feature, coming soon to mobile. It is already available to preview on wiamapp.com/business.'
            )}
          >
            <Ionicons name="calendar-outline" size={14} color={WHITE} />
            <Text style={styles.assignBtnText}>Assign Job</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(item)}>
            <Ionicons name="person-remove-outline" size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <View style={styles.header}>
        <Text style={styles.title}>My Team</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowInvite(true)}>
          <Ionicons name="person-add-outline" size={20} color={GOLD} />
        </TouchableOpacity>
      </View>

      {/* Quick stats */}
      <View style={styles.quickStats}>
        <View style={styles.quickStat}>
          <Text style={styles.quickStatVal}>{team.length}</Text>
          <Text style={styles.quickStatLabel}>Total</Text>
        </View>
        <View style={styles.quickStatDiv} />
        <View style={styles.quickStat}>
          <Text style={[styles.quickStatVal, { color: '#22C55E' }]}>{activeCount}</Text>
          <Text style={styles.quickStatLabel}>Available</Text>
        </View>
        <View style={styles.quickStatDiv} />
        <View style={styles.quickStat}>
          <Text style={[styles.quickStatVal, { color: GOLD }]}>{onJobCount}</Text>
          <Text style={styles.quickStatLabel}>On Job</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={16} color={MUTED} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search team members..."
          placeholderTextColor={MUTED}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Invite modal */}
      {showInvite && (
        <View style={styles.inviteCard}>
          <Text style={styles.inviteTitle}>Invite a Worker</Text>
          <Text style={styles.inviteSub}>Enter their WiamApp phone number or worker ID</Text>
          <TextInput
            style={styles.inviteInput}
            placeholder="+233 24 000 0000"
            placeholderTextColor={MUTED}
            value={invitePhone}
            onChangeText={setInvitePhone}
            keyboardType="phone-pad"
          />
          <View style={styles.inviteActions}>
            <TouchableOpacity style={styles.inviteCancelBtn} onPress={() => setShowInvite(false)}>
              <Text style={styles.inviteCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.inviteSendBtn} onPress={handleInvite}>
              <Text style={styles.inviteSendText}>Send Invite</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderMember}
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={52} color="rgba(255,255,255,0.08)" />
            <Text style={styles.emptyTitle}>No team members found</Text>
            <Text style={styles.emptyText}>Tap the + button to invite workers to your team</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowInvite(true)}>
              <Text style={styles.emptyBtnText}>+ Add Worker</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: NAVY },
  header:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  title:            { color: WHITE, fontSize: 22, fontWeight: '700' },
  addBtn:           { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(212,160,23,0.12)', borderWidth: 0.5, borderColor: 'rgba(212,160,23,0.3)', alignItems: 'center', justifyContent: 'center' },
  quickStats:       { flexDirection: 'row', marginHorizontal: 20, backgroundColor: NAVY2, borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: BORDER },
  quickStat:        { flex: 1, alignItems: 'center' },
  quickStatVal:     { fontSize: 22, fontWeight: '800', color: WHITE },
  quickStatLabel:   { fontSize: 12, color: MUTED, marginTop: 2 },
  quickStatDiv:     { width: 1, backgroundColor: BORDER },
  searchBox:        { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: NAVY2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, marginHorizontal: 20, marginBottom: 14, borderWidth: 1, borderColor: BORDER },
  searchInput:      { flex: 1, fontSize: 15, color: WHITE },
  inviteCard:       { backgroundColor: NAVY2, marginHorizontal: 20, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(212,160,23,0.3)' },
  inviteTitle:      { fontSize: 16, fontWeight: '700', color: WHITE, marginBottom: 4 },
  inviteSub:        { fontSize: 13, color: MUTED, marginBottom: 12 },
  inviteInput:      { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: WHITE, borderWidth: 1, borderColor: BORDER, marginBottom: 12 },
  inviteActions:    { flexDirection: 'row', gap: 10 },
  inviteCancelBtn:  { flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  inviteCancelText: { color: MUTED, fontWeight: '600' },
  inviteSendBtn:    { flex: 2, backgroundColor: GOLD, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  inviteSendText:   { color: NAVY, fontWeight: '700', fontSize: 14 },
  list:             { padding: 20, gap: 14, paddingBottom: 40 },
  emptyContainer:   { flex: 1 },
  empty:            { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTitle:       { color: 'rgba(255,255,255,0.3)', fontSize: 16, marginTop: 14, marginBottom: 6, fontWeight: '600' },
  emptyText:        { color: MUTED, fontSize: 13, textAlign: 'center', marginBottom: 20 },
  emptyBtn:         { backgroundColor: GOLD, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText:     { color: NAVY, fontSize: 14, fontWeight: '700' },
  card:             { backgroundColor: NAVY2, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: BORDER },
  cardTop:          { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  avatar:           { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(212,160,23,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarText:       { fontSize: 16, fontWeight: '700', color: GOLD },
  memberInfo:       { flex: 1 },
  memberName:       { fontSize: 15, fontWeight: '700', color: WHITE },
  memberRole:       { fontSize: 13, color: MUTED, marginTop: 2 },
  memberSince:      { fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 2 },
  statusPill:       { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  statusText:       { fontSize: 11, fontWeight: '700' },
  statsRow:         { flexDirection: 'row', gap: 16, marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  visibilityRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  visibilityLabel:  { fontSize: 13, fontWeight: '600', color: WHITE },
  visibilitySub:    { fontSize: 11.5, color: MUTED, marginTop: 2 },
  stat:             { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText:         { fontSize: 12, color: MUTED },
  cardActions:      { flexDirection: 'row', gap: 8 },
  msgBtn:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(212,160,23,0.3)', borderRadius: 9, paddingVertical: 9 },
  msgBtnText:       { fontSize: 13, color: GOLD, fontWeight: '600' },
  assignBtn:        { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 9, paddingVertical: 9 },
  assignBtnText:    { fontSize: 13, color: WHITE, fontWeight: '600' },
  removeBtn:        { width: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 9 },
});
