'use client';
// © 2026 WiamApp. Powered by WiamLabs
// components/ProfileEditor.js

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ProfileEditor({ business, userId }) {
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [companyName, setCompanyName] = useState(business?.company_name || '');
  const [contactName, setContactName] = useState(business?.contact_name || '');
  const [contactPhone, setContactPhone] = useState(business?.contact_phone || '');
  const [industry, setIndustry] = useState(business?.industry || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('business_profiles')
        .update({
          company_name: companyName,
          contact_name: contactName,
          contact_phone: contactPhone,
          industry,
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;
      setEditing(false);
    } catch (e) {
      setError('Could not save changes. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-line rounded-card">
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <h3 className="text-[14.5px] font-bold">Company details</h3>
        {!editing && (
          <button onClick={() => setEditing(true)} className="border border-line text-ink font-semibold text-[12.5px] px-3.5 py-2 rounded-lg hover:border-gold">
            Edit details
          </button>
        )}
      </div>
      <div className="p-5">
        {error && <div className="text-[13px] text-red bg-redTint rounded-lg px-3 py-2.5 mb-4">{error}</div>}

        <div className="grid grid-cols-2 gap-4 mb-1">
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">Company name</label>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={!editing}
              className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-sm disabled:text-inkMuted outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">Industry</label>
            <input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              disabled={!editing}
              className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-sm disabled:text-inkMuted outline-none focus:border-gold"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">Contact name</label>
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              disabled={!editing}
              className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-sm disabled:text-inkMuted outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">Contact phone</label>
            <input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              disabled={!editing}
              className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-sm disabled:text-inkMuted outline-none focus:border-gold"
            />
          </div>
        </div>

        {editing && (
          <div className="flex gap-2 mt-5">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-gold text-navy font-semibold text-sm rounded-lg px-5 py-2.5 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="border border-line text-ink font-semibold text-sm rounded-lg px-5 py-2.5"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
