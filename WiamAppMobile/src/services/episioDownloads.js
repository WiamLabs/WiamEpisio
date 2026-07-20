/**
 * Offline episode downloads — device storage, quality picks.
 * Guests cannot download (callers must gate).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import apiClient from '../api/client';

const INDEX_KEY = '@episio_downloads_v1';
const ROOT = `${FileSystem.documentDirectory}episio_offline/`;

export const QUALITY_OPTIONS = [
  { id: 'sd', label: 'Standard (data saver)', hint: '~480p' },
  { id: 'hd', label: 'HD', hint: '~720p' },
  { id: 'high', label: 'High quality', hint: '~1080p' },
];

async function readIndex() {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeIndex(items) {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(items));
}

export async function listDownloads() {
  return readIndex();
}

export async function removeDownload(id) {
  const items = await readIndex();
  const hit = items.find((d) => String(d.id) === String(id));
  if (hit?.localUri) {
    try { await FileSystem.deleteAsync(hit.localUri, { idempotent: true }); } catch { /* ignore */ }
  }
  await writeIndex(items.filter((d) => String(d.id) !== String(id)));
}

/**
 * Download an unlocked episode at the chosen quality.
 * Uses stream URL from API; stores file under documentDirectory.
 */
export async function downloadEpisode({
  episodeId,
  seriesId,
  seriesTitle,
  episodeNumber,
  quality = 'hd',
  onProgress,
}) {
  if (!episodeId) throw new Error('episodeId required');
  await FileSystem.makeDirectoryAsync(ROOT, { intermediates: true }).catch(() => {});

  const stream = await apiClient.get(`/episodes/${episodeId}/stream`, {
    params: { quality, download: 1 },
  });
  const url = stream.data?.url
    || stream.data?.hls_url
    || stream.data?.playback_url
    || stream.data?.signed_url
    || stream.data?.download_url;
  if (!url) throw new Error('No downloadable stream for this episode');

  const dest = `${ROOT}ep_${episodeId}_${quality}.mp4`;
  const callback = onProgress
    ? (progress) => {
      const total = progress.totalBytesExpectedToWrite || 0;
      const written = progress.totalBytesWritten || 0;
      onProgress(total ? written / total : 0);
    }
    : undefined;

  const result = await FileSystem.createDownloadResumable(
    url,
    dest,
    {},
    callback,
  ).downloadAsync();

  if (!result?.uri) throw new Error('Download failed');

  const entry = {
    id: `ep_${episodeId}_${quality}`,
    episodeId,
    seriesId,
    seriesTitle: seriesTitle || 'Series',
    episodeNumber: episodeNumber || null,
    quality,
    localUri: result.uri,
    downloadedAt: new Date().toISOString(),
    bytes: result.headers?.['Content-Length']
      ? Number(result.headers['Content-Length'])
      : null,
  };

  const items = await readIndex();
  const next = [entry, ...items.filter((d) => d.id !== entry.id)];
  await writeIndex(next);
  return entry;
}

export default {
  QUALITY_OPTIONS,
  listDownloads,
  removeDownload,
  downloadEpisode,
};
