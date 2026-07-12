// © 2026 WiamApp. Powered by WiamLabs
// lib/AuthContext.js
// Global auth state — wrap App.js with this so every screen
// can call useAuth() to get the current user, their profile, and role.

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from './supabase';

const AuthContext = createContext(null);
const SESSION_TIMEOUT_MS = 8000;

export function AuthProvider({ children }) {
  const [session,  setSession]  = useState(null);   // Supabase session
  const [user,     setUser]     = useState(null);   // users table row
  const [profile,  setProfile]  = useState(null);   // worker_profiles row (workers only)
  const [loading,  setLoading]  = useState(true);

  // Fetch full user profile from our users table
  const loadUser = async (supabaseUser) => {
    if (!supabaseUser) { setUser(null); setProfile(null); setLoading(false); return; }
    if (!supabase) { setLoading(false); return; }
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();
      if (error) throw error;
      setUser(userData);

      // If worker — also load their worker_profile
      if (userData.role === 'worker') {
        const { data: wp } = await supabase
          .from('worker_profiles')
          .select('*')
          .eq('user_id', supabaseUser.id)
          .single();
        setProfile(wp || null);
      }
    } catch (e) {
      console.warn('AuthContext loadUser error:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) {
        console.warn('AuthContext: session check timed out, continuing without session');
        setLoading(false);
      }
    }, SESSION_TIMEOUT_MS);

    // Get current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      clearTimeout(timeout);
      setSession(session);
      loadUser(session?.user ?? null);
    }).catch((e) => {
      if (cancelled) return;
      clearTimeout(timeout);
      console.warn('AuthContext getSession error:', e.message);
      setLoading(false);
    });

    // Listen for login/logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      loadUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  // Refresh user data (call after profile edits)
  const refreshUser = () => loadUser(session?.user ?? null);

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, refreshUser, supabaseConfigured }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
