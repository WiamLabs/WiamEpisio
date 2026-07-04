'use client';
// © 2026 WiamApp. Powered by WiamLabs
// components/BookingsTable.js

import { useState } from 'react';
import AssignWorkerButton from './AssignWorkerButton';

function StatusPill({ status }) {
  const map = {
    pending: 'bg-amberTint text-amber',
    accepted: 'bg-blueTint text-blue',
    in_progress: 'bg-blueTint text-blue',
    completed: 'bg-greenTint text-green',
    cancelled: 'bg-red/10 text-red',
  };
  const label = {
    pending: 'Pending', accepted: 'Accepted', in_progress: 'In progress',
    completed: 'Completed', cancelled: 'Cancelled',
  };
  return (
    <span className={`inline-flex text-[11.5px] font-semibold px-2.5 py-1 rounded-md ${map[status] || 'bg-line text-inkMuted'}`}>
      {label[status] || status}
    </span>
  );
}

export default function BookingsTable({ initialBookings, canAssign, teamMembers }) {
  const [bookings, setBookings] = useState(initialBookings);

  const handleAssigned = (bookingId, newWorkerName) => {
    setBookings(prev => prev.map(b =>
      b.id === bookingId ? { ...b, _workerNameOverride: newWorkerName } : b
    ));
  };

  if (bookings.length === 0) {
    return <p className="text-[13px] text-inkMuted py-10 text-center">No bookings in this view yet.</p>;
  }

  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="text-left text-[11.5px] text-inkMuted font-semibold uppercase tracking-wide">
          <th className="py-2.5">Booking</th>
          <th className="py-2.5">Worker</th>
          <th className="py-2.5">Category</th>
          <th className="py-2.5">Date</th>
          <th className="py-2.5">Status</th>
          <th className="py-2.5">Amount</th>
          {canAssign && <th className="py-2.5"></th>}
        </tr>
      </thead>
      <tbody>
        {bookings.map((b) => {
          const workerName = b._workerNameOverride || b.worker_profiles?.users?.full_name || 'Worker';
          const otherMembers = teamMembers.filter(m => m.name !== workerName);
          return (
            <tr key={b.id} className="border-t border-line">
              <td className="py-3 font-mono text-[11.5px] text-inkFaint">#{b.id.slice(0, 8).toUpperCase()}</td>
              <td className="py-3 font-semibold">{workerName}</td>
              <td className="py-3">{b.categories?.name || '—'}</td>
              <td className="py-3">{new Date(b.scheduled_date || b.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
              <td className="py-3"><StatusPill status={b.status} /></td>
              <td className="py-3">{b.status === 'cancelled' ? '—' : `$${parseFloat(b.agreed_price || 0).toFixed(2)}`}</td>
              {canAssign && (
                <td className="py-3">
                  {['pending', 'accepted'].includes(b.status) && (
                    <AssignWorkerButton
                      bookingId={b.id}
                      currentWorkerName={workerName}
                      teamMembers={otherMembers}
                      onAssigned={handleAssigned}
                    />
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
