/**
 * Watcher vs Creator mood — same account, different bottom nav + surfaces.
 * Persisted so creators stay in Studio until they switch back.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@episio_app_mode_v1';

const useAppModeStore = create((set, get) => ({
  mode: 'watcher', // 'watcher' | 'creator'
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw === 'creator' || raw === 'watcher') {
        set({ mode: raw, hydrated: true });
        return;
      }
    } catch { /* ignore */ }
    set({ hydrated: true });
  },

  setMode: async (mode) => {
    const next = mode === 'creator' ? 'creator' : 'watcher';
    set({ mode: next });
    try {
      await AsyncStorage.setItem(KEY, next);
    } catch { /* ignore */ }
  },

  isCreatorMood: () => get().mode === 'creator',
}));

export default useAppModeStore;
