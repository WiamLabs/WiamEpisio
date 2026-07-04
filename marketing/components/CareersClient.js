'use client';
// © 2026 WiamApp. Powered by WiamLabs
// components/CareersClient.js — expandable position cards with
// inline application form. One component per position, so the
// form and position data are always in sync.

import { useState } from 'react';

export default function CareersClient({ position, backendUrl }) {
  const [expanded, setExpanded] = useState(false);
  const [applying, setApplying] = useState(false);

  const [fullName, setFullName]         = useState('');
  const [email, setEmail]               = useState('');
  const [phone, setPhone]               = useState('');
  const [city, setCity]                 = useState('');
  const [yearsExp, setYearsExp]         = useState('');
  const [skills, setSkills]             = useState('');
  const [prevRoles, setPrevRoles]       = useState('');
  const [whyWiam, setWhyWiam]           = useState('');
  const [whatBring, setWhatBring]       = useState('');
  const [availability, setAvailability] = useState('');
  const [linkedin, setLinkedin]         = useState('');
  const [cvFile, setCvFile]             = useState(null);

  const [submitting, setSubmitting]     = useState(false);
  const [stage, setStage]               = useState('');
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName || !email || !phone) {
      setError('Full name, email, and phone are required.');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      let cvUploadUrl = null;

      if (cvFile) {
        setStage('Uploading CV...');
        const formData = new FormData();
        formData.append('file', cvFile);
        formData.append('email', email);

        const cvRes = await fetch(`${backendUrl}/api/uploads/cv`, {
          method: 'POST',
          body: formData,
        });
        const cvJson = await cvRes.json();
        if (!cvRes.ok) throw new Error(cvJson.error || 'CV upload failed.');
        cvUploadUrl = cvJson.key;
      }

      setStage('Submitting application...');
      const res = await fetch(`${backendUrl}/api/careers/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positionId:      position.position_key,
          positionTitle:   position.title,
          fullName, email, phone, city,
          yearsExperience: yearsExp,
          relevantSkills:  skills,
          previousRoles:   prevRoles,
          whyWiamapp:      whyWiam,
          whatTheyBring:   whatBring,
          availability,
          linkedinUrl:     linkedin,
          cvUploadUrl,
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setSuccess(json.message);
      setApplying(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
      setStage('');
    }
  };

  return (
    <div className="border border-line rounded-card overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-paper"
      >
        <div>
          <div className="font-semibold text-[14.5px] text-ink">{position.title}</div>
          <div className="text-[12.5px] text-inkMuted mt-0.5">{position.location} · {position.employment_type}</div>
        </div>
        <svg
          className={`w-5 h-5 text-inkFaint flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-line">
          <div className="py-4">
            <h3 className="font-semibold text-[13px] mb-1.5">About the role</h3>
            <p className="text-[13px] text-inkMuted leading-relaxed">{position.description}</p>
          </div>

          {position.requirements && (
            <div className="pb-4">
              <h3 className="font-semibold text-[13px] mb-1.5">What we're looking for</h3>
              <p className="text-[13px] text-inkMuted leading-relaxed">{position.requirements}</p>
            </div>
          )}

          {success ? (
            <div className="bg-greenTint border border-green/25 rounded-lg px-4 py-3 text-[13px] text-green font-medium">
              {success}
            </div>
          ) : applying ? (
            <form onSubmit={handleSubmit} className="border-t border-line pt-5 space-y-3">
              <h3 className="font-display font-bold text-[14px]">Apply for {position.title}</h3>

              {error && <div className="text-[13px] text-red bg-redTint rounded-lg px-3 py-2.5">{error}</div>}

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Full name *</label>
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-[13px] outline-none focus:border-gold" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Email *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-[13px] outline-none focus:border-gold" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Phone *</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-[13px] outline-none focus:border-gold" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">City</label>
                  <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Accra" className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-[13px] outline-none focus:border-gold" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Years of relevant experience</label>
                  <input type="number" value={yearsExp} onChange={(e) => setYearsExp(e.target.value)} min="0" className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-[13px] outline-none focus:border-gold" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Availability</label>
                  <select value={availability} onChange={(e) => setAvailability(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-[13px] outline-none focus:border-gold">
                    <option value="">Select...</option>
                    <option>Immediately</option>
                    <option>2 weeks notice</option>
                    <option>1 month notice</option>
                    <option>More than 1 month</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Relevant skills</label>
                <textarea value={skills} onChange={(e) => setSkills(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-[13px] outline-none focus:border-gold resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Previous roles</label>
                <textarea value={prevRoles} onChange={(e) => setPrevRoles(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-[13px] outline-none focus:border-gold resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Why WiamApp?</label>
                <textarea value={whyWiam} onChange={(e) => setWhyWiam(e.target.value)} rows={2} placeholder="What draws you to this role specifically?" className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-[13px] outline-none focus:border-gold resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">What would you bring?</label>
                <textarea value={whatBring} onChange={(e) => setWhatBring(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-[13px] outline-none focus:border-gold resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">LinkedIn profile URL</label>
                <input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/..." className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-[13px] outline-none focus:border-gold" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">CV / Resume (PDF or Word, max 10MB)</label>
                <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setCvFile(e.target.files?.[0] || null)} className="text-[13px] w-full" />
              </div>

              <div className="flex gap-2.5 pt-1">
                <button type="submit" disabled={submitting} className="bg-navy text-white font-semibold text-[13px] px-5 py-2.5 rounded-lg disabled:opacity-60">
                  {submitting ? (stage || 'Submitting...') : 'Submit application'}
                </button>
                <button type="button" onClick={() => { setApplying(false); setError(''); }} className="border border-line text-ink font-semibold text-[13px] px-5 py-2.5 rounded-lg">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setApplying(true)}
              className="bg-gold text-navy font-semibold text-[13px] px-5 py-2.5 rounded-lg"
            >
              Apply for this role
            </button>
          )}
        </div>
      )}
    </div>
  );
}
