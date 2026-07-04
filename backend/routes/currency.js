// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/currency.js — Currency conversion endpoints

import { Router } from 'express';
import { getRates, getSubscriptionPrices, usdToLocal } from '../lib/exchangeRates.js';

const router = Router();

// Get current exchange rates
router.get('/rates', async (req, res) => {
  try {
    const rates = await getRates();
    res.json({ success: true, data: rates, base: 'USD' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get subscription prices in a specific currency
router.get('/subscription-prices', async (req, res) => {
  try {
    const currency = req.query.currency || 'GHS';
    const prices = await getSubscriptionPrices(currency);
    res.json({ success: true, data: prices, currency });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Convert a specific USD amount to local currency
router.get('/convert', async (req, res) => {
  try {
    const { amount, currency } = req.query;
    if (!amount || !currency) {
      return res.status(400).json({ success: false, error: 'amount and currency are required' });
    }
    const localAmount = await usdToLocal(parseFloat(amount), currency);
    res.json({ success: true, data: { amount_usd: parseFloat(amount), amount_local: localAmount, currency } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
