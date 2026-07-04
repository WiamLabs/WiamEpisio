'use client';
// © 2026 WiamApp. Powered by WiamLabs
// components/TeamList.js — interactive team management, mirrors the
// mobile BusinessTeamScreen's logic exactly for platform parity.

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function TeamList({ initialTeam, businessId, maxWorkers }) {
  const supabase = createClient();
  const [team, setTeam] = useState(initialTeam);
  const [error, setError] = useState('');

  const handleToggleHidden = async (member) => {
    const nextValue = !member.isHidden;
    setTeam(prev => prev.map(m => m.id === member.id ? { ...m, isHidden: nextValue } : m));
    try {
      const { error: updateError } = await supabase
        .from('business_team_members')
        .update({ is_hidden_from_search: nextValue })
        .eq('id', member.id)
        .eq('business_id', businessId);
      if (updateError) throw updateError;
    } catch (e) {
      // Roll back — the toggle must never silently lie about its
      // own state if the write actually failed.
      setTeam(prev => prev.map(m => m.id === member.id ? { ...m, isHidden: !nextValue } : m));
      setError('Could not update visibility. Try again.');
    }
  };

  const handleRemove = async (member) => {
    if (!confirm(`Remove ${member.name} from your team?`)) return;
    try {
      const { error: deleteError } = await supabase
        .from('business_team_members')
        .delete()
        .eq('id', member.id)
        .eq('business_id', businessId);
      if (deleteError) throw deleteError;
      setTeam(prev => prev.filter(m => m.id !== member.id));
    } catch (e) {
      setError('Could not remove member. Try again.');
    }
  };

  return (
    <div>
      {error && (
        <div className="bg-redTint text-red text-[13px] rounded-lg px-3.5 py-2.5 mb-4">{error}</div>
      )}

      <div className="bg-white border border-line rounded-card px-5">
        {team.length === 0 ? (
          <p className="text-[13px] text-inkMuted py-10 text-center">
            No team members yet. Invite workers from the WiamApp mobile app.
          </p>
        ) : (
          team.map((member, i) => (
            <div key={member.id} className={`flex items-center gap-3.5 py-4 ${i > 0 ? 'border-t border-line' : ''}`}>
              <div className="w-[38px] h-[38px] rounded-full bg-navy text-gold flex items-center justify-center font-display font-bold text-[13px] flex-shrink-0">
                {member.name?.[0]?.toUpperCase() || 'W'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[14px]">{member.name}</div>
                <div className="text-[11.5px] text-inkMuted mt-0.5">
                  {member.role} · {member.status === 'active' ? 'Active' : member.status === 'pending' ? 'Invited' : 'Inactive'}
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-[11.5px] text-inkMuted">Hide from public search</span>
                <button
                  onClick={() => handleToggleHidden(member)}
                  className={`relative w-9 h-[21px] rounded-full transition-colors ${member.isHidden ? 'bg-gold' : 'bg-line'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-[17px] h-[17px] rounded-full bg-white shadow transition-transform ${member.isHidden ? 'translate-x-[15px]' : ''}`} />
                </button>
              </div>
              <button
                onClick={() => handleRemove(member)}
                className="ml-2 text-red/70 hover:text-red"
                title="Remove from team"
              >
                <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="9" cy="7" r="3.2"/><path d="M3 19c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5"/><path d="M16 8h5M18.5 5.5v5"/>
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      <p className="text-[12px] text-inkMuted mt-3">
        {team.length} of {maxWorkers === 9999 ? 'unlimited' : maxWorkers} workers used on your plan.
      </p>
    </div>
  );
}
