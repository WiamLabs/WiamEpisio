'use client';
// © 2026 WiamApp. Powered by WiamLabs
// components/AssignWorkerButton.js — Growth+ Job Assignment action,
// shown inline on a booking row.

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function AssignWorkerButton({ bookingId, currentWorkerName, teamMembers, onAssigned }) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState('');

  const handleAssign = async (workerProfileId, name) => {
    setAssigning(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${BACKEND_URL}/api/growth/bookings/${bookingId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ workerProfileId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      onAssigned?.(bookingId, name);
      setOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(v => !v)}
        className="text-[11.5px] font-semibold text-gold border border-gold/30 rounded-md px-2 py-1 whitespace-nowrap"
      >
        Reassign
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-line rounded-lg shadow-lg z-20 w-48 py-1.5">
          {error && <div className="text-[11px] text-red px-3 py-1.5">{error}</div>}
          {teamMembers.length === 0 ? (
            <div className="text-[12px] text-inkMuted px-3 py-2">No other team members.</div>
          ) : (
            teamMembers.map((m) => (
              <button
                key={m.workerId}
                disabled={assigning}
                onClick={() => handleAssign(m.workerId, m.name)}
                className="w-full text-left text-[12.5px] px-3 py-2 hover:bg-paper disabled:opacity-50"
              >
                {m.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
