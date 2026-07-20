import { File, Directory, Paths } from 'expo-file-system/next';
import * as FileSystem from 'expo-file-system';
import { getOfflineBookLimit } from '../constants/premiumEntitlements';

/**
 * Offline chapter cache using expo-file-system (new API).
 *
 * Stores chapter content as JSON files in the app's document directory.
 * Each chapter is keyed by bookId + chapterNumber.
 *
 * Structure: {documentDirectory}/chapter_cache/{bookId}_{chNum}.json
 */

const CACHE_DIR = `${FileSystem.documentDirectory}chapter_cache/`;
const MAX_CACHE_SIZE_MB = 50;
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const cacheDirectory = new Directory(Paths.document, 'chapter_cache');

const ensureDir = async () => {
  try {
    if (!cacheDirectory.exists) {
      cacheDirectory.create();
    }
  } catch {
    // Fallback to legacy API
    try {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    } catch {}
  }
};

const keyFor = (bookId, chNum) => `${bookId}_${chNum}.json`;

/**
 * Save a chapter to the offline cache.
 * @param {number} bookId
 * @param {number} chNum
 * @param {object} chapterData - { title, content, word_count, status, ... }
 */
export const cacheChapter = async (bookId, chNum, chapterData, options = {}) => {
  try {
    await ensureDir();
    const limit = getOfflineBookLimit(options.plan || 'none');
    if (limit <= 0) {
      return { ok: false, reason: 'plan_not_allowed' };
    }

    // Count unique books already cached; enforce per-plan offline book cap.
    const items = (cacheDirectory.list() || []).filter((i) => i instanceof File);
    const existingBookIds = new Set();
    for (const f of items) {
      try {
        const raw = f.text();
        const data = JSON.parse(raw);
        const b = Number(data?._bookId);
        if (Number.isFinite(b)) existingBookIds.add(b);
      } catch {}
    }
    const currentBookId = Number(bookId);
    const isNewBook = Number.isFinite(currentBookId) && !existingBookIds.has(currentBookId);
    if (isNewBook && existingBookIds.size >= limit) {
      return { ok: false, reason: 'offline_limit_reached', limit };
    }

    const payload = {
      ...chapterData,
      _cachedAt: Date.now(),
      _bookId: bookId,
      _chNum: chNum,
    };
    const file = new File(cacheDirectory, keyFor(bookId, chNum));
    file.write(JSON.stringify(payload));
    return { ok: true };
  } catch (err) {
    console.warn('[ChapterCache] save error:', err);
    return { ok: false, reason: 'write_error' };
  }
};

/**
 * Retrieve a chapter from cache.
 * Returns null if not cached or expired.
 */
export const getCachedChapter = async (bookId, chNum) => {
  try {
    const file = new File(cacheDirectory, keyFor(bookId, chNum));
    if (!file.exists) return null;

    const raw = file.text();
    const data = JSON.parse(raw);

    // Expire after MAX_CACHE_AGE_MS
    if (Date.now() - (data._cachedAt || 0) > MAX_CACHE_AGE_MS) {
      file.delete();
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

/**
 * Check if a chapter is cached (without reading full content).
 */
export const isChapterCached = async (bookId, chNum) => {
  try {
    const file = new File(cacheDirectory, keyFor(bookId, chNum));
    return file.exists;
  } catch {
    return false;
  }
};

/**
 * Remove a specific cached chapter.
 */
export const removeCachedChapter = async (bookId, chNum) => {
  try {
    const file = new File(cacheDirectory, keyFor(bookId, chNum));
    if (file.exists) file.delete();
  } catch {}
};

/**
 * Clear all cached chapters for a given book.
 */
export const clearBookCache = async (bookId) => {
  try {
    await ensureDir();
    if (!cacheDirectory.exists) return;
    const prefix = `${bookId}_`;
    const items = (cacheDirectory.list() || []).filter((i) => i instanceof File);
    for (const f of items) {
      if (f.name && f.name.startsWith(prefix)) {
        try { f.delete(); } catch {}
      }
    }
  } catch {}
};

/**
 * Clear entire chapter cache.
 */
export const clearAllCache = async () => {
  try {
    if (cacheDirectory.exists) {
      cacheDirectory.delete();
    }
  } catch {}
};

/**
 * Get total cache size in bytes.
 */
export const getCacheSize = async () => {
  try {
    await ensureDir();
    if (!cacheDirectory.exists) return 0;
    const items = cacheDirectory.list() || [];
    let total = 0;
    for (const item of items) {
      if (item instanceof File) total += (item.size || 0);
    }
    return total;
  } catch {
    return 0;
  }
};

/**
 * Prune cache if it exceeds MAX_CACHE_SIZE_MB.
 * Removes oldest files first.
 */
export const pruneCache = async () => {
  try {
    await ensureDir();
    if (!cacheDirectory.exists) return;
    const items = (cacheDirectory.list() || []).filter((i) => i instanceof File);
    const entries = items.map((f) => ({ file: f, size: f.size || 0 }));
    const totalBytes = entries.reduce((s, e) => s + e.size, 0);
    if (totalBytes <= MAX_CACHE_SIZE_MB * 1024 * 1024) return;

    let freed = 0;
    const target = totalBytes - MAX_CACHE_SIZE_MB * 1024 * 1024;
    for (const entry of entries) {
      if (freed >= target) break;
      try { entry.file.delete(); } catch {}
      freed += entry.size;
    }
  } catch {}
};

/**
 * List cached chapters with basic metadata for offline manager UI.
 */
export const listCachedChapters = async () => {
  try {
    await ensureDir();
    if (!cacheDirectory.exists) return [];
    const items = (cacheDirectory.list() || []).filter((i) => i instanceof File);
    const rows = [];
    for (const file of items) {
      try {
        const raw = file.text();
        const data = JSON.parse(raw);
        const ageMs = Date.now() - (data._cachedAt || 0);
        if (ageMs > MAX_CACHE_AGE_MS) {
          try { file.delete(); } catch {}
          continue;
        }
        rows.push({
          key: file.name,
          file_name: file.name,
          book_id: data._bookId ?? null,
          chapter_number: data._chNum ?? null,
          chapter_title: data?.chapter?.title || data?.title || `Chapter ${data._chNum || ''}`.trim(),
          book_title: data?.book_title || data?.book?.title || '',
          cached_at: data._cachedAt || null,
          size_bytes: file.size || 0,
        });
      } catch {}
    }
    rows.sort((a, b) => (b.cached_at || 0) - (a.cached_at || 0));
    return rows;
  } catch {
    return [];
  }
};

export const formatBytes = (bytes) => {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

export default {
  cacheChapter,
  getCachedChapter,
  isChapterCached,
  removeCachedChapter,
  clearBookCache,
  clearAllCache,
  getCacheSize,
  pruneCache,
  listCachedChapters,
  formatBytes,
};
