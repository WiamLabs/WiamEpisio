// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/uploads.js — File upload endpoint using Cloudflare R2

import { Router } from 'express';
import multer from 'multer';
import { verifyUserToken } from '../lib/supabaseAdmin.js';
import {
  uploadAvatar,
  uploadPortfolioImage,
  uploadVoiceMessage,
  uploadIdDocument,
  uploadSelfie,
  uploadCV,
} from '../lib/r2Client.js';

const router = Router();

// Use memory storage — files go straight to R2, never touch disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/webp',
      'audio/mp4', 'audio/m4a', 'audio/mpeg',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('File type not allowed.'));
  },
});

// Upload avatar
router.post('/avatar', upload.single('file'), async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const url = await uploadAvatar(req.file.buffer, user.id);
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Upload portfolio image
router.post('/portfolio', upload.single('file'), async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const url = await uploadPortfolioImage(req.file.buffer, user.id);
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Upload voice message
router.post('/voice', upload.single('file'), async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const url = await uploadVoiceMessage(req.file.buffer, user.id);
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Upload ID document — private, returns only key not URL
router.post('/document', upload.single('file'), async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { side = 'front' } = req.body;
    const key = await uploadIdDocument(req.file.buffer, user.id, side);
    // Never return a public URL for ID documents
    res.json({ key, message: 'Document uploaded securely.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Upload selfie — private
router.post('/selfie', upload.single('file'), async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const key = await uploadSelfie(req.file.buffer, user.id);
    res.json({ key, message: 'Selfie uploaded securely.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// CV / resume upload — public endpoint, no auth required since
// job applicants don't have WiamApp accounts. The CV key is passed
// alongside the application form data, never stored or linked alone.
router.post('/cv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided.' });
    const email = req.body.email || 'applicant';
    const key = await uploadCV(req.file.buffer, email, req.file.mimetype);
    res.json({ key, message: 'CV uploaded.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
