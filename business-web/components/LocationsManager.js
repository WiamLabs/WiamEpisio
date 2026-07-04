'use client';
// © 2026 WiamApp. Powered by WiamLabs
// components/LocationsManager.js

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function LocationsManager({ initialLocations }) {
  const supabase = createClient();
  const [locations, setLocations] = useState(initialLocations);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [limit, setLimit] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Location name is required.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${BACKEND_URL}/api/enterprise/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ locationName: name, city, address, spendingLimitUsd: limit ? parseFloat(limit) : null }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setLocations(prev => [json.data, ...prev]);
      setShowForm(false);
      setName(''); setCity(''); setAddress(''); setLimit('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-[21px] font-bold text-ink">Multi-location</h1>
          <p className="text-[13px] text-inkMuted mt-1">Manage every branch from one account.</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="bg-gold text-navy font-semibold text-[13px] px-4 py-2.5 rounded-lg">
          {showForm ? 'Cancel' : 'Add location'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-line rounded-card p-5 mb-6 space-y-3.5">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Location name *" className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-sm" />
          <div className="grid grid-cols-2 gap-3.5">
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-sm" />
            <input value={limit} onChange={(e) => setLimit(e.target.value)} type="number" placeholder="Monthly spend limit (USD, optional)" className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-sm" />
          </div>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-sm" />
          {error && <div className="text-[13px] text-red bg-redTint rounded-lg px-3 py-2.5">{error}</div>}
          <button type="submit" disabled={submitting} className="bg-gold text-navy font-semibold text-sm rounded-lg px-5 py-2.5 disabled:opacity-60">
            {submitting ? 'Adding...' : 'Add location'}
          </button>
        </form>
      )}

      {locations.length === 0 ? (
        <div className="bg-white border border-line rounded-card py-14 text-center">
          <p className="text-[13px] text-inkMuted">No locations added yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5">
          {locations.map((loc) => (
            <div key={loc.id} className="bg-white border border-line rounded-card p-4.5">
              <div className="font-semibold text-sm">{loc.location_name}</div>
              <div className="text-[12.5px] text-inkMuted mt-1">{loc.city}{loc.address ? ` · ${loc.address}` : ''}</div>
              {loc.spending_limit_usd && (
                <div className="text-[11.5px] text-inkFaint mt-2">Monthly limit: ${parseFloat(loc.spending_limit_usd).toFixed(0)}</div>
              )}
              <div className="text-[11.5px] text-inkFaint mt-1">Manager: {loc.manager?.full_name || 'Unassigned'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
