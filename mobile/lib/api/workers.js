// © 2026 WiamApp. Powered by WiamLabs
// lib/api/workers.js — All worker-related database calls

import { supabase } from '../supabase';

/**
 * Get all nearby workers, optionally filtered by category
 */
export async function getNearbyWorkers({ category = null, city = 'Accra', limit = 20 } = {}) {
  let query = supabase
    .from('worker_profiles')
    .select(`
      id,
      bio,
      hourly_rate,
      currency,
      location_name,
      latitude,
      longitude,
      is_available,
      is_verified,
      verified_badge,
      subscription_tier,
      total_jobs_done,
      average_rating,
      users (
        id,
        full_name,
        avatar_url,
        city
      ),
      worker_categories (
        categories (
          id,
          name,
          icon
        )
      )
    `)
    .eq('is_available', true)
    .eq('users.city', city)
    .order('average_rating', { ascending: false })
    .limit(limit);

  if (category) {
    query = query.eq('worker_categories.categories.name', category);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Get a single worker's full profile
 */
export async function getWorkerProfile(workerProfileId) {
  const { data, error } = await supabase
    .from('worker_profiles')
    .select(`
      *,
      users (
        id,
        full_name,
        avatar_url,
        phone,
        city,
        country
      ),
      worker_categories (
        categories (id, name, icon)
      ),
      portfolio_images (
        id,
        image_url,
        caption
      ),
      reviews (
        id,
        rating,
        comment,
        created_at,
        users!reviews_customer_id_fkey (
          full_name,
          avatar_url
        )
      )
    `)
    .eq('id', workerProfileId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Search workers by name or category
 */
export async function searchWorkers({ query = '', category = null, verifiedOnly = false } = {}) {
  let dbQuery = supabase
    .from('worker_profiles')
    .select(`
      id,
      hourly_rate,
      currency,
      location_name,
      is_available,
      is_verified,
      verified_badge,
      subscription_tier,
      average_rating,
      total_jobs_done,
      users (
        full_name,
        avatar_url,
        city
      ),
      worker_categories (
        categories (name, icon)
      )
    `)
    .ilike('users.full_name', `%${query}%`)
    .order('average_rating', { ascending: false });

  if (verifiedOnly) {
    dbQuery = dbQuery.eq('is_verified', true);
  }

  const { data, error } = await dbQuery;
  if (error) throw error;
  return data;
}

/**
 * Create a new worker profile (after registration)
 */
export async function createWorkerProfile({ userId, bio, hourlyRate, locationName, lat, lng }) {
  const { data, error } = await supabase
    .from('worker_profiles')
    .insert({
      user_id: userId,
      bio,
      hourly_rate: hourlyRate,
      location_name: locationName,
      latitude: lat,
      longitude: lng,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update worker availability (toggle on/off)
 */
export async function updateWorkerAvailability(workerProfileId, isAvailable) {
  const { error } = await supabase
    .from('worker_profiles')
    .update({ is_available: isAvailable, updated_at: new Date() })
    .eq('id', workerProfileId);

  if (error) throw error;
}

/**
 * Get all categories
 */
export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return data;
}
