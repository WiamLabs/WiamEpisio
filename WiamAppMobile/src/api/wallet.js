/**
 * Wallet / Money Ecosystem v5 API client for the native app.
 * Uses the shared apiClient (JWT-authenticated Axios instance).
 */
import apiClient from './client';

const walletApi = {
  // ── Coin Balance & History ──
  getBalance: () => apiClient.get('/coins/balance').then(r => r.data),
  getHistory: (page = 1, perPage = 20) =>
    apiClient.get('/coins/history', { params: { page, per_page: perPage } }).then(r => r.data),

  // ── Coin Packages ──
  getPackages: () => apiClient.get('/coins/packages').then(r => r.data),

  // ── Purchase Flow (Paystack) ──
  initializePurchase: (packageId) =>
    apiClient.post('/coins/initialize', { package_id: packageId }).then(r => r.data),
  verifyPurchase: (reference) =>
    apiClient.post('/coins/verify', { reference }).then(r => r.data),

  // ── Chapter Unlock ──
  unlockChapter: (contentId, chapterNumber) =>
    apiClient.post('/coins/unlock', {
      content_id: contentId,
      chapter_number: chapterNumber,
    }).then(r => r.data),

  // ── Wallet Status (v5 — includes freeze/risk) ──
  getWalletStatus: () => apiClient.get('/wallet/status').then(r => r.data),

  // ── Refund Request ──
  requestRefund: (transactionId, reason) =>
    apiClient.post('/wallet/refund', {
      transaction_id: transactionId,
      reason,
    }).then(r => r.data),

  // ── Creator Earnings ──
  getCreatorEarnings: () => apiClient.get('/creator/earnings').then(r => r.data),

  // ── Creator Ad Revenue Share ──
  getAdEarnings: () => apiClient.get('/creator/ad-earnings').then(r => r.data),

  // ── Premium Status ──
  getPremiumStatus: () => apiClient.get('/premium/status').then(r => r.data),
  issueIntegrityNonce: (platform) =>
    apiClient.post('/security/integrity/nonce', { platform }).then(r => r.data),
  startTrial: ({ deviceFingerprint, platform, deviceSignal, playIntegrityToken, iosIntegrityToken, integrityNonce }) =>
    apiClient.post('/premium/start-trial', {
      device_fingerprint: deviceFingerprint,
      platform,
      device_signal: deviceSignal || {},
      play_integrity_token: playIntegrityToken || null,
      ios_integrity_token: iosIntegrityToken || null,
      integrity_nonce: integrityNonce || null,
    }).then(r => r.data),
  verifyPlayIntegrity: ({ playIntegrityToken, integrityNonce }) =>
    apiClient.post('/security/play-integrity/verify', {
      play_integrity_token: playIntegrityToken || null,
      integrity_nonce: integrityNonce || null,
    }).then(r => r.data),

  // ── Premium Credits ──
  claimMonthlyCredits: () => apiClient.post('/premium/credits/claim').then(r => r.data),
  unlockWithCredit: (contentId, chapterNumber) =>
    apiClient.post('/premium/credits/unlock', {
      content_id: contentId,
      chapter_number: chapterNumber,
    }).then(r => r.data),
  getCreditsHistory: () => apiClient.get('/premium/credits/history').then(r => r.data),

  // ── IAP (In-App Purchase) ──
  getIAPPackages: () => apiClient.get('/iap/packages').then(r => r.data),
  confirmIAPPurchase: (rcUserId, productId, store, transactionId) =>
    apiClient.post('/iap/confirm', {
      rc_user_id: rcUserId,
      product_id: productId,
      store,
      transaction_id: transactionId,
    }).then(r => r.data),
  confirmIAPSubscription: (rcUserId, productId, store, transactionId, expiresAt) =>
    apiClient.post('/iap/confirm-subscription', {
      rc_user_id: rcUserId,
      product_id: productId,
      store,
      transaction_id: transactionId,
      expires_at: expiresAt,
    }).then(r => r.data),

  // ── Rewarded Ad Unlock ──
  rewardAdUnlock: (contentId, chapterNumber) =>
    apiClient.post('/ads/reward-unlock', {
      content_id: contentId,
      chapter_number: chapterNumber,
    }).then(r => r.data),

  // ── Dev Sandbox (testing without IAP) ──
  // Intentionally locked to debug builds so production binaries cannot invoke it.
  devActivatePremium: (plan = 'plus') => {
    if (!__DEV__) {
      return Promise.reject(new Error('Dev premium activation is disabled in production builds.'));
    }
    return apiClient.post('/premium/dev-activate', { plan }).then(r => r.data);
  },

  // ── Referrals ──
  getReferralCode: () => apiClient.get('/referral/code').then(r => r.data),
  applyReferralCode: (code) => apiClient.post('/referral/apply', { code }).then(r => r.data),
  getReferralStats: () => apiClient.get('/referral/stats').then(r => r.data),
  convertReferral: () => apiClient.post('/referral/convert').then(r => r.data),

  // ── Onboarding / Rewards ──
  claimWelcomeReward: () => apiClient.post('/rewards/welcome').then(r => r.data),
  getRewardsStatus: () => apiClient.get('/rewards/status').then(r => r.data),
  getFirstMissionStatus: () => apiClient.get('/rewards/first-mission/status').then(r => r.data),
  claimFirstMissionReward: () => apiClient.post('/rewards/first-mission/claim').then(r => r.data),
  claimWatchComplete: (episodeId, seriesId) =>
    apiClient.post('/rewards/watch-complete', {
      episode_id: episodeId,
      series_id: seriesId,
    }).then(r => r.data),
  claimAdCoins: () => apiClient.post('/rewards/ad-coins').then(r => r.data),
  claimSeriesFinish: (seriesId) =>
    apiClient.post('/rewards/series-finish', { series_id: seriesId }).then(r => r.data),
};

export default walletApi;
