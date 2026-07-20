/**
 * Offline downloads manager — quality select + guest gate.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Download, Trash2, Wifi } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';
import useAuthStore from '../../store/useAuthStore';
import {
  listDownloads, removeDownload, downloadEpisode, QUALITY_OPTIONS,
} from '../../services/episioDownloads';

const DownloadsManagerScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [picker, setPicker] = useState(null); // { episodeId, seriesId, ... }

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listDownloads());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    reload();
    const pending = route.params?.pendingDownload;
    if (pending?.episodeId) {
      setPicker(pending);
      navigation.setParams?.({ pendingDownload: undefined });
    }
  }, [isAuthenticated, reload, route.params?.pendingDownload, navigation]));

  if (!isAuthenticated) {
    return (
      <EpisioScreenShell title="Downloads" subtitle="Offline episodes">
        <View style={styles.empty}>
          <Download size={36} color={COLORS.textFaint} />
          <Text style={styles.emptyTitle}>Sign up to download</Text>
          <Text style={styles.emptySub}>
            Offline watching is for registered accounts only. Create a free account to save episodes on this device.
          </Text>
          <TouchableOpacity
            style={styles.cta}
            onPress={() => navigation.navigate('LoginRequiredSheet', {
              title: 'Sign in to download',
              message: 'Offline downloads need a free WiamEpisio account.',
            })}
          >
            <Text style={styles.ctaText}>Sign in / Register</Text>
          </TouchableOpacity>
        </View>
      </EpisioScreenShell>
    );
  }

  const startDownload = async (quality) => {
    if (!picker?.episodeId) return;
    const epId = picker.episodeId;
    setBusyId(epId);
    setPicker(null);
    try {
      await downloadEpisode({ ...picker, quality });
      Alert.alert('Downloaded', 'Episode saved for offline watching.');
      await reload();
    } catch (e) {
      Alert.alert('Download', e?.message || 'Could not download this episode');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <EpisioScreenShell
      title="Downloads"
      subtitle="Offline episodes"
      onBack={() => navigation.goBack()}
      headerRight={(
        <TouchableOpacity onPress={() => setEditing((e) => !e)}>
          <Text style={styles.editLink}>{editing ? 'Done' : 'Edit'}</Text>
        </TouchableOpacity>
      )}
    >
      {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : null}

      {!loading && items.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}><Download size={36} color={COLORS.textFaint} /></View>
          <Text style={styles.emptyTitle}>No downloads yet</Text>
          <Text style={styles.emptySub}>
            On an unlocked episode, tap Download and choose Standard, HD, or High quality.
          </Text>
          <View style={styles.note}>
            <Wifi size={16} color={COLORS.gold} />
            <Text style={styles.noteText}>Prefer Wi‑Fi for High quality downloads.</Text>
          </View>
        </View>
      ) : null}

      {items.map((d) => (
        <View key={d.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{d.seriesTitle}</Text>
            <Text style={styles.sub}>
              {d.episodeNumber != null ? `EP ${d.episodeNumber}` : 'Episode'}
              {' · '}
              {(QUALITY_OPTIONS.find((q) => q.id === d.quality)?.label) || d.quality}
            </Text>
          </View>
          {busyId === d.episodeId ? <ActivityIndicator color={COLORS.gold} /> : null}
          {editing ? (
            <TouchableOpacity
              onPress={async () => {
                await removeDownload(d.id);
                reload();
              }}
            >
              <Trash2 size={18} color="#EF4444" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => navigation.navigate('Player', {
                episodeId: d.episodeId,
                seriesId: d.seriesId,
                offlineUri: d.localUri,
              })}
            >
              <Text style={styles.play}>Play</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      <Modal visible={!!picker} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <View style={styles.modalBg}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Download quality</Text>
            <Text style={styles.sheetSub}>Higher quality uses more storage and data.</Text>
            {QUALITY_OPTIONS.map((q) => (
              <TouchableOpacity key={q.id} style={styles.qRow} onPress={() => startDownload(q.id)}>
                <Text style={styles.qLabel}>{q.label}</Text>
                <Text style={styles.qHint}>{q.hint}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setPicker(null)}>
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 24 },
  emptyIcon: { marginBottom: 14 },
  emptyTitle: { fontFamily: FONTS.bold, fontSize: 17, color: '#fff', marginBottom: 8 },
  emptySub: {
    fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textDim, textAlign: 'center', lineHeight: 19,
  },
  note: {
    flexDirection: 'row', gap: 8, marginTop: 18, padding: 12, borderRadius: RADIUS.md,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  noteText: { flex: 1, color: COLORS.textDim, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 17 },
  cta: {
    marginTop: 20, backgroundColor: COLORS.gold, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14,
  },
  ctaText: { fontFamily: FONTS.bold, color: COLORS.navy },
  editLink: { color: COLORS.gold, fontFamily: FONTS.semi, fontSize: 13 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.navyLine,
  },
  title: { fontFamily: FONTS.semi, color: '#fff', fontSize: 14 },
  sub: { fontFamily: FONTS.regular, color: COLORS.textFaint, fontSize: 11.5, marginTop: 2 },
  play: { color: COLORS.gold, fontFamily: FONTS.bold, fontSize: 13 },
  modalBg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.navyCard, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 36,
  },
  sheetTitle: { fontFamily: FONTS.bold, color: '#fff', fontSize: 16, marginBottom: 4 },
  sheetSub: { fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 12, marginBottom: 14 },
  qRow: {
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.navyLine,
  },
  qLabel: { fontFamily: FONTS.semi, color: COLORS.gold, fontSize: 14 },
  qHint: { fontFamily: FONTS.regular, color: COLORS.textFaint, fontSize: 11, marginTop: 2 },
  cancel: { textAlign: 'center', marginTop: 16, color: COLORS.textDim, fontFamily: FONTS.semi },
});

export default DownloadsManagerScreen;
