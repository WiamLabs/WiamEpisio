'use client';
// © 2026 WiamApp. Powered by WiamLabs
// app/apply/page.js — the real front door for Business registration.
// Public, no login required to arrive here. Handles account
// creation (or sign-in, for an existing WiamApp user upgrading to
// Business) as step 1, then the actual application as steps 2-4.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { uploadImage } from '@/lib/cloudinary';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

const PLANS = [
  { key: 'starter_biz', name: 'Starter', price: 20, limit: 'Up to 5 team members' },
  { key: 'growth_biz', name: 'Growth', price: 40, limit: 'Up to 25 team members', featured: true },
  { key: 'enterprise', name: 'Enterprise', price: 95, limit: 'Unlimited team members' },
];

export default function ApplyPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(1); // 1 account, 2 company, 3 plan, 4 documents, 5 success
  const [hasAccount, setHasAccount] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [industry, setIndustry] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [plan, setPlan] = useState('growth_biz');
  const [regDoc, setRegDoc] = useState(null);
  const [tinDoc, setTinDoc] = useState(null);

  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');

  const handleAccountStep = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (hasAccount) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: contactName || email.split('@')[0], role: 'business' } },
        });
        if (signUpError) throw signUpError;

        const { error: userErr } = await supabase.from('users').insert({
          id: data.user.id,
          full_name: contactName || email.split('@')[0],
          email,
          role: 'business',
        });
        // Ignore duplicate — a database trigger may have already
        // created this row from the auth signup metadata.
        if (userErr && !userErr.message.includes('duplicate')) throw userErr;
      }
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitApplication = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your session expired — please sign in again.');

      let registrationDocUrl = null;
      let tinDocUrl = null;
      if (regDoc) {
        setStage('Uploading registration certificate...');
        registrationDocUrl = await uploadImage(regDoc, 'business_documents');
      }
      if (tinDoc) {
        setStage('Uploading TIN certificate...');
        tinDocUrl = await uploadImage(tinDoc, 'business_documents');
      }

      setStage('Submitting application...');
      const res = await fetch(`${BACKEND_URL}/api/business/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          plan, companyName, contactName, email: session.user.email, phone, industry, teamSize,
          registrationDocUrl, tinDocUrl,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Could not submit application.');

      setStep(5);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setStage('');
    }
  };

  if (step === 5) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center px-4">
        <div className="bg-white rounded-card p-8 max-w-sm text-center">
          <svg className="w-12 h-12 text-green mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/></svg>
          <h1 className="font-display text-lg font-bold mb-2">Application submitted</h1>
          <p className="text-[13px] text-inkMuted mb-6">
            Our team reviews registration documents within 24–48 hours. You'll get a notification the moment your Gold checkmark is approved — your dashboard is ready to use right now in the meantime.
          </p>
          <button onClick={() => router.push('/dashboard')} className="w-full bg-gold text-navy font-semibold text-sm rounded-lg py-3">
            Go to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div className="w-9 h-9 rounded-lg bg-gold flex items-center justify-center font-display font-extrabold text-navy text-base">W</div>
          <div>
            <div className="font-display font-bold text-white text-[15px]">WiamApp Business</div>
            <div className="text-[11px] text-white/45">wiamapp.com/business</div>
          </div>
        </div>

        <div className="bg-white rounded-card p-7">
          <div className="flex gap-1.5 mb-6">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className={`h-1 flex-1 rounded-full ${n <= step ? 'bg-gold' : 'bg-line'}`} />
            ))}
          </div>

          {error && <div className="text-[13px] text-red bg-redTint rounded-lg px-3 py-2.5 mb-4">{error}</div>}

          {step === 1 && (
            <form onSubmit={handleAccountStep}>
              <h1 className="font-display text-lg font-bold mb-1">
                {hasAccount ? 'Sign in to apply' : 'Create your account'}
              </h1>
              <p className="text-[13px] text-inkMuted mb-5">
                {hasAccount ? 'Use your existing WiamApp account.' : 'Step 1 of 4 — this becomes your Business login.'}
              </p>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-3 py-2.5 mb-3 rounded-lg border border-line bg-paper text-sm outline-none focus:border-gold"
              />
              <input
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Password" minLength={6}
                className="w-full px-3 py-2.5 mb-4 rounded-lg border border-line bg-paper text-sm outline-none focus:border-gold"
              />
              <button type="submit" disabled={loading} className="w-full bg-gold text-navy font-semibold text-sm rounded-lg py-3 disabled:opacity-60">
                {loading ? 'Please wait...' : 'Continue'}
              </button>
              <button
                type="button"
                onClick={() => setHasAccount(v => !v)}
                className="w-full text-center text-[12.5px] text-gold font-semibold mt-3"
              >
                {hasAccount ? "Don't have an account? Create one" : 'Already have a WiamApp account? Sign in instead'}
              </button>
            </form>
          )}

          {step === 2 && (
            <div>
              <h1 className="font-display text-lg font-bold mb-1">Company details</h1>
              <p className="text-[13px] text-inkMuted mb-5">Step 2 of 4</p>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company name *" className="w-full px-3 py-2.5 mb-3 rounded-lg border border-line bg-paper text-sm outline-none focus:border-gold" />
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact name *" className="w-full px-3 py-2.5 mb-3 rounded-lg border border-line bg-paper text-sm outline-none focus:border-gold" />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number *" className="w-full px-3 py-2.5 mb-3 rounded-lg border border-line bg-paper text-sm outline-none focus:border-gold" />
              <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Industry (e.g. Hospitality)" className="w-full px-3 py-2.5 mb-3 rounded-lg border border-line bg-paper text-sm outline-none focus:border-gold" />
              <input value={teamSize} onChange={(e) => setTeamSize(e.target.value)} placeholder="Estimated team size" className="w-full px-3 py-2.5 mb-4 rounded-lg border border-line bg-paper text-sm outline-none focus:border-gold" />
              <button
                onClick={() => {
                  if (!companyName || !contactName || !phone) { setError('Company name, contact name, and phone are required.'); return; }
                  setError(''); setStep(3);
                }}
                className="w-full bg-gold text-navy font-semibold text-sm rounded-lg py-3"
              >
                Continue
              </button>
            </div>
          )}

          {step === 3 && (
            <div>
              <h1 className="font-display text-lg font-bold mb-1">Choose a plan</h1>
              <p className="text-[13px] text-inkMuted mb-5">Step 3 of 4 — you can change this anytime later.</p>
              <div className="space-y-2.5 mb-4">
                {PLANS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPlan(p.key)}
                    className={`w-full text-left p-3.5 rounded-lg border-2 flex items-center justify-between ${plan === p.key ? 'border-gold bg-goldTint' : 'border-line'}`}
                  >
                    <div>
                      <div className="font-semibold text-sm">{p.name} {p.featured && <span className="text-[10px] text-gold">· Most popular</span>}</div>
                      <div className="text-[11.5px] text-inkMuted">{p.limit}</div>
                    </div>
                    <div className="font-display font-bold text-sm">${p.price}/mo</div>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(4)} className="w-full bg-gold text-navy font-semibold text-sm rounded-lg py-3">
                Continue
              </button>
            </div>
          )}

          {step === 4 && (
            <div>
              <h1 className="font-display text-lg font-bold mb-1">Verify your business</h1>
              <p className="text-[13px] text-inkMuted mb-5">Step 4 of 4 — both documents are required before our team can review your business for Gold Verification.</p>

              <label className="block text-xs font-semibold mb-1.5">Business registration certificate *</label>
              <input type="file" accept="image/*" onChange={(e) => setRegDoc(e.target.files?.[0] || null)} className="text-sm mb-4 w-full" />

              <label className="block text-xs font-semibold mb-1.5">TIN certificate *</label>
              <input type="file" accept="image/*" onChange={(e) => setTinDoc(e.target.files?.[0] || null)} className="text-sm mb-5 w-full" />

              <button
                onClick={() => {
                  if (!regDoc || !tinDoc) { setError('Both documents are required before you can submit your application.'); return; }
                  setError('');
                  handleSubmitApplication();
                }}
                disabled={loading}
                className="w-full bg-gold text-navy font-semibold text-sm rounded-lg py-3 disabled:opacity-60"
              >
                {loading ? (stage || 'Submitting...') : 'Submit application'}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-white/50 mt-5">
          Prefer your phone? You can also apply from the WiamApp mobile app.
        </p>
      </div>
    </div>
  );
}
