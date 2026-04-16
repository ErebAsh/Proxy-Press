'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { categories } from '@/lib/data';
import type { Category } from '@/lib/data';
import './create.css';

const categoryEmojis: Record<string, string> = {
  Events: '🎉', Notices: '📢', Sports: '⚽',
  Academic: '📚', Clubs: '🎭', Exams: '📝',
  News: '📰', "College Daily Update": '🗓️', Others: '✨',
};

export default function CreatePostPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [dragging, setDragging] = useState(false);
  const [imageFile, setImageFile] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isHoveringUpload, setIsHoveringUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const main = document.getElementById('main-content');
    if (main) {
      main.classList.add('no-header-page', 'extra-bottom-space');
      return () => main.classList.remove('no-header-page', 'extra-bottom-space');
    }
  }, []);

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

  const startCamera = async (mode: 'user' | 'environment' = 'environment') => {
    // Stop any existing stream first
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: mode },
        audio: false 
      });
      setCameraStream(stream);
      setFacingMode(mode);
      setShowCamera(true);
      // Wait for next tick to ensure ref is bound
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 0);
    } catch (err) {
      alert('Camera access denied or not available');
      console.error('Camera error:', err);
    }
  };

  const toggleCamera = () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    startCamera(newMode);
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const takePhoto = () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setImageFile(dataUrl);
      stopCamera();
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

  /* ─────────── ACTIONS ─────────── */
  const handleBack = () => {
    router.push('/');
  };

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
    <div className="create-post-container" id="create-post-page">
      {/* Header */}
      <div className="create-post-header" style={{ textAlign: 'center' }}>
        <h1 className="create-post-title" style={{ 
          fontSize: '32px', 
          background: 'linear-gradient(to right, var(--text-primary), var(--primary))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '2px',
          justifyContent: 'center'
        }}>
          Create Post
        </h1>
        <p className="create-post-subtitle" style={{ fontSize: '14px', opacity: 0.7, fontWeight: 500 }}>
          Share your latest campus updates
        </p>
        <div style={{ 
          height: '1px', width: '100%', 
          background: 'linear-gradient(to right, transparent, var(--border), transparent)',
          marginTop: '20px' 
        }} />
      </div>

      <div className="create-post-layout">
        {/* ── LEFT: Form ── */}
        <div className="card" style={{ padding: '28px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📝 <span>Post Details</span>
          </h2>

            {/* Image upload */}
            <div style={{ marginBottom: '28px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
                onMouseEnter={() => setIsHoveringUpload(true)}
                onMouseLeave={() => setIsHoveringUpload(false)}
                style={{ 
                  position: 'relative',
                  padding: imageFile ? '0' : '40px 20px', 
                  overflow: 'hidden', 
                  minHeight: '220px',
                  borderRadius: '20px',
                  background: isHoveringUpload ? 'var(--surface-hover)' : 'var(--surface-2)',
                  border: dragging ? '2px solid var(--primary)' : '2px dashed var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  cursor: imageFile ? 'default' : 'pointer'
                }}
                onClick={() => !imageFile && fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                {imageFile ? (
                  <div style={{ position: 'relative', width: '100%', height: '100%', animation: 'fade-in 0.4s ease' }}>
                    <img src={imageFile} alt="Preview" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)', pointerEvents: 'none' }} />
                    <button
                      onClick={e => { e.stopPropagation(); setImageFile(null); }}
                      style={{
                        position: 'absolute', top: '16px', right: '16px',
                        background: 'rgba(255,255,255,0.9)', color: '#000',
                        border: 'none', borderRadius: '50%', width: '36px', height: '36px',
                        cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backdropFilter: 'blur(10px)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <div style={{ 
                      width: '64px', height: '64px', borderRadius: '18px', 
                      background: 'var(--primary-light)', color: 'var(--primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: '16px', fontSize: '28px',
                      boxShadow: '0 8px 16px rgba(37, 99, 235, 0.1)'
                    }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
                        <line x1="16" y1="5" x2="22" y2="5" />
                        <line x1="19" y1="2" x2="19" y2="8" />
                        <circle cx="9" cy="9" r="2" />
                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                      </svg>
                    </div>
                    <h3 style={{ fontWeight: 700, fontSize: '17px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {dragging ? 'Release to Drop' : 'Upload Cover Image'}
                    </h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                      Drag and drop or use the actions below
                    </p>
                    
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button 
                        className="camera-action-btn"
                        onClick={(e) => { e.stopPropagation(); startCamera(); }}
                        style={{
                          padding: '10px 20px', borderRadius: '14px', border: '1px solid var(--border)',
                          background: 'var(--surface)', color: 'var(--text-primary)',
                          display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 600,
                          cursor: 'pointer', transition: 'all 0.2s',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                          <circle cx="12" cy="13" r="4" />
                        </svg>
                        <span>Camera</span>
                      </button>
                      <button 
                        className="camera-action-btn"
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                        style={{
                          padding: '10px 20px', borderRadius: '14px', border: '1px solid var(--border)',
                          background: 'var(--surface)', color: 'var(--text-primary)',
                          display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 600,
                          cursor: 'pointer', transition: 'all 0.2s',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span>Files</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          {/* Title */}
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="post-title" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '10px' }}>
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
              style={{ fontSize: '16px' }}
            />
            <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--text-subtle)', marginTop: '6px' }}>
              {title.length}/120
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="post-description" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '10px' }}>
              Description <span style={{ color: 'var(--accent)' }}>*</span>
            </label>
            <textarea
              id="post-description"
              className="textarea-field"
              placeholder="Write a short summary of your post..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={5}
              maxLength={400}
              style={{ fontSize: '16px' }}
            />
            <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--text-subtle)', marginTop: '6px' }}>
              {description.length}/400
            </div>
          </div>

          {/* Category */}
          <div style={{ marginBottom: '32px' }}>
            <label htmlFor="post-category" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '10px' }}>
              Category <span style={{ color: 'var(--accent)' }}>*</span>
            </label>
            <select
              id="post-category"
              className="select-field"
              value={category}
              onChange={e => setCategory(e.target.value as Category)}
              style={{ fontSize: '16px' }}
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
            style={{ width: '100%', justifyContent: 'center', padding: '16px', fontSize: '16px', fontWeight: 700, opacity: isValid ? 1 : 0.6, cursor: isValid ? 'pointer' : 'not-allowed' }}
            onClick={handlePublish}
            disabled={!isValid || publishing}
          >
            {publishing ? (
              <><div className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)', width: '20px', height: '20px' }} /> Publishing...</>
            ) : (
              <>🚀 Publish Post</>
            )}
          </button>
          {!isValid && (
            <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-subtle)', marginTop: '12px' }}>
              Fill in all required fields to publish
            </p>
          )}
        </div>

        {/* ── RIGHT: Live Preview ── */}
        <div className="preview-sidebar">
          <div className="preview-header">
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              👁️ Live Preview
            </h2>
            <span className="preview-badge">Real-time</span>
          </div>

          <div className="post-card" style={{ pointerEvents: 'none', userSelect: 'none', margin: 0 }}>
            {/* Card header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 16px 0' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary), #8B5CF6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
                color: '#fff'
              }}>👤</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>Alex Johnson</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>MIT Campus Press · just now</div>
              </div>
              {category && (
                <span style={{
                  padding: '4px 12px', borderRadius: 'var(--radius-full)',
                  fontSize: '11px', fontWeight: 800, textTransform: 'uppercase',
                  background: 'var(--primary-light)', color: 'var(--primary)',
                  letterSpacing: '0.02em'
                }}>
                  {categoryEmojis[category]} {category}
                </span>
              )}
            </div>

            {/* Image */}
            <div style={{ marginTop: '14px', borderTop: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)' }}>
              {imageFile ? (
                <img src={imageFile} alt="Preview" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
              ) : (
                <div style={{
                  width: '100%', aspectRatio: '16/9',
                  background: 'linear-gradient(135deg, var(--surface-2) 0%, var(--border-light) 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column', gap: '10px',
                }}>
                  <div style={{ fontSize: '40px', opacity: 0.3 }}>🖼️</div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Cover image preview</span>
                </div>
              )}
            </div>

            {/* Content */}
            <div style={{ padding: '16px' }}>
              <h2 style={{ fontWeight: 800, fontSize: '20px', lineHeight: 1.3, color: title ? 'var(--text-primary)' : 'var(--text-subtle)', marginBottom: '10px', minHeight: '26px' }}>
                {title || 'Your headline will appear here...'}
              </h2>
              <p style={{ fontSize: '15px', color: description ? 'var(--text-muted)' : 'var(--text-subtle)', lineHeight: 1.6, minHeight: '48px' }}>
                {description || 'Your description will appear here...'}
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', padding: '12px 16px', borderTop: '1px solid var(--border)', gap: '6px' }}>
              <button className="action-btn" style={{ padding: '6px 10px' }}>❤️ 0</button>
              <button className="action-btn" style={{ padding: '6px 10px' }}>💬 0</button>
              <button className="action-btn" style={{ padding: '6px 10px' }}>↗ Share</button>
              <div style={{ flex: 1 }} />
              <button className="action-btn" style={{ padding: '6px 12px' }}>🔖</button>
            </div>
          </div>
        </div>
      </div>

      {/* Camera Modal Overlay */}
      {showCamera && (
        <div 
          className="camera-overlay"
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column',
            animation: 'fade-in 0.3s ease'
          }}
        >
          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            
            {/* Camera Frame UI */}
            <div style={{ 
              position: 'absolute', inset: 0, 
              background: 'radial-gradient(circle, transparent 40%, rgba(0,0,0,0.6) 100%)',
              pointerEvents: 'none'
            }} />
            
            <div style={{ 
              position: 'absolute', top: '24px', left: '24px', right: '24px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div style={{ 
                background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
                padding: '6px 14px', borderRadius: '20px', color: '#fff',
                fontSize: '12px', fontWeight: 600, letterSpacing: '0.05em'
              }}>
                LIVE · {facingMode === 'user' ? 'Front' : 'Back'}
              </div>
            </div>

            <div style={{ 
              position: 'absolute', bottom: '160px',
              width: '100%', textAlign: 'center', color: '#fff',
              fontSize: '13px', opacity: 0.8
            }}>
              Align post subject within the frame
            </div>
          </div>

          <div 
            style={{ 
              height: '180px', background: '#000', display: 'flex', 
              alignItems: 'center', justifyContent: 'space-around', padding: '0 40px',
              borderTop: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <button 
              className="btn" 
              onClick={stopCamera}
              style={{ 
                color: '#fff', background: 'rgba(255,255,255,0.1)', 
                width: '56px', height: '56px', borderRadius: '50%', 
                padding: 0, justifyContent: 'center'
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <button 
              onClick={takePhoto}
              style={{
                width: '84px', height: '84px', borderRadius: '50%',
                background: '#fff', border: '8px solid rgba(255,255,255,0.2)',
                padding: '0', cursor: 'pointer', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 20px rgba(0,0,0,0.3)'
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.85)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', border: '3px solid #000' }} />
            </button>

            <button 
              className="btn"
              onClick={toggleCamera}
              style={{ 
                color: '#fff', background: 'rgba(255,255,255,0.1)', 
                width: '56px', height: '56px', borderRadius: '50%', 
                padding: 0, justifyContent: 'center'
              }}
              title="Switch Camera"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
