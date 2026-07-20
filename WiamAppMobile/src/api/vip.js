/**
 * Membership / VIP — matches /api/v1/vip/*
 */
import apiClient from './client';

function fmt(error, fallback) {
  let msg = error.response?.data?.error || error.message || fallback;
  if (msg != null && typeof msg !== 'string') {
    try { msg = JSON.stringify(msg); } catch { msg = String(msg); }
  }
  return msg || fallback;
}

const vipApi = {
  plans: async () => {
    try { return (await apiClient.get('/vip/plans')).data; }
    catch (e) { throw fmt(e, 'Failed to load membership plans'); }
  },
  status: async () => {
    try { return (await apiClient.get('/vip/status')).data; }
    catch (e) { throw fmt(e, 'Failed to load membership status'); }
  },
  initialize: async (planId) => {
    try { return (await apiClient.post('/vip/initialize', { plan_id: planId })).data; }
    catch (e) { throw fmt(e, 'Failed to start membership checkout'); }
  },
  verify: async (reference, planId) => {
    try {
      return (await apiClient.post('/vip/verify', { reference, plan_id: planId })).data;
    } catch (e) { throw fmt(e, 'Failed to verify membership payment'); }
  },
  claimStipend: async () => {
    try { return (await apiClient.post('/vip/claim-stipend')).data; }
    catch (e) { throw fmt(e, 'Failed to claim daily bonus'); }
  },
};

export default vipApi;
