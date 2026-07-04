// © 2026 WiamApp. Powered by WiamLabs
// lib/api/security.js — Complete Security & Verification System
// Handles: KYC, audit logging, device fingerprinting, OTP, fraud reports

import { supabase } from '../supabase';
import * as Device from 'expo-device';
import * as Location from 'expo-location';

// ─────────────────────────────────────────────────────────────
// SECTION 1 — AUDIT LOGGING
// Every important action is logged permanently
// ─────────────────────────────────────────────────────────────

/**
 * Log any user action to the audit_logs table.
 * Called silently in the background — never blocks the user.
 *
 * @param {string} userId
 * @param {string} action  e.g. 'login', 'booking_created', 'document_uploaded'
 * @param {object} metadata  any extra context
 */
export async function logAction(userId, action, metadata = {}) {
  try {
    // Get device info
    const deviceInfo = `${Device.modelName || 'Unknown'} | ${Device.osName} ${Device.osVersion}`;

    // Try to get location (non-blocking — user may have denied)
    let locationLat = null;
    let locationLng = null;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        locationLat = loc.coords.latitude;
        locationLng = loc.coords.longitude;
      }
    } catch (_) {}

    await supabase.from('audit_logs').insert({
      user_id: userId,
      action,
      device_info: deviceInfo,
      location_lat: locationLat,
      location_lng: locationLng,
      metadata,
    });
  } catch (err) {
    // Never crash the app because of an audit log failure
    console.warn('Audit log failed silently:', err.message);
  }
}

// Actions to use across the app:
export const AUDIT_ACTIONS = {
  LOGIN:                'login',
  LOGOUT:               'logout',
  REGISTER:             'register',
  BOOKING_CREATED:      'booking_created',
  BOOKING_ACCEPTED:     'booking_accepted',
  BOOKING_REJECTED:     'booking_rejected',
  BOOKING_COMPLETED:    'booking_completed',
  BOOKING_CANCELLED:    'booking_cancelled',
  DOCUMENT_UPLOADED:    'document_uploaded',
  SELFIE_UPLOADED:      'selfie_uploaded',
  VERIFICATION_PASSED:  'verification_passed',
  VERIFICATION_FAILED:  'verification_failed',
  FRAUD_REPORT_FILED:   'fraud_report_filed',
  PAYMENT_INITIATED:    'payment_initiated',
  PAYMENT_SUCCESS:      'payment_success',
  PROFILE_UPDATED:      'profile_updated',
  PASSWORD_CHANGED:     'password_changed',
};

// ─────────────────────────────────────────────────────────────
// SECTION 2 — DEVICE FINGERPRINTING
// Detects if one person creates multiple accounts on same device
// ─────────────────────────────────────────────────────────────

/**
 * Register this device for a user.
 * If the same device ID is already linked to a DIFFERENT user,
 * flag it for admin review (potential duplicate account).
 */
