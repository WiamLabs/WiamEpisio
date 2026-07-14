// © 2026 WiamApp. Powered by WiamLabs
// backend/lib/r2Client.js — Cloudflare R2 Storage
// Handles images AND voice recordings

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// R2 uses the S3-compatible API
const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT, // from Render env vars
  credentials: {
    accessKeyId:     process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME  = process.env.CLOUDFLARE_R2_BUCKET_NAME  || 'wiamapp';
const PUBLIC_URL   = process.env.CLOUDFLARE_R2_PUBLIC_URL;   // e.g. https://pub-xxx.r2.dev

// ─── UPLOAD FILE TO R2 ───────────────────────────────────────

/**
 * Upload any file buffer to Cloudflare R2
 * @param {Buffer} fileBuffer - file content
 * @param {string} key        - path in bucket e.g. 'avatars/user123.jpg'
 * @param {string} mimeType   - e.g. 'image/jpeg', 'audio/mp4'
 * @returns {string} public URL of the uploaded file
 */
export async function uploadToR2(fileBuffer, key, mimeType) {
  await r2.send(new PutObjectCommand({
    Bucket:      BUCKET_NAME,
    Key:         key,
    Body:        fileBuffer,
    ContentType: mimeType,
  }));

  return `${PUBLIC_URL}/${key}`;
}

/**
 * Upload a worker avatar image
 */
export async function uploadAvatar(fileBuffer, userId) {
  const key = `avatars/${userId}_${Date.now()}.jpg`;
  return uploadToR2(fileBuffer, key, 'image/jpeg');
}

/**
 * Upload a portfolio image
 */
export async function uploadPortfolioImage(fileBuffer, workerId) {
  const key = `portfolios/${workerId}_${Date.now()}.jpg`;
  return uploadToR2(fileBuffer, key, 'image/jpeg');
}

/**
 * Upload a booking before/after completion photo
 */
export async function uploadBookingPhoto(fileBuffer, bookingId, phase = 'after') {
  const key = `booking-photos/${bookingId}_${phase}_${Date.now()}.jpg`;
  return uploadToR2(fileBuffer, key, 'image/jpeg');
}

/**
 * Upload dispute evidence (photo, screenshot, receipt image)
 */
export async function uploadDisputeEvidence(fileBuffer, disputeId) {
  const key = `dispute-evidence/${disputeId}_${Date.now()}.jpg`;
  return uploadToR2(fileBuffer, key, 'image/jpeg');
}

/**
 * Upload a voice message (audio)
 */
export async function uploadVoiceMessage(fileBuffer, senderId) {
  const key = `voice-messages/${senderId}_${Date.now()}.m4a`;
  return uploadToR2(fileBuffer, key, 'audio/mp4');
}

/**
 * Upload ID document — stored privately (no public URL returned)
 * Returns only the S3 key, not a public URL
 * Admin must use a signed URL to view it
 */
export async function uploadIdDocument(fileBuffer, userId, side = 'front') {
  const key = `private/documents/${userId}/${side}_${Date.now()}.jpg`;
  await r2.send(new PutObjectCommand({
    Bucket:      BUCKET_NAME,
    Key:         key,
    Body:        fileBuffer,
    ContentType: 'image/jpeg',
  }));
  // Return ONLY the key — never a public URL for ID documents
  return key;
}

/**
 * Upload selfie — stored privately
 */
export async function uploadSelfie(fileBuffer, userId) {
  const key = `private/selfies/${userId}_${Date.now()}.jpg`;
  await r2.send(new PutObjectCommand({
    Bucket:      BUCKET_NAME,
    Key:         key,
    Body:        fileBuffer,
    ContentType: 'image/jpeg',
  }));
  return key;
}

/**
 * Upload a CV/resume — stored privately (PDF or image).
 * Same as ID documents — returns only the key, never a public URL.
 * Admin must generate a signed URL to download it.
 */
export async function uploadCV(fileBuffer, applicantEmail, mimeType) {
  const ext = mimeType === 'application/pdf' ? 'pdf' : 'doc';
  const safeEmail = applicantEmail.replace(/[^a-zA-Z0-9]/g, '_');
  const key = `private/cvs/${safeEmail}_${Date.now()}.${ext}`;
  await r2.send(new PutObjectCommand({
    Bucket:      BUCKET_NAME,
    Key:         key,
    Body:        fileBuffer,
    ContentType: mimeType,
  }));
  return key;
}

/**
 * Private ID docs are uploaded with R2_PRIVATE_* (verification.js).
 * Fall back to CLOUDFLARE_R2_* when private env is not set (legacy keys).
 */
function privateDocClient() {
  const endpoint = process.env.R2_PRIVATE_ENDPOINT || process.env.CLOUDFLARE_R2_ENDPOINT;
  const accessKeyId = process.env.R2_PRIVATE_ACCESS_KEY || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.R2_PRIVATE_SECRET_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucket =
    process.env.R2_PRIVATE_BUCKET_NAME || process.env.CLOUDFLARE_R2_BUCKET_NAME || BUCKET_NAME;

  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
  return { client, bucket };
}

/**
 * Generate a temporary signed URL for private ID documents.
 * Only admins / Studio can call this — expires in 15 minutes.
 */
export async function getPrivateDocumentUrl(key) {
  const { client, bucket } = privateDocClient();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: 900 });
}

/**
 * Delete a file from R2
 */
export async function deleteFromR2(key) {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
}
