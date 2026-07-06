// © 2026 WiamApp. Powered by WiamLabs
// lib/api/uploads.js — File uploads to Cloudinary (images) and Cloudflare R2 (voice)

const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

// ─── CLOUDINARY — Image Uploads ──────────────────────────────

/**
 * Upload any image to Cloudinary
 * Returns the secure image URL
 *
 * @param {string} imageUri - Local file URI from expo-image-picker
 * @param {string} folder - Cloudinary folder e.g. 'avatars', 'portfolios', 'ids'
 */
export async function uploadImage(imageUri, folder = 'general') {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Cloudinary credentials missing. Check your .env file.');
  }

  const formData = new FormData();
  formData.append('file', {
    uri: imageUri,
    type: 'image/jpeg',
    name: `wiamapp_${Date.now()}.jpg`,
  });
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', `wiamapp/${folder}`);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Cloudinary upload failed: ${err.error?.message}`);
  }

  const result = await response.json();
  return result.secure_url;
}

/**
 * Upload worker avatar photo
 */
export async function uploadAvatar(imageUri) {
  return uploadImage(imageUri, 'avatars');
}

/**
 * Upload portfolio image for a worker
 */
export async function uploadPortfolioImage(imageUri) {
  return uploadImage(imageUri, 'portfolios');
}

/**
 * Upload ID document (front or back)
 * NOTE: In production, these go to PRIVATE AWS S3, not Cloudinary
 * This is a simplified version for the MVP
 */
export async function uploadIdDocument(imageUri, side = 'front') {
  return uploadImage(imageUri, `documents/${side}`);
}

/**
 * Upload selfie for face verification
 */
export async function uploadSelfie(imageUri) {
  return uploadImage(imageUri, 'selfies');
}

// Voice messages are NOT uploaded directly from the app to R2 — a
// mobile client can never hold valid R2 write credentials safely,
// and R2 rejects unsigned PUT requests anyway. The real path is
// sendVoiceMessage() in lib/api/messages.js, which sends the audio
// to the backend's /api/chat/send-voice endpoint; the backend does
// the actual signed upload via backend/lib/r2Client.js.

// ─── Smile Identity — ID Verification ────────────────────────

const SMILE_PARTNER_ID = process.env.EXPO_PUBLIC_SMILE_IDENTITY_PARTNER_ID;
const SMILE_API_KEY = process.env.EXPO_PUBLIC_SMILE_IDENTITY_API_KEY;
const SMILE_ENV = process.env.EXPO_PUBLIC_SMILE_IDENTITY_ENV || 'sandbox';

const SMILE_BASE_URL = SMILE_ENV === 'production'
  ? 'https://api.smileidentity.com/v1'
  : 'https://testapi.smileidentity.com/v1';

/**
 * Verify a Ghana Card (or other African ID) using Smile Identity
 * Returns verification result: passed, failed, or needs_review
 *
 * @param {object} params
 * @param {string} params.idNumber - e.g. Ghana Card number
 * @param {string} params.idType - e.g. 'GHANA_CARD', 'PASSPORT', 'VOTER_ID'
 * @param {string} params.firstName
 * @param {string} params.lastName
 * @param {string} params.country - e.g. 'GH' for Ghana, 'NG' for Nigeria
 */
export async function verifyIdDocument({ idNumber, idType, firstName, lastName, country = 'GH' }) {
  if (!SMILE_PARTNER_ID || !SMILE_API_KEY) {
    throw new Error('Smile Identity credentials missing. Check your .env file.');
  }

  const response = await fetch(`${SMILE_BASE_URL}/id_verification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Smile Identity verification failed: ${err.error}`);
  }

  const result = await response.json();
  return {
    passed: result.ResultText === 'Exact Match',
    resultText: result.ResultText,
    confidence: result.ConfidenceValue,
    smileJobId: result.SmileJobID,
  };
}

/**
 * Perform face match — compare selfie to ID photo
 * Uses Smile Identity's SmartSelfie™ enrollment
 */
export async function performFaceMatch({ selfieUri, idImageUri, userId }) {
  const formData = new FormData();
  formData.append('selfie_image', {
    uri: selfieUri,
    type: 'image/jpeg',
    name: 'selfie.jpg',
  });
  formData.append('id_image', {
    uri: idImageUri,
    type: 'image/jpeg',
    name: 'id_photo.jpg',
  });
  formData.append('partner_id', SMILE_PARTNER_ID);
  formData.append('user_id', userId);

  const response = await fetch(`${SMILE_BASE_URL}/smile_links`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Face match failed. Please try again.');
  }

  const result = await response.json();
  return {
    passed: result.confidence >= 80,
    confidence: result.confidence,
    smileJobId: result.SmileJobID,
  };
}
