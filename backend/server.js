// © 2026 WiamApp. Powered by WiamLabs
// backend/server.js — Complete Express Server V3
// All routes, security, rate limiting, and health checks

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

// ─── ROUTE IMPORTS ────────────────────────────────────────────
import authRoutes         from './routes/auth.js';
import workerRoutes       from './routes/workers.js';
import bookingRoutes      from './routes/bookings.js';
import uploadRoutes       from './routes/uploads.js';
import verificationRoutes from './routes/verification.js';
import paymentRoutes      from './routes/payments.js';
import notificationRoutes from './routes/notifications.js';
import webhookRoutes      from './routes/webhooks.js';
import safetyRoutes       from './routes/safety.js';
import spotlightRoutes    from './routes/spotlight.js';
import quoteRoutes        from './routes/quotes.js';
import emergencyRoutes    from './routes/emergency.js';
import rankingRoutes      from './routes/rankings.js';
import businessRoutes     from './routes/business.js';
import teamRoutes         from './routes/team.js';
import adminRoutes        from './routes/admin.js';
import onlineRoutes       from './routes/online.js';
import currencyRoutes     from './routes/currency.js';
import trustRoutes        from './routes/trust.js';
import cronRoutes         from './routes/cron.js';
import chatRoutes         from './routes/chat.js';
import growthRoutes       from './routes/growth.js';
import enterpriseRoutes   from './routes/enterprise.js';
import careersRoutes      from './routes/careers.js';
import referralRoutes     from './routes/referrals.js';
import disputeRoutes      from './routes/disputes.js';

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── SECURITY MIDDLEWARE ──────────────────────────────────────
app.use(helmet());

app.use(cors({
  origin: [
    'https://wiamapp.com',
    'https://www.wiamapp.com',
    'https://dashboard.wiamapp.com',
    'https://wiamapp.pages.dev',
    'exp://*',
    'http://localhost:*',
    process.env.NODE_ENV === 'development' ? '*' : null,
  ].filter(Boolean),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-paystack-signature'],
}));

// ─── RATE LIMITERS ────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many attempts. Try again in 15 minutes.' },
});

const verifyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Too many verification attempts. Try again in 1 hour.' },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { success: false, error: 'Too many uploads. Try again later.' },
});

// Apply global limiter — skip health/root so Render probes never get 429
app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/health') return next();
  return globalLimiter(req, res, next);
});

// Webhooks need raw body for signature verification — mount BEFORE json parser
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

// Body parsing for all other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── HEALTH CHECKS ────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success: true,
    app: 'WiamApp Backend',
    version: '3.0.0',
    powered_by: 'WiamLabs',
    status: 'running',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()) + ' seconds',
  });
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });
});

// ─── API ROUTES ───────────────────────────────────────────────
app.use('/api/auth',          authLimiter,    authRoutes);
app.use('/api/workers',                       workerRoutes);
app.use('/api/bookings',                      bookingRoutes);
app.use('/api/uploads',       uploadLimiter,  uploadRoutes);
app.use('/api/verify',        verifyLimiter,  verificationRoutes);
app.use('/api/payments',                      paymentRoutes);
app.use('/api/notifications',                 notificationRoutes);
app.use('/api/safety',                        safetyRoutes);
app.use('/api/spotlight',                     spotlightRoutes);
app.use('/api/quotes',                        quoteRoutes);
app.use('/api/emergency',                     emergencyRoutes);
app.use('/api/rankings',                      rankingRoutes);
app.use('/api/business',                      businessRoutes);
app.use('/api/team',          authLimiter,    teamRoutes);
app.use('/api/admin',                         adminRoutes);
app.use('/api/online',                        onlineRoutes);
app.use('/api/currency',                      currencyRoutes);
app.use('/api/trust',                         trustRoutes);
app.use('/api/cron',                          cronRoutes);
app.use('/api/chat',                          chatRoutes);
app.use('/api/growth',                        growthRoutes);
app.use('/api/enterprise',                    enterpriseRoutes);
app.use('/api/careers',                       careersRoutes);
app.use('/api/referrals',                     referralRoutes);
app.use('/api/disputes',                      disputeRoutes);

// ─── 404 HANDLER ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.path}` });
});

// ─── GLOBAL ERROR HANDLER ────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Something went wrong. Our team has been notified.'
      : err.message,
  });
});

// ─── START ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║       WiamApp Backend V3                 ║
║       Powered by WiamLabs               ║
║       Running on port ${PORT}               ║
║       Environment: ${process.env.NODE_ENV || 'development'}          ║
╚══════════════════════════════════════════╝
  `);
});

export default app;
