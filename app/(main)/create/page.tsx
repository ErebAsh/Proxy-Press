'use client';

import { useState, useRef } from 'react';
import { categories } from '@/lib/data';
import type { Category } from '@/lib/data';

const categoryEmojis: Record<string, string> = {
  Events: '🎉', Notices: '📢', Sports: '⚽',
  Academic: '📚', Clubs: '🎭', Exams: '📝',
};

export default function CreatePostPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [dragging, setDragging] = useState(false);
  const [imageFile, setImageFile] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setImageFile(url);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImageFile(url);
    }
  };

  const handlePublish = () => {
    if (!title || !description || !category) return;
    setPublishing(true);
    setTimeout(() => {
      setPublishing(false);
      setPublished(true);
    }, 1600);
  };

  const isValid = title.trim() && description.trim() && category;

  if (published) {
    return (
      <div className="feed-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', animation: 'fade-in-up 0.5s ease' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🎉</div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Post Published!
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
            Your post is now live on the campus feed.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => { setPublished(false); setTitle(''); setDescription(''); setCategory(''); setImageFile(null); }}>
              ✍️ Write Another
            </button>
            <a href="/" className="btn btn-ghost">🏠 Back to Feed</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="feed-container animate-fade-in"
      style={{ maxWidth: '960px' }}
      id="create-post-page"
    >
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
          Create Post
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '2px' }}>
          Share news, events, or updates with your campus
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* ── LEFT: Form ── */}
        <div className="card" style={{ padding: '28px', height: 'fit-content' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '24px' }}>
            📝 Post Details
          </h2>

          {/* Image upload */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              Cover Image
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
              id="image-file-input"
            />
            <div
              className={`upload-zone ${dragging ? 'dragging' : ''}`}
              id="image-drop-zone"
              style={{ padding: imageFile ? '0' : undefined, overflow: 'hidden' }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              {imageFile ? (
                <div style={{ position: 'relative', width: '100%' }}>
                  <img src={imageFile} alt="Preview" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                  <button
                    onClick={e => { e.stopPropagation(); setImageFile(null); }}
                    style={{
                      position: 'absolute', top: '8px', right: '8px',
                      background: 'rgba(0,0,0,0.6)', color: '#fff',
                      border: 'none', borderRadius: '50%', width: '28px', height: '28px',
                      cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '36px' }}>🖼️</div>
                  <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)' }}>
                    {dragging ? 'Drop it here!' : 'Drag & drop or click to upload'}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>PNG, JPG, WebP up to 10MB</p>
                </>
              )}
            </div>
          </div>

          {/* Title */}
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="post-title" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              Title <span style={{ color: 'var(--accent)' }}>*</span>
            </label>
            <input
              id="post-title"
              className="input-field"
              type="text"
              placeholder="Enter a compelling headline..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={120}
            />
            <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-subtle)', marginTop: '4px' }}>
              {title.length}/120
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="post-description" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              Description <span style={{ color: 'var(--accent)' }}>*</span>
            </label>
            <textarea
              id="post-description"
              className="textarea-field"
              placeholder="Write a short summary of your post..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              maxLength={400}
            />
            <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-subtle)', marginTop: '4px' }}>
              {description.length}/400
            </div>
          </div>

          {/* Category */}
          <div style={{ marginBottom: '28px' }}>
            <label htmlFor="post-category" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              Category <span style={{ color: 'var(--accent)' }}>*</span>
            </label>
            <select
              id="post-category"
              className="select-field"
              value={category}
              onChange={e => setCategory(e.target.value as Category)}
            >
              <option value="">Select a category...</option>
              {categories.map(cat => (
                <option key={cat.name} value={cat.name}>
                  {cat.emoji} {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Submit */}
          <button
            id="publish-btn"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '15px', opacity: isValid ? 1 : 0.5, cursor: isValid ? 'pointer' : 'not-allowed' }}
            onClick={handlePublish}
            disabled={!isValid || publishing}
          >
            {publishing ? (
              <><div className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> Publishing...</>
            ) : (
              <>🚀 Publish Post</>
            )}
          </button>
          {!isValid && (
            <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-subtle)', marginTop: '8px' }}>
              Fill in title, description and category to publish
            </p>
          )}
        </div>

        {/* ── RIGHT: Live Preview ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              👁️ Live Preview
            </h2>
            <span style={{ fontSize: '11px', background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '99px', fontWeight: 600 }}>
              Real-time
            </span>
          </div>

          <div className="post-card" style={{ pointerEvents: 'none', userSelect: 'none' }}>
            {/* Card header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 16px 0' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary), #8B5CF6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
              }}>👤</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>Alex Johnson</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>MIT Campus Press · just now</div>
              </div>
              {category && (
                <span style={{
                  padding: '3px 10px', borderRadius: 'var(--radius-full)',
                  fontSize: '11px', fontWeight: 700,
                  background: 'var(--primary-light)', color: 'var(--primary)',
                }}>
                  {categoryEmojis[category]} {category}
                </span>
              )}
            </div>

            {/* Image */}
            {imageFile ? (
              <img src={imageFile} alt="Preview" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', marginTop: '14px' }} />
            ) : (
              <div style={{
                width: '100%', aspectRatio: '16/9', marginTop: '14px',
                background: 'linear-gradient(135deg, var(--surface-2) 0%, var(--border) 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: '8px',
              }}>
                <div style={{ fontSize: '32px', opacity: 0.4 }}>🖼️</div>
                <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>Cover image preview</span>
              </div>
            )}

            {/* Content */}
            <div style={{ padding: '16px' }}>
              <h2 style={{ fontWeight: 700, fontSize: '18px', lineHeight: 1.35, color: title ? 'var(--text-primary)' : 'var(--text-subtle)', marginBottom: '8px', minHeight: '24px' }}>
                {title || 'Your headline will appear here...'}
              </h2>
              <p style={{ fontSize: '14px', color: description ? 'var(--text-muted)' : 'var(--text-subtle)', lineHeight: 1.6, minHeight: '40px' }}>
                {description || 'Your description will appear here...'}
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', padding: '12px 16px', borderTop: '1px solid var(--border)', gap: '4px' }}>
              {['❤️ 0', '💬 0', '↗ Share'].map(label => (
                <button key={label} className="action-btn" style={{ cursor: 'default' }}>{label}</button>
              ))}
              <div style={{ flex: 1 }} />
              <button className="action-btn" style={{ cursor: 'default' }}>🔖</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
