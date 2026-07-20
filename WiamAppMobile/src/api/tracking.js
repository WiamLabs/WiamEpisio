/**
 * Engagement tracking client.
 *
 * Tiny wrapper around the Push 3 backend tracking endpoints. Every call is
 * fire-and-forget — if the network fails the mobile UI never blocks; the
 * worst case is a missed analytics row.
 *
 * Used by:
 *   - ReaderScreen (recordView 30s after chapter open)
 *   - HomeScreen (impression batch + click)
 *   - pushNotifications (push-open ping when a notification is tapped)
 */
import apiClient from './client';

// Buffer for home impressions; flushed on rail-scroll-end / app-background.
const _impressionBuffer = [];
const FLUSH_BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 8000;

let _flushTimer = null;

function _scheduleFlush() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    flushImpressions();
  }, FLUSH_INTERVAL_MS);
}

const trackingApi = {
  /** Queue a home-rail impression. Buffered + flushed periodically. */
  queueImpression: (section, contentId, position) => {
    if (typeof contentId !== 'number' || !section) return;
    _impressionBuffer.push({
      section,
      content_id: contentId,
      position: typeof position === 'number' ? position : null,
    });
    if (_impressionBuffer.length >= FLUSH_BATCH_SIZE) {
      flushImpressions();
    } else {
      _scheduleFlush();
    }
  },

  /** Force-flush any buffered home impressions immediately. */
  flushImpressions,

  /** Send a single home-rail click. */
  homeClick: async (section, contentId, position) => {
    if (typeof contentId !== 'number' || !section) return;
    try {
      await apiClient.post('/track/home-click', {
        section,
        content_id: contentId,
        position: typeof position === 'number' ? position : null,
      });
    } catch {
      // ignore
    }
  },

  /** Notify backend that a push was tapped (CTR analytics). */
  pushOpen: async (type, url) => {
    try {
      await apiClient.post('/track/push-open', { type: type || '', url: url || '' });
    } catch {
      // ignore
    }
  },
};

async function flushImpressions() {
  if (_impressionBuffer.length === 0) return;
  const events = _impressionBuffer.splice(0, _impressionBuffer.length);
  try {
    await apiClient.post('/track/home-impression', { events });
  } catch {
    // Drop on failure — no retry. Analytics is best-effort.
  }
}

export default trackingApi;
