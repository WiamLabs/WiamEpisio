'use client';
// © 2026 WiamApp. Powered by WiamLabs
// components/SpotlightManager.js

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { uploadImage } from '@/lib/cloudinary';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

const STATUS_STYLE = {
  pending_review: 'bg-amberTint text-amber',
  approved: 'bg-greenTint text-green',
  rejected: 'bg-redTint text-red',
};
const STATUS_LABEL = {
  pending_review: 'Pending review',
  approved: 'Live',
  rejected: 'Rejected',
};

export default function SpotlightManager({ initialPosts }) {
  const supabase = createClient();
  const [posts, setPosts] = useState(initialPosts);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('A description is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();

      let mediaUrls = [];
      if (file) {
        setStage('Uploading photo...');
        const url = await uploadImage(file, 'spotlight');
        mediaUrls = [url];
      }

      setStage('Submitting post...');
      const res = await fetch(`${BACKEND_URL}/api/spotlight`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ title, description, mediaUrls, postType: 'portfolio' }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Could not submit post.');

      setPosts(prev => [{ ...json.data, status: 'pending_review' }, ...prev]);
      setShowForm(false);
      setTitle('');
      setDescription('');
      setFile(null);
      setPreview(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
      setStage('');
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-[21px] font-bold text-ink">Spotlight</h1>
          <p className="text-[13px] text-inkMuted mt-1">Show customers the work your team has done.</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-1.5 bg-gold text-navy font-semibold text-[13px] px-4 py-2.5 rounded-lg"
        >
          {showForm ? 'Cancel' : 'New post'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-line rounded-card p-5 mb-6 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">Title (optional)</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-sm outline-none focus:border-gold"
              placeholder="e.g. Lobby rewiring, completed in a day"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-sm outline-none focus:border-gold resize-none"
              placeholder="Tell customers about the work"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">Photo</label>
            {preview ? (
              <img src={preview} alt="" className="w-full h-40 object-cover rounded-lg" />
            ) : (
              <input type="file" accept="image/*" onChange={handleFileChange} className="text-sm" />
            )}
          </div>
          {error && <div className="text-[13px] text-red bg-redTint rounded-lg px-3 py-2.5">{error}</div>}
          <button
            type="submit"
            disabled={submitting}
            className="bg-gold text-navy font-semibold text-sm rounded-lg px-5 py-2.5 disabled:opacity-60"
          >
            {submitting ? (stage || 'Submitting...') : 'Submit for review'}
          </button>
          <p className="text-[11.5px] text-inkMuted">
            New posts are reviewed by our team before they go live — usually within a few hours.
          </p>
        </form>
      )}

      {posts.length === 0 ? (
        <div className="bg-white border border-line rounded-card py-14 text-center">
          <p className="text-[13px] text-inkMuted">No Spotlight posts yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3.5">
          {posts.map((post) => (
            <div key={post.id} className="border border-line rounded-card overflow-hidden bg-white">
              <div className="h-[110px] bg-gradient-to-br from-navySoft to-navy flex items-center justify-center">
                {post.media_urls?.[0] ? (
                  <img src={post.media_urls[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-7 h-7 text-white/25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>
                )}
              </div>
              <div className="p-3.5">
                <div className="text-[12.5px] font-semibold mb-1 line-clamp-1">{post.title || post.description}</div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-inkMuted">{post.views_count || 0} views</span>
                  <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded ${STATUS_STYLE[post.status] || 'bg-line text-inkMuted'}`}>
                    {STATUS_LABEL[post.status] || post.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
