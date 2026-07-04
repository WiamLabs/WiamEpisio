// © 2026 WiamApp. Powered by WiamLabs
// app/dashboard/profile/page.js

import { createClient } from '@/lib/supabase/server';
import ProfileEditor from '@/components/ProfileEditor';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from('business_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  const isGoldVerified = business?.business_verified_gold || false;
  const hasDocuments = !!(business?.registration_doc_url && business?.tin_doc_url);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-[21px] font-bold text-ink">Company profile</h1>
        <p className="text-[13px] text-inkMuted mt-1">Information shown to customers and used to verify your business.</p>
      </div>

      {isGoldVerified ? (
        <div className="flex gap-3 items-start bg-greenTint border border-green/25 rounded-card p-4 mb-5">
          <svg className="w-5 h-5 text-green mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/></svg>
          <div>
            <div className="text-[13.5px] font-bold mb-0.5">Gold Verified</div>
            <div className="text-[12.5px] text-inkMuted">Your business is Gold Verified. The badge shows on your profile and bookings across WiamApp.</div>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 items-start bg-goldTint border border-gold/35 rounded-card p-4 mb-5">
          <svg className="w-5 h-5 text-gold mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>
          <div>
            <div className="text-[13.5px] font-bold mb-0.5">{hasDocuments ? 'Pending review' : 'Documents needed'}</div>
            <div className="text-[12.5px] text-inkMuted">
              {hasDocuments
                ? "Our team is checking your registration documents. This usually takes 24–48 hours. Once approved, your Gold checkmark appears automatically — no action needed from you."
                : "Upload your registration certificate and TIN certificate from the WiamApp mobile app to start the Gold Verification review."}
            </div>
          </div>
        </div>
      )}

      <div className="mb-5">
        <ProfileEditor business={business} userId={user.id} />
      </div>

      <div className="bg-white border border-line rounded-card">
        <div className="px-5 py-4 border-b border-line">
          <h3 className="text-[14.5px] font-bold">Verification documents</h3>
        </div>
        <div className="px-5">
          <div className="flex items-center gap-2.5 py-3 border-b border-line text-[13px]">
            <svg className={`w-[15px] h-[15px] ${business?.registration_doc_url ? 'text-green' : 'text-inkFaint'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>
            <span className="flex-1 font-medium">Business registration certificate</span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${business?.registration_doc_url ? 'bg-greenTint text-green' : 'bg-line text-inkMuted'}`}>
              {business?.registration_doc_url ? 'Uploaded' : 'Missing'}
            </span>
          </div>
          <div className="flex items-center gap-2.5 py-3 text-[13px]">
            <svg className={`w-[15px] h-[15px] ${business?.tin_doc_url ? 'text-green' : 'text-inkFaint'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>
            <span className="flex-1 font-medium">Tax identification (TIN) certificate</span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${business?.tin_doc_url ? 'bg-greenTint text-green' : 'bg-line text-inkMuted'}`}>
              {business?.tin_doc_url ? 'Uploaded' : 'Missing'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
