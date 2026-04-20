'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, uploadMedia } from '@/lib/actions';
import { compressImage } from '@/lib/image-utils';
import ImageAdjustModal from '@/app/components/Profile/ImageAdjustModal';
import './edit-profile.css';

export default function EditProfilePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'personal'>('profile');
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    bio: '',
    college: '',
    branch: '',
    department: '',
    contactInfo: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    links: [''],
  });

  // Handle top spacing
  useEffect(() => {
    const main = document.getElementById('main-content');
    if (main) {
      main.classList.add('no-top-padding');
      return () => main.classList.remove('no-top-padding');
    }
  }, []);

  // Load user data
  useEffect(() => {
    async function loadUser() {
      const user = await getCurrentUser();
      if (user) {
        let parsedLinks: string[] = [''];
        try {
          if (user.links) {
            parsedLinks = JSON.parse(user.links);
            if (parsedLinks.length === 0) parsedLinks = [''];
          }
        } catch (e) {
          parsedLinks = [''];
        }

        setFormData({
          name: user.name || '',
          username: user.username || '',
          email: user.email || '',
          bio: user.bio || '',
          college: user.college || '',
          branch: user.branch || '',
          department: user.department || '',
          contactInfo: user.contactInfo || '',
          phone: user.phone || '',
          dateOfBirth: user.dateOfBirth || '',
          gender: user.gender || '',
          links: parsedLinks,
        });
        if (user.profilePicture) {
          setSelectedAvatar(user.profilePicture);
        }
      }
      setIsLoading(false);
    }
    loadUser();
  }, []);

  // Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Avatar State
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [avatarPosition, setAvatarPosition] = useState({ x: 50, y: 50 });
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const imageUrl = URL.createObjectURL(file);
      setPendingAvatar(imageUrl);
      setShowAdjustModal(true);
    }
  };

  const handleAdjustmentSave = (position: { x: number, y: number }) => {
    setAvatarPosition(position);
    setSelectedAvatar(pendingAvatar);
    setShowAdjustModal(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLinkChange = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      links: prev.links.map((l, i) => i === index ? value : l),
    }));
  };

  const handleAddLink = () => {
    if (formData.links.length < 5) {
      setFormData(prev => ({ ...prev, links: [...prev.links, ''] }));
    }
  };

  const handleRemoveLink = (index: number) => {
    setFormData(prev => ({
      ...prev,
      links: prev.links.filter((_, i) => i !== index),
    }));
  };

  const handleSaveClick = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirmModal(true);
  };

  const confirmSave = async () => {
    setIsSaving(true);
    try {
      // Upload avatar if changed
      let profilePictureUrl = selectedAvatar;
      if (avatarFile) {
        // Compress before upload to stay under server limits and save bandwidth
        const compressedFile = await compressImage(avatarFile);
        const fd = new FormData();
        fd.append('file', compressedFile);
        fd.append('category', 'images');
        const uploadResult = await uploadMedia(fd);
        profilePictureUrl = uploadResult.url;
      }

      // Import and call the action to update profile
      const { completeOnboarding } = await import('@/lib/actions');
      
      // We'll reuse completeOnboarding to update the user fields
      const filteredLinks = formData.links.filter(l => l.trim().length > 0);
      
      const result = await completeOnboarding({
        name: formData.name,
        username: formData.username,
        dateOfBirth: formData.dateOfBirth,
        college: formData.college,
        branch: formData.branch,
        department: formData.department,
        phone: formData.phone,
        bio: formData.bio || undefined,
        gender: formData.gender || undefined,
        links: filteredLinks.length > 0 ? filteredLinks : undefined,
        profilePicture: profilePictureUrl || undefined,
      });

      if (result.success) {
        setIsSuccess(true);
        setTimeout(() => {
          setShowConfirmModal(false);
          router.push('/profile');
          router.refresh();
        }, 1500);
      }
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="edit-profile-container design-ref">
        <div className="ref-header">
          <button onClick={() => router.push('/profile')} className="ref-back-btn">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <h1 className="ref-title">Edit Profile</h1>
          <div style={{ width: 40 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="edit-profile-container design-ref">
      <div className="ref-header">
        <button onClick={() => router.push('/profile')} className="ref-back-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 className="ref-title">Edit Profile</h1>
        <button className="ref-more-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
          </svg>
        </button>
      </div>

      <div className="ref-content">
        {/* Avatar Section */}
        <div className="ref-avatar-section">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            style={{ display: 'none' }}
          />
          <div className="ref-avatar-wrapper" onClick={handleAvatarClick} style={{ cursor: 'pointer' }}>
            <div className="ref-avatar-main" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {selectedAvatar ? (
                <img 
                  src={selectedAvatar} 
                  alt="Avatar preview" 
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover',
                    objectPosition: `${avatarPosition.x}% ${avatarPosition.y}%` 
                  }} 
                />
              ) : (
                '👤'
              )}
            </div>
            <div className="ref-camera-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="ref-tabs-container">
          <div className={`ref-tab-indicator ${activeTab}`} />
          <button 
            className={`ref-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            Profile
          </button>
          <button 
            className={`ref-tab-btn ${activeTab === 'personal' ? 'active' : ''}`}
            onClick={() => setActiveTab('personal')}
          >
            Private
          </button>
        </div>

        {/* Form Sections */}
        <div className="ref-form">
          {activeTab === 'profile' ? (
            <div className="animate-fade-in-quick">
              {/* Section 1: Identity */}
              <h2 className="ref-section-label">Identity</h2>
              
              <div className="ref-input-container">
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="ref-input"
                  placeholder="Full Name"
                />
                {formData.name && (
                  <div className="ref-input-icon success">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                )}
              </div>

              <div className="ref-input-container">
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={(e) => {
                    const sanitized = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                    setFormData(prev => ({ ...prev, username: sanitized }));
                  }}
                  className="ref-input"
                  placeholder="username"
                  style={{ paddingLeft: '42px' }}
                />
                <div className="ref-input-icon" style={{ left: '16px', right: 'auto', fontSize: '18px', fontWeight: 800, color: 'var(--text-muted)', opacity: 0.8 }}>@</div>
              </div>

              <div className="ref-input-container">
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  className="ref-textarea"
                  placeholder="Tell us about yourself (Bio)"
                  rows={2}
                  maxLength={160}
                />
              </div>

              {/* Section 2: Education */}
              <h2 className="ref-section-label">Education</h2>

              <div className="ref-input-container">
                <input
                  type="text"
                  name="college"
                  value={formData.college}
                  onChange={handleInputChange}
                  className="ref-input"
                  placeholder="University / College"
                />
              </div>

              <div className="ref-input-row">
                <div className="ref-input-container half">
                  <input
                    type="text"
                    name="branch"
                    value={formData.branch}
                    onChange={handleInputChange}
                    className="ref-input"
                    placeholder="Branch (Optional)"
                  />
                </div>
                <div className="ref-input-container half">
                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="ref-input"
                    placeholder="Department (Optional)"
                  />
                </div>
              </div>

              {/* Section 3: Social Presence */}
              <h2 className="ref-section-label">Socials</h2>

              {formData.links.map((link, i) => (
                <div key={i} className="ref-input-row" style={{ gap: '8px' }}>
                  <div className="ref-input-container" style={{ flex: 1 }}>
                    <input
                      type="url"
                      value={link}
                      onChange={(e) => handleLinkChange(i, e.target.value)}
                      className="ref-input"
                      placeholder="https://..."
                    />
                  </div>
                  {formData.links.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLink(i)}
                      style={{
                        width: 42, height: 42, borderRadius: 12,
                        background: 'rgba(239,68,68,0.1)', border: 'none',
                        color: '#EF4444', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              {formData.links.length < 5 && (
                <button
                  type="button"
                  onClick={handleAddLink}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '10px', border: '1.5px dashed var(--border)', borderRadius: 12,
                    background: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  + Add Social Link
                </button>
              )}
            </div>
          ) : (
            <div className="animate-fade-in-quick">
              {/* Section 4: Personal Details */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '20px', marginBottom: '8px' }}>
                <h2 className="ref-section-label" style={{ margin: 0 }}>Private Info</h2>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>

              <div className="ref-input-row">
                <div className="ref-input-container half">
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    className="ref-input"
                    style={{ appearance: 'none' }}
                  >
                    <option value="">Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non-binary">Non-binary</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="ref-input-container half">
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    className="ref-input"
                  />
                </div>
              </div>

              <div className="ref-input-container">
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="ref-input"
                  placeholder="Phone (e.g. +91 98765 43210)"
                />
              </div>

              <div className="ref-input-container">
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  readOnly
                  className="ref-input"
                  placeholder="Email"
                  style={{ opacity: 0.6 }}
                />
              </div>
              
              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.1)', marginTop: '12px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  <strong>🔒 Private Information:</strong> This data is only visible to you and used for account management.
                </p>
              </div>
            </div>
          )}

          <button onClick={handleSaveClick} className="ref-save-btn">
            Save Profile
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            {!isSuccess ? (
              <>
                <div className="modal-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </div>
                <h2 className="modal-title">Confirm Changes</h2>
                <p className="modal-text">Are you sure you want to update your profile information? This action will be reflected across its items. </p>
                <div className="modal-buttons">
                  <button onClick={() => setShowConfirmModal(false)} className="close-btn" disabled={isSaving}>
                    Not yet
                  </button>
                  <button onClick={confirmSave} className="confirm-btn" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Yes, Update'}
                  </button>
                </div>
              </>
            ) : (
              <div className="success-state">
                <div className="success-checkmark">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <h2 className="modal-title">Success!</h2>
                <p className="modal-text">Your profile has been updated successfully.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Adjust Modal */}
      {showAdjustModal && pendingAvatar && (
        <ImageAdjustModal
          imageUrl={pendingAvatar}
          onSave={handleAdjustmentSave}
          onClose={() => {
            setShowAdjustModal(false);
            setPendingAvatar(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
        />
      )}
    </div>
  );
}
