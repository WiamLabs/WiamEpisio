// © 2026 WiamApp. Powered by WiamLabs
// lib/supabase.js — Main Supabase client
// This file connects the app to your Supabase database

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase credentials.\n' +
    'Please copy .env.example to .env and fill in your Supabase URL and Anon Key.\n' +
    'Get them from: https://supabase.com → Your Project → Settings → API'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Store session in phone storage so user stays logged in
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ─── Auth Helpers ────────────────────────────────────────────

/**
 * Register a new user (customer, worker, or business)
 */
export async function registerUser({ fullName, email, phone, password, role }) {
  // Step 1: Create auth user in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role },
    },
  });

  if (authError) throw authError;

  // Step 2: Insert extra user data into our users table
  const { error: dbError } = await supabase
    .from('users')
    .insert({
      id: authData.user.id,
      full_name: fullName,
      email,
      phone,
      role,
    });

  if (dbError) throw dbError;

  return authData;
}

/**
 * Login existing user
 */
export async function loginUser({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/**
 * Logout current user
 */
export async function logoutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get current logged-in user
 */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get full profile from our users table
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Listen for auth state changes (login/logout)
 * Use this in App.js to redirect based on auth status
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}
