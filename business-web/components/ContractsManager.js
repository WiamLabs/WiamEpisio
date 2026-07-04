'use client';
// © 2026 WiamApp. Powered by WiamLabs
// components/ContractsManager.js

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_STYLE = {
  active: 'bg-greenTint text-green',
  paused: 'bg-amberTint text-amber',
  ended: 'bg-line text-inkMuted',
};

export default function ContractsManager({ initialContracts, teamMembers }) {
  const supabase = createClient();
  const [contracts, setContracts] = useState(initialContracts);
  const [showForm, setShowForm] = useState(false);
  const [workerProfileId, setWorkerProfileId] = useState(teamMembers[0]?.workerId || '');
  const [jobDescription, setJobDescription] = useState('');
  const [scheduleType, setScheduleType] = useState('weekly');
  const [scheduleDays, setScheduleDays] = useState([1]);
  const [agreedPrice, setAgreedPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const authHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` };
  };

  const toggleDay = (i) => {
    setScheduleDays(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i].sort());
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!workerProfileId || !jobDescription.trim()) {
      setError('Pick a team member and describe the job.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BACKEND_URL}/api/growth/contracts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          workerProfileId, jobDescription, scheduleType, scheduleDays,
          agreedPriceUsd: agreedPrice ? parseFloat(agreedPrice) : null,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setContracts(prev => [json.data, ...prev]);
      setShowForm(false);
      setJobDescription('');
      setAgreedPrice('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (contract, status) => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BACKEND_URL}/api/growth/contracts/${contract.id}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setContracts(prev => prev.map(c => c.id === contract.id ? { ...c, status } : c));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-[21px] font-bold text-ink">Recurring contracts</h1>
          <p className="text-[13px] text-inkMuted mt-1">Standing arrangements with your team — set once, never rebook.</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="bg-gold text-navy font-semibold text-[13px] px-4 py-2.5 rounded-lg">
          {showForm ? 'Cancel' : 'New contract'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-line rounded-card p-5 mb-6 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold mb-1.5">Team member</label>
            <select value={workerProfileId} onChange={(e) => setWorkerProfileId(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-sm">
              {teamMembers.map(m => <option key={m.workerId} value={m.workerId}>{m.name} — {m.role}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5">Job description</label>
            <textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-sm resize-none" placeholder="e.g. Full lobby and common area cleaning" />
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold mb-1.5">Frequency</label>
              <select value={scheduleType} onChange={(e) => setScheduleType(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-sm">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Agreed price (USD, optional)</label>
              <input value={agreedPrice} onChange={(e) => setAgreedPrice(e.target.value)} type="number" className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-sm" placeholder="45.00" />
            </div>
          </div>
          {scheduleType === 'weekly' && (
            <div>
              <label className="block text-xs font-semibold mb-1.5">Days</label>
              <div className="flex gap-1.5">
                {DAYS.map((d, i) => (
                  <button key={d} type="button" onClick={() => toggleDay(i)} className={`w-9 h-9 rounded-lg text-xs font-semibold ${scheduleDays.includes(i) ? 'bg-gold text-navy' : 'bg-line text-inkMuted'}`}>
                    {d[0]}
                  </button>
                ))}
              </div>
            </div>
          )}
          {error && <div className="text-[13px] text-red bg-redTint rounded-lg px-3 py-2.5">{error}</div>}
          <button type="submit" disabled={submitting} className="bg-gold text-navy font-semibold text-sm rounded-lg px-5 py-2.5 disabled:opacity-60">
            {submitting ? 'Creating...' : 'Create contract'}
          </button>
        </form>
      )}

      {contracts.length === 0 ? (
        <div className="bg-white border border-line rounded-card py-14 text-center">
          <p className="text-[13px] text-inkMuted">No recurring contracts yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-line rounded-card divide-y divide-line">
          {contracts.map((c) => (
            <div key={c.id} className="p-4.5 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{c.worker_profiles?.users?.full_name || 'Worker'}</div>
                <div className="text-[12.5px] text-inkMuted mt-0.5">{c.job_description}</div>
                <div className="text-[11.5px] text-inkFaint mt-1 capitalize">{c.schedule_type} {c.agreed_price_usd ? `· $${c.agreed_price_usd}` : ''}</div>
              </div>
              <span className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-md capitalize flex-shrink-0 ${STATUS_STYLE[c.status]}`}>{c.status}</span>
              <div className="flex gap-1.5 flex-shrink-0">
                {c.status === 'active' && <button onClick={() => handleStatusChange(c, 'paused')} className="text-[12px] font-semibold text-amber border border-amber/30 rounded-lg px-2.5 py-1.5">Pause</button>}
                {c.status === 'paused' && <button onClick={() => handleStatusChange(c, 'active')} className="text-[12px] font-semibold text-green border border-green/30 rounded-lg px-2.5 py-1.5">Resume</button>}
                {c.status !== 'ended' && <button onClick={() => handleStatusChange(c, 'ended')} className="text-[12px] font-semibold text-red border border-red/30 rounded-lg px-2.5 py-1.5">End</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
