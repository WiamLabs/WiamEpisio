// © 2026 WiamApp. Powered by WiamLabs
// lib/cloudinary.js — mirrors lib/api/uploads.js from the mobile
// app, adapted for a real browser File object instead of an
// expo-image-picker URI.

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

/**
 * @param {File} file - a real browser File from an <input type="file">
 * @param {string} folder - Cloudinary folder e.g. 'spotlight'
 */
export async function uploadImage(file, folder = 'general') {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Cloudinary credentials missing. Check your .env.local file.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', `wiamapp/${folder}`);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Upload failed: ${err.error?.message || 'unknown error'}`);
  }

  const result = await response.json();
  return result.secure_url;
}
