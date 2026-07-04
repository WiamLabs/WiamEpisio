// © 2026 WiamApp. Powered by WiamLabs
// lib/AuthContext.js
// Global auth state — wrap App.js with this so every screen
// can call useAuth() to get the current user, their profile, and role.

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session,  setSession]  = useState(null);   // Supabase session
  const [user,     setUser]     = useState(null);   // users table row
  const [profile,  setProfile]  = useState(null);   // worker_profiles row (workers only)
  const [loading,  setLoading]  = useState(true);

  // Fetch full user profile from our users table
  const loadUser = async (supabaseUser) => {
    if (!supabaseUser) { setUser(null); setProfile(null); setLoading(false); return; }
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
    // Get current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      loadUser(session?.user ?? null);
    });

    // Listen for login/logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      loadUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Refresh user data (call after profile edits)
  const refreshUser = () => loadUser(session?.user ?? null);

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
