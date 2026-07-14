'use client';
// © 2026 WiamApp. Powered by WiamLabs
// app/register/RegisterForm.js

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { COUNTRIES } from '../../lib/countries';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

const STEPS = { FORM: 'form', OTP: 'otp', PROFILE: 'profile', DOCS: 'docs', DONE: 'done' };
const ID_TYPES = [
  { value: 'national_id',     label: 'Ghana Card / National ID' },
  { value: 'passport',        label: 'Passport' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'voters_id',       label: "Voter's ID" },
];

export default function RegisterForm() {
  const params = useSearchParams();
  const roleFromLink = params.get('role');
  const refCode = params.get('ref');

  const [step, setStep] = useState(STEPS.FORM);
  const [role, setRole] = useState(roleFromLink === 'worker' ? 'worker' : 'customer');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otp, setOtp] = useState('');
  const [authToken, setAuthToken] = useState(null);
  const [referralApplied, setReferralApplied] = useState(null);

  // Worker profile-completion + verification state
  const [bio, setBio] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [idType, setIdType] = useState('national_id');
  const [docs, setDocs] = useState({ id_front: null, id_back: null, selfie: null });
  const [docKeys, setDocKeys] = useState({});
  const [docUploading, setDocUploading] = useState(null);

  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', password: '',
    city: '', country: 'GH', category: '',
    landmarkDescription: '', digitalAddressCode: '',
  });
  const [coords, setCoords] = useState(null); // { latitude, longitude }
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (role !== 'worker' || categories.length) return;
    fetch(`${BACKEND_URL}/api/workers/meta/categories`)
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [role, categories.length]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // Free, built into every browser — no API key, works in any
  // country identically. This is the GPS pin saved on the account;
  // the landmark/digital-code fields are what make it findable.
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Your browser does not support location. You can still register without it.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setError('Could not get your location. You can still register without it.');
        setLocating(false);
      }
    );
  };

  const submitRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (role === 'worker' && !form.category) {
      setError('Please choose your main service category.');
      return;
    }

    setLoading(true);
    try {
      const countryObj = COUNTRIES.find((c) => c.code === form.country);
      const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName, email: form.email, phone: form.phone,
          password: form.password, role, city: form.city,
          country: countryObj?.name || form.country, countryCode: form.country,
          landmarkDescription: form.landmarkDescription || undefined,
          digitalAddressCode: form.digitalAddressCode || undefined,
          latitude: coords?.latitude, longitude: coords?.longitude,
          category: role === 'worker' ? form.category : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed.');

      // Register endpoint emails the OTP. Only resend if that failed.
      if (!data.otpSent) {
        const otpRes = await fetch(`${BACKEND_URL}/api/auth/send-otp`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email }),
        });
        const otpData = await otpRes.json().catch(() => ({}));
        if (!otpRes.ok) throw new Error(otpData.error || 'Account created but verification email failed. Use Resend.');
      }

      setStep(STEPS.OTP);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const verifyRes = await fetch(`${BACKEND_URL}/api/auth/verify-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, code: otp }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || 'Invalid code.');

      // Log in to get a session token — needed for referral capture
      // AND, for workers, to complete their profile and submit ID
      // verification in the next steps.
      let token = null;
      try {
        const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email, password: form.password }),
        });
        const loginData = await loginRes.json();
        if (loginRes.ok && loginData.token) {
          token = loginData.token;
          setAuthToken(token);
        }
      } catch { /* referral/profile steps just won't run — account still created */ }

      if (token && refCode) {
        try {
          const refRes = await fetch(`${BACKEND_URL}/api/referrals/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ referralCode: refCode }),
          });
          setReferralApplied(refRes.ok);
        } catch { setReferralApplied(false); }
      }

      setStep(role === 'worker' && token ? STEPS.PROFILE : STEPS.DONE);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/send-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not resend code.');
    } catch (err) {
      setError(err.message || 'Could not resend code.');
    }
  };

  const submitProfile = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/workers/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ bio, hourlyRate: hourlyRate ? Number(hourlyRate) : undefined, currency: 'GHS' }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Could not save your profile.');
      }
      setStep(STEPS.DOCS);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const pickDoc = (docType) => (e) => {
    const file = e.target.files?.[0];
    if (file) setDocs((d) => ({ ...d, [docType]: file }));
  };

  const uploadDoc = async (docType) => {
    const file = docs[docType];
    if (!file) return null;
    setDocUploading(docType);
    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('docType', docType);
      formData.append('idType', idType);
      const res = await fetch(`${BACKEND_URL}/api/verification/upload-document`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Could not upload ${docType.replace('_', ' ')}.`);
      setDocKeys((k) => ({ ...k, [docType]: data.key }));
      return data.key;
    } finally {
      setDocUploading(null);
    }
  };

  const submitDocs = async (e) => {
    e.preventDefault();
    setError('');
    if (!docs.id_front || !docs.selfie) {
      setError('ID front photo and selfie are both required.');
      return;
    }
    setLoading(true);
    try {
      const frontKey = docKeys.id_front || await uploadDoc('id_front');
      const backKey  = docs.id_back ? (docKeys.id_back || await uploadDoc('id_back')) : null;
      const selfieKey = docKeys.selfie || await uploadDoc('selfie');

      const res = await fetch(`${BACKEND_URL}/api/verification/submit-worker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ idType, frontKey, backKey, selfieKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not submit verification.');
      setStep(STEPS.DONE);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-14">
      {step === STEPS.FORM && (
        <>
          <h1 className="font-display text-2xl font-bold text-ink mb-1">Create your account</h1>
          <p className="text-inkMuted text-sm mb-6">
            {role === 'worker'
              ? 'Register now — your profile will be ready before the app even launches.'
              : 'Join WiamApp to book trusted, verified workers.'}
          </p>

          <div className="flex rounded-lg border border-line p-1 mb-6 text-sm font-semibold">
            <button
              type="button" onClick={() => setRole('customer')}
              className={`flex-1 py-2 rounded-md ${role === 'customer' ? 'bg-gold text-navy' : 'text-inkMuted'}`}
            >
              I need a worker
            </button>
            <button
              type="button" onClick={() => setRole('worker')}
              className={`flex-1 py-2 rounded-md ${role === 'worker' ? 'bg-gold text-navy' : 'text-inkMuted'}`}
            >
              I am a worker
            </button>
          </div>

          {refCode && (
            <div className="text-xs bg-gold/10 border border-gold/25 text-ink rounded-lg px-3 py-2 mb-5">
              Referral code <strong>{refCode}</strong> will be applied to your account.
            </div>
          )}

          <form onSubmit={submitRegister} className="space-y-3">
            <input required placeholder="Full name" value={form.fullName} onChange={update('fullName')}
              className="w-full border border-line rounded-lg px-4 py-3 text-sm" />
            <input required type="email" placeholder="Email" value={form.email} onChange={update('email')}
              className="w-full border border-line rounded-lg px-4 py-3 text-sm" />
            <input required placeholder="Phone number" value={form.phone} onChange={update('phone')}
              className="w-full border border-line rounded-lg px-4 py-3 text-sm" />
            <input required type="password" placeholder="Password (min 8 characters)" value={form.password} onChange={update('password')}
              className="w-full border border-line rounded-lg px-4 py-3 text-sm" />

            <div className="flex gap-3">
              <input required placeholder="City" value={form.city} onChange={update('city')}
                className="flex-1 border border-line rounded-lg px-4 py-3 text-sm" />
              <select value={form.country} onChange={update('country')}
                className="border border-line rounded-lg px-3 py-3 text-sm">
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
              </select>
            </div>

            <input placeholder="How to find you (landmark / directions)" value={form.landmarkDescription}
              onChange={update('landmarkDescription')}
              className="w-full border border-line rounded-lg px-4 py-3 text-sm" />

            <input placeholder="Digital address code (optional — e.g. GA-183-9038)" value={form.digitalAddressCode}
              onChange={update('digitalAddressCode')}
              className="w-full border border-line rounded-lg px-4 py-3 text-sm" />

            <button type="button" onClick={useMyLocation} disabled={locating}
              className="w-full flex items-center justify-center gap-2 border border-gold/25 bg-gold/10 text-ink font-semibold text-sm px-4 py-3 rounded-lg disabled:opacity-60">
              {locating ? 'Getting your location…' : coords ? 'Location saved ✓' : '📍 Use my current location'}
            </button>

            {role === 'worker' && (
              <select required value={form.category} onChange={update('category')}
                className="w-full border border-line rounded-lg px-4 py-3 text-sm text-inkMuted">
                <option value="">Select your main service category</option>
                {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            )}

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full bg-gold text-navy font-semibold text-sm px-6 py-3.5 rounded-lg disabled:opacity-60">
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="text-xs text-inkMuted mt-5">
            By creating an account you agree to WiamApp's{' '}
            <Link href="/terms" className="text-gold">Terms</Link> and{' '}
            <Link href="/privacy" className="text-gold">Privacy Policy</Link>.
          </p>
        </>
      )}

      {step === STEPS.OTP && (
        <>
          <h1 className="font-display text-2xl font-bold text-ink mb-1">Check your email</h1>
          <p className="text-inkMuted text-sm mb-6">
            We sent a 6-digit code to <strong>{form.email}</strong>. Enter it below to verify your account.
          </p>
          <form onSubmit={submitOtp} className="space-y-3">
            <input required maxLength={6} placeholder="6-digit code" value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="w-full border border-line rounded-lg px-4 py-3 text-center text-lg tracking-[0.5em] font-semibold" />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-gold text-navy font-semibold text-sm px-6 py-3.5 rounded-lg disabled:opacity-60">
              {loading ? 'Verifying…' : 'Verify & continue'}
            </button>
            <button type="button" onClick={resendOtp} className="w-full text-xs text-inkMuted py-2">
              Didn't get a code? Resend
            </button>
          </form>
        </>
      )}

      {step === STEPS.PROFILE && (
        <>
          <h1 className="font-display text-2xl font-bold text-ink mb-1">Tell customers about yourself</h1>
          <p className="text-inkMuted text-sm mb-6">
            A short bio and your rate go straight onto your profile — you can change these anytime.
          </p>
          <form onSubmit={submitProfile} className="space-y-3">
            <textarea
              placeholder="e.g. 8 years experience as an electrician in Accra. Fast, reliable, and I clean up after every job."
              value={bio} onChange={(e) => setBio(e.target.value)} rows={4}
              className="w-full border border-line rounded-lg px-4 py-3 text-sm" />
            <div className="flex gap-3 items-center">
              <span className="text-sm text-inkMuted">GHS</span>
              <input required type="number" min="1" placeholder="Hourly rate" value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className="flex-1 border border-line rounded-lg px-4 py-3 text-sm" />
              <span className="text-sm text-inkMuted">/ hour</span>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-gold text-navy font-semibold text-sm px-6 py-3.5 rounded-lg disabled:opacity-60">
              {loading ? 'Saving…' : 'Continue'}
            </button>
            <button type="button" onClick={() => setStep(STEPS.DOCS)} className="w-full text-xs text-inkMuted py-2">
              Skip for now
            </button>
          </form>
        </>
      )}

      {step === STEPS.DOCS && (
        <>
          <h1 className="font-display text-2xl font-bold text-ink mb-1">Verify your identity</h1>
          <p className="text-inkMuted text-sm mb-6">
            This is what earns your verified badge — customers trust verified workers far more.
            Takes two minutes, right from your phone's camera.
          </p>
          <form onSubmit={submitDocs} className="space-y-4">
            <select value={idType} onChange={(e) => setIdType(e.target.value)}
              className="w-full border border-line rounded-lg px-4 py-3 text-sm">
              {ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>

            <DocPicker label="ID front photo" required file={docs.id_front} uploading={docUploading === 'id_front'}
              onChange={pickDoc('id_front')} capture="environment" />
            <DocPicker label="ID back photo (optional)" file={docs.id_back} uploading={docUploading === 'id_back'}
              onChange={pickDoc('id_back')} capture="environment" />
            <DocPicker label="Selfie (face clearly visible)" required file={docs.selfie} uploading={docUploading === 'selfie'}
              onChange={pickDoc('selfie')} capture="user" />

            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-gold text-navy font-semibold text-sm px-6 py-3.5 rounded-lg disabled:opacity-60">
              {loading ? 'Submitting…' : 'Submit for verification'}
            </button>
            <button type="button" onClick={() => setStep(STEPS.DONE)} className="w-full text-xs text-inkMuted py-2">
              Skip for now — I'll verify later in the app
            </button>
          </form>
        </>
      )}

      {step === STEPS.DONE && (
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-gold/15 flex items-center justify-center mx-auto mb-4 text-2xl">✓</div>
          <h1 className="font-display text-2xl font-bold text-ink mb-2">You're in</h1>
          <p className="text-inkMuted text-sm mb-1">
            {role === 'worker'
              ? (docKeys.selfie
                  ? "Your profile and ID verification are submitted. We'll email you within 24 hours once it's reviewed — then just download the app and log in with this same email and password."
                  : "Your worker account is created. Come back anytime to finish your bio, rate, and ID verification — or do it straight from the mobile app once you download it.")
              : 'Your account is ready. Download the app to start booking trusted, verified workers.'}
          </p>
          {referralApplied === true && (
            <p className="text-xs text-gold mt-3">Referral code applied — reward is on its way once qualified.</p>
          )}
          <p className="text-xs text-inkMuted mt-6">
            Use the same email and password to log in once the app is available on your device.
          </p>
        </div>
      )}
    </div>
  );
}

function DocPicker({ label, file, uploading, onChange, capture, required }) {
  return (
    <label className="block border border-line rounded-lg px-4 py-3 text-sm cursor-pointer">
      <div className="flex items-center justify-between">
        <span className="text-ink">{label}{required && <span className="text-red-600"> *</span>}</span>
        {uploading
          ? <span className="text-xs text-inkMuted">Uploading…</span>
          : file
            ? <span className="text-xs text-gold font-semibold">✓ Selected</span>
            : <span className="text-xs text-inkMuted">Tap to choose</span>}
      </div>
      <input
        type="file" accept="image/*" capture={capture}
        onChange={onChange} className="hidden"
      />
    </label>
  );
}