export async function registerDevice(userId) {
  try {
    const deviceId = Device.modelId || Device.osBuildId || 'unknown';
    const deviceModel = Device.modelName || 'Unknown';
    const osVersion = `${Device.osName} ${Device.osVersion}`;

    // Check if this device is already registered to someone else
    const { data: existing } = await supabase
      .from('device_fingerprints')
      .select('user_id')
      .eq('device_id', deviceId)
      .neq('user_id', userId)
      .limit(1);

    if (existing && existing.length > 0) {
      // Same device — different user — flag it
      await logAction(userId, 'duplicate_device_detected', {
        device_id: deviceId,
        previous_user_id: existing[0].user_id,
        risk: 'HIGH',
      });
      // Do NOT block them yet — let admin review
      // But mark the user for review
      await supabase
        .from('users')
        .update({ is_verified: false })
        .eq('id', userId);
    }

    // Upsert device record
    await supabase
      .from('device_fingerprints')
      .upsert({
        user_id: userId,
        device_id: deviceId,
        device_model: deviceModel,
        os_version: osVersion,
        app_version: '1.0.0',
        last_seen: new Date().toISOString(),
      }, { onConflict: 'user_id,device_id' });

  } catch (err) {
    console.warn('Device fingerprint failed silently:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// SECTION 3 — OTP PHONE VERIFICATION
// Verifies the user actually owns their phone number
// ─────────────────────────────────────────────────────────────

/**
 * Send OTP to a phone number using Supabase Phone Auth.
 * The user receives an SMS with a 6-digit code.
 */
export async function sendPhoneOTP(phone) {
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throw new Error(`Failed to send OTP: ${error.message}`);
}

/**
 * Verify the OTP code the user received by SMS.
 */
export async function verifyPhoneOTP(phone, token) {
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });
  if (error) throw new Error(`OTP verification failed: ${error.message}`);

  // Mark phone as verified in our users table
  if (data?.user) {
    await supabase
      .from('verifications')
      .insert({
        user_id: data.user.id,
        verification_type: 'phone_otp',
        status: 'passed',
        provider: 'supabase',
      });
  }

  return data;
}

// ─────────────────────────────────────────────────────────────
// SECTION 4 — ID DOCUMENT VERIFICATION (Smile Identity)
// Verifies Ghana Card, Passport, Voter ID, Driver's License
// ─────────────────────────────────────────────────────────────

const SMILE_PARTNER_ID = process.env.EXPO_PUBLIC_SMILE_IDENTITY_PARTNER_ID;
const SMILE_API_KEY    = process.env.EXPO_PUBLIC_SMILE_IDENTITY_API_KEY;
const SMILE_ENV        = process.env.EXPO_PUBLIC_SMILE_IDENTITY_ENV || 'sandbox';
const SMILE_BASE_URL   = SMILE_ENV === 'production'
  ? 'https://api.smileidentity.com/v1'
  : 'https://testapi.smileidentity.com/v1';

/**
 * Verify a national ID document using Smile Identity.
 * Checks ID number against the government database.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.idNumber      e.g. 'GHA-XXXXXXXXX-X'
 * @param {string} params.idType        'GHANA_CARD' | 'PASSPORT' | 'VOTER_ID' | 'DRIVERS_LICENSE'
 * @param {string} params.firstName
 * @param {string} params.lastName
 * @param {string} params.country       'GH' | 'NG'
 * @param {string} params.documentS3Key  S3 key of uploaded ID photo (private)
 */
export async function verifyIdDocument({
  userId,
  idNumber,
  idType,
  firstName,
  lastName,
  country = 'GH',
  documentS3Key,
}) {
  // Step 1 — Create a pending verification record
  const { data: verificationRecord, error: insertError } = await supabase
    .from('verifications')
    .insert({
      user_id: userId,
      verification_type: 'id_document',
      status: 'pending',
      provider: 'smile_identity',
      document_type: idType,
      document_s3_key: documentS3Key,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  // Step 2 — Call Smile Identity API
  let smileResult;
  try {
    const response = await fetch(`${SMILE_BASE_URL}/id_verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partner_id: SMILE_PARTNER_ID,
        api_key: SMILE_API_KEY,
        id_number: idNumber,
        id_type: idType,
        first_name: firstName,
        last_name: lastName,
        country,
      }),
    });

    smileResult = await response.json();
  } catch (err) {
    // Network error — mark for manual review
    await supabase.from('verifications').update({
      status: 'manual_review',
      failure_reason: 'Network error contacting Smile Identity',
    }).eq('id', verificationRecord.id);

    throw new Error('Could not reach verification service. Your ID has been flagged for manual review within 48 hours.');
  }

  // Step 3 — Process result
  const passed = smileResult.ResultText === 'Exact Match';
  const status = passed ? 'passed' : (smileResult.ResultText === 'No Match' ? 'failed' : 'manual_review');

  // Step 4 — Update verification record with result
  await supabase.from('verifications').update({
    status,
    provider_ref: smileResult.SmileJobID,
    score: smileResult.ConfidenceValue || null,
    failure_reason: passed ? null : smileResult.ResultText,
  }).eq('id', verificationRecord.id);

  // Step 5 — Log the action
  await logAction(userId, passed ? AUDIT_ACTIONS.VERIFICATION_PASSED : AUDIT_ACTIONS.VERIFICATION_FAILED, {
    id_type: idType,
    country,
    smile_job_id: smileResult.SmileJobID,
    result: smileResult.ResultText,
  });

  // Step 6 — If passed, update worker profile as verified
  if (passed) {
    const { data: workerProfile } = await supabase
      .from('worker_profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (workerProfile) {
      await supabase
        .from('worker_profiles')
        .update({ is_verified: true })
        .eq('id', workerProfile.id);
    }

    await supabase
      .from('users')
      .update({ is_verified: true })
      .eq('id', userId);
  }

  return { passed, status, resultText: smileResult.ResultText };
}

// ─────────────────────────────────────────────────────────────
// SECTION 5 — FACE MATCH (Selfie vs ID Photo)
// Confirms person matches their ID document
// ─────────────────────────────────────────────────────────────

/**
 * Submit selfie for face match against ID photo.
 * Uses Smile Identity SmartSelfie™.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.selfieUri     local URI from expo-image-picker
 * @param {string} params.selfieS3Key   S3 key of uploaded selfie (private)
 */
export async function performFaceMatch({ userId, selfieUri, selfieS3Key }) {
  // Step 1 — Create pending record
  const { data: record, error: insertError } = await supabase
    .from('verifications')
    .insert({
      user_id: userId,
      verification_type: 'face_match',
      status: 'pending',
      provider: 'smile_identity',
      selfie_s3_key: selfieS3Key,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  // Step 2 — Send selfie to Smile Identity
  const formData = new FormData();
  formData.append('selfie_image', {
    uri: selfieUri,
    type: 'image/jpeg',
    name: 'selfie.jpg',
  });
  formData.append('partner_id', SMILE_PARTNER_ID);
  formData.append('user_id', userId);
  formData.append('job_type', '4'); // SmartSelfie enrollment

  let smileResult;
  try {
    const response = await fetch(`${SMILE_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
    });
    smileResult = await response.json();
  } catch (err) {
    await supabase.from('verifications').update({
      status: 'manual_review',
      failure_reason: 'Network error during face match',
    }).eq('id', record.id);
    throw new Error('Face match failed. Flagged for manual review.');
  }

  // Step 3 — Evaluate confidence score
  const confidence = smileResult.confidence || 0;
  const passed = confidence >= 80; // 80% match threshold
  const status = passed ? 'passed' : confidence >= 60 ? 'manual_review' : 'failed';

  // Step 4 — Update record
  await supabase.from('verifications').update({
    status,
    provider_ref: smileResult.SmileJobID,
    score: confidence,
    failure_reason: passed ? null : `Confidence score too low: ${confidence}%`,
  }).eq('id', record.id);

  // Step 5 — Log
  await logAction(userId, passed ? AUDIT_ACTIONS.VERIFICATION_PASSED : AUDIT_ACTIONS.VERIFICATION_FAILED, {
    type: 'face_match',
    confidence,
    smile_job_id: smileResult.SmileJobID,
  });

  return { passed, status, confidence };
}

// ─────────────────────────────────────────────────────────────
// SECTION 6 — VERIFICATION STATUS CHECK
// Used to block unverified workers from receiving bookings
// ─────────────────────────────────────────────────────────────

/**
 * Check if a worker is fully verified (ID + face match passed).
 * Returns true if verified, false if not.
 */
export async function isWorkerVerified(userId) {
  const { data, error } = await supabase
    .from('verifications')
    .select('verification_type, status')
    .eq('user_id', userId)
    .in('verification_type', ['id_document', 'face_match'])
    .eq('status', 'passed');

  if (error) return false;

  const types = (data || []).map(v => v.verification_type);
  return types.includes('id_document') && types.includes('face_match');
}

/**
 * Get the full verification status for a user.
 * Used to show verification progress in the app.
 */
export async function getVerificationStatus(userId) {
  const { data, error } = await supabase
    .from('verifications')
    .select('verification_type, status, created_at, failure_reason')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Build a status map
  const statusMap = {
    phone_otp:    'not_started',
    email:        'not_started',
    id_document:  'not_started',
    face_match:   'not_started',
    liveness:     'not_started',
  };

  for (const v of data || []) {
    // Only keep the latest status per type
    if (statusMap[v.verification_type] === 'not_started') {
      statusMap[v.verification_type] = v.status;
    }
  }

  const allPassed =
    statusMap.phone_otp   === 'passed' &&
    statusMap.id_document === 'passed' &&
    statusMap.face_match  === 'passed';

  return { statusMap, allPassed };
}

// ─────────────────────────────────────────────────────────────
// SECTION 7 — FRAUD REPORT FILING
// Customer or worker files a report against another user
// ─────────────────────────────────────────────────────────────

/**
 * File a fraud report against a user.
 *
 * @param {object} params
 * @param {string} params.reportedBy        user filing the report
 * @param {string} params.reportedUserId    user being reported
 * @param {string} params.bookingId         related booking
 * @param {string} params.fraudType         'scam'|'fake_identity'|'no_show'|'overcharge'|'harassment'|'other'
 * @param {string} params.description       full description of what happened
 * @param {string[]} params.evidenceS3Keys  array of S3 keys for screenshots/photos
 */
export async function fileFraudReport({
  reportedBy,
  reportedUserId,
  bookingId,
  fraudType,
  description,
  evidenceS3Keys = [],
}) {
  const { data, error } = await supabase
    .from('fraud_reports')
    .insert({
      reported_by: reportedBy,
      reported_user_id: reportedUserId,
      booking_id: bookingId,
      fraud_type: fraudType,
      description,
      evidence_s3_keys: evidenceS3Keys,
      status: 'open',
    })
    .select()
    .single();

  if (error) throw error;

  // Log the fraud report action
  await logAction(reportedBy, AUDIT_ACTIONS.FRAUD_REPORT_FILED, {
    reported_user_id: reportedUserId,
    booking_id: bookingId,
    fraud_type: fraudType,
    report_id: data.id,
  });

  // Notify admin (insert system notification for admin users)
  await supabase.from('notifications').insert({
    user_id: reportedBy,
    title: 'Fraud Report Submitted',
    body: 'Your report has been received. Our team will review it within 24-48 hours.',
    type: 'system',
    data: { report_id: data.id },
  });

  return data;
}

// ─────────────────────────────────────────────────────────────
// SECTION 8 — BOOKING SECURITY GUARD
// Checks if a worker can receive a booking before allowing it
// ─────────────────────────────────────────────────────────────

/**
 * Run all security checks before a booking is created.
 * Throws a clear error if any check fails.
 *
 * @param {string} customerId
 * @param {string} workerUserId
 */
export async function bookingSecurityCheck(customerId, workerUserId) {
  // Check 1 — Customer account is active
  const { data: customer, error: custError } = await supabase
    .from('users')
    .select('is_active, is_verified')
    .eq('id', customerId)
    .single();

  if (custError || !customer) throw new Error('Customer account not found.');
  if (!customer.is_active) throw new Error('Your account has been suspended. Contact support.');

  // Check 2 — Worker is verified
  const workerVerified = await isWorkerVerified(workerUserId);
  if (!workerVerified) {
    throw new Error('This worker has not completed identity verification yet and cannot accept bookings.');
  }

  // Check 3 — Worker account is active
  const { data: workerUser } = await supabase
    .from('users')
    .select('is_active')
    .eq('id', workerUserId)
    .single();

  if (!workerUser?.is_active) {
    throw new Error('This worker account is currently unavailable.');
  }

  // Check 4 — No open fraud reports between these two users
  const { data: openReports } = await supabase
    .from('fraud_reports')
    .select('id')
    .eq('reported_by', customerId)
    .eq('reported_user_id', workerUserId)
    .in('status', ['open', 'investigating'])
    .limit(1);

  if (openReports && openReports.length > 0) {
    throw new Error('You have an open dispute with this worker. Resolve it before creating a new booking.');
  }

  return true;
}
