'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { completeOnboarding, checkUsernameAvailability, uploadMedia, getCurrentUser } from '@/lib/actions';
import { compressImage } from '@/lib/image-utils';
import './onboarding.css';

const COUNTRY_CODES = [
  { code: '+91', label: '🇮🇳 +91', country: 'India' },
  { code: '+1', label: '🇺🇸 +1', country: 'US' },
  { code: '+44', label: '🇬🇧 +44', country: 'UK' },
  { code: '+61', label: '🇦🇺 +61', country: 'AU' },
  { code: '+86', label: '🇨🇳 +86', country: 'CN' },
  { code: '+81', label: '🇯🇵 +81', country: 'JP' },
  { code: '+49', label: '🇩🇪 +49', country: 'DE' },
  { code: '+33', label: '🇫🇷 +33', country: 'FR' },
  { code: '+971', label: '🇦🇪 +971', country: 'UAE' },
  { code: '+65', label: '🇸🇬 +65', country: 'SG' },
  { code: '+82', label: '🇰🇷 +82', country: 'KR' },
  { code: '+55', label: '🇧🇷 +55', country: 'BR' },
  { code: '+7', label: '🇷🇺 +7', country: 'RU' },
  { code: '+39', label: '🇮🇹 +39', country: 'IT' },
  { code: '+34', label: '🇪🇸 +34', country: 'ES' },
];

type Step = 1 | 2 | 3;

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [email, setEmail] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 1 — Basic Information
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [college, setCollege] = useState('');

  // Step 2 — Contact Information
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Step 3 — Optional Information
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('');
  const [links, setLinks] = useState<string[]>(['']);

  // Field errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load current user data
  useEffect(() => {
    async function loadUser() {
      const user = await getCurrentUser();
      if (user) {
        setEmail(user.email || '');
        if (user.name && user.name !== 'New User') setName(user.name);
      }
    }
    loadUser();
  }, []);

  // Debounced username check
  const usernameCheckTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleUsernameChange = useCallback((value: string) => {
    // Sanitize: lowercase, no spaces, alphanumeric + underscore only
    const sanitized = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(sanitized);

    if (usernameCheckTimeout.current) clearTimeout(usernameCheckTimeout.current);

    if (sanitized.length < 3) {
      setUsernameStatus('idle');
      return;
    }

    setUsernameStatus('checking');
    usernameCheckTimeout.current = setTimeout(async () => {
      const result = await checkUsernameAvailability(sanitized);
      setUsernameStatus(result.available ? 'available' : 'taken');
    }, 500);
  }, []);

  // Validation
  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!name.trim()) newErrors.name = 'Full name is required';
      if (username.length < 3) newErrors.username = 'Username must be at least 3 characters';
      if (usernameStatus === 'taken') newErrors.username = 'This username is already taken';
      if (!dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
      if (!college.trim()) newErrors.college = 'College name is required';
    }

    if (step === 2) {
      if (!phoneNumber.trim()) newErrors.phone = 'Phone number is required';
      if (phoneNumber && !/^\d{6,15}$/.test(phoneNumber.replace(/\s/g, ''))) {
        newErrors.phone = 'Enter a valid phone number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    setCurrentStep((prev) => Math.min(prev + 1, 3) as Step);
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1) as Step);
    setErrors({});
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfilePictureFile(file);
      const url = URL.createObjectURL(file);
      setProfilePicture(url);
    }
  };

  const handleAddLink = () => {
    setLinks((prev) => [...prev, '']);
  };

  const handleRemoveLink = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLinkChange = (index: number, value: string) => {
    setLinks((prev) => prev.map((l, i) => (i === index ? value : l)));
  };

  const handleFinish = async () => {
    setIsSubmitting(true);

    try {
      // Upload profile picture if selected
      let pictureUrl: string | undefined;
      if (profilePictureFile) {
        // Compress before upload to stay under server limits and save bandwidth
        const compressedFile = await compressImage(profilePictureFile);
        const formData = new FormData();
        formData.append('file', compressedFile);
        formData.append('category', 'images');
        const uploadResult = await uploadMedia(formData);
        pictureUrl = uploadResult.url;
      }

      const filteredLinks = links.filter((l) => l.trim().length > 0);

      const result = await completeOnboarding({
        name,
        username,
        dateOfBirth,
        college,
        phone: `${countryCode} ${phoneNumber}`,
        bio: bio || undefined,
        gender: gender || undefined,
        links: filteredLinks.length > 0 ? filteredLinks : undefined,
        profilePicture: pictureUrl,
      });

      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 2000);
      } else {
        setErrors({ submit: result.error || 'Something went wrong' });
      }
    } catch (err) {
      setErrors({ submit: 'An unexpected error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Also allow finishing/skipping step 3 without filling optional fields
  const handleSkipAndFinish = async () => {
    // Clear optional fields and finish
    setBio('');
    setGender('');
    setLinks(['']);
    setProfilePicture(null);
    setProfilePictureFile(null);

    setIsSubmitting(true);
    try {
      const result = await completeOnboarding({
        name,
        username,
        dateOfBirth,
        college,
        phone: `${countryCode} ${phoneNumber}`,
      });

      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 2000);
      } else {
        setErrors({ submit: result.error || 'Something went wrong' });
      }
    } catch (err) {
      setErrors({ submit: 'An unexpected error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const progressPercent = showSuccess ? 100 : ((currentStep - 1) / 3) * 100 + (currentStep === 3 ? 33 : 0);

  // ─── Success Screen ───
  if (showSuccess) {
    return (
      <div className="onboarding-page">
        <div className="onboarding-container">
          <div className="onboarding-card">
            <div className="onboarding-success">
              <div className="success-check">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className="success-title">Welcome to Proxy-Press!</h2>
              <p className="success-message">
                Your profile is all set, <span className="success-handle">@{username}</span>. Redirecting you to your feed...
              </p>
              <div className="progress-bar-track" style={{ maxWidth: 200, margin: '0 auto' }}>
                <div className="progress-bar-fill" style={{ width: '100%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-container">
        {/* Progress Indicator */}
        <div className="onboarding-progress">
          <div className="progress-steps">
            {[1, 2, 3].map((step, i) => (
              <div key={step} className="progress-step">
                <div className={`step-dot ${currentStep === step ? 'active' : ''} ${currentStep > step ? 'completed' : ''}`}>
                  {currentStep > step ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    step
                  )}
                </div>
                {i < 2 && (
                  <div className={`step-connector ${currentStep > step + 1 ? 'filled' : ''} ${currentStep === step + 1 ? 'filling' : ''}`} />
                )}
              </div>
            ))}
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        {/* Card */}
        <div className="onboarding-card">
          {errors.submit && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #EF4444',
              color: '#EF4444',
              padding: '12px',
              borderRadius: '12px',
              fontSize: '14px',
              textAlign: 'center',
              marginBottom: '16px',
            }}>
              {errors.submit}
            </div>
          )}

          {/* ─── STEP 1: Basic Information ─── */}
          {currentStep === 1 && (
            <div className="step-content" key="step-1">
              <div className="step-header">
                <span className="step-emoji">👤</span>
                <h2 className="step-title">Basic Information</h2>
                <p className="step-subtitle">Let's get to know you — tell us the essentials</p>
              </div>

              <div className="onboarding-form">
                {/* Full Name */}
                <div className="ob-form-group">
                  <label className="ob-label" htmlFor="ob-name">Full Name</label>
                  <div className="ob-input-wrapper">
                    <span className="ob-input-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                      </svg>
                    </span>
                    <input
                      id="ob-name"
                      type="text"
                      className={`ob-input ${errors.name ? 'error' : ''}`}
                      value={name}
                      onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: '' })); }}
                      placeholder="John Doe"
                    />
                  </div>
                  {errors.name && <span className="ob-field-error">{errors.name}</span>}
                </div>

                {/* Username / Handle */}
                <div className="ob-form-group">
                  <label className="ob-label" htmlFor="ob-username">Username</label>
                  <div className="ob-input-wrapper">
                    <span className="ob-input-icon" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-subtle)' }}>@</span>
                    <input
                      id="ob-username"
                      type="text"
                      className={`ob-input ${errors.username ? 'error' : usernameStatus === 'available' ? 'success' : ''}`}
                      value={username}
                      onChange={(e) => { handleUsernameChange(e.target.value); setErrors((p) => ({ ...p, username: '' })); }}
                      placeholder="campusking"
                    />
                    {usernameStatus !== 'idle' && (
                      <span className={`ob-input-status ${usernameStatus}`}>
                        {usernameStatus === 'checking' && '⏳'}
                        {usernameStatus === 'available' && '✓ Available'}
                        {usernameStatus === 'taken' && '✗ Taken'}
                      </span>
                    )}
                  </div>
                  {errors.username && <span className="ob-field-error">{errors.username}</span>}
                </div>

                {/* Date of Birth */}
                <div className="ob-form-group">
                  <label className="ob-label" htmlFor="ob-dob">Date of Birth</label>
                  <div className="ob-input-wrapper">
                    <span className="ob-input-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </span>
                    <input
                      id="ob-dob"
                      type="date"
                      className={`ob-input ${errors.dateOfBirth ? 'error' : ''}`}
                      value={dateOfBirth}
                      onChange={(e) => { setDateOfBirth(e.target.value); setErrors((p) => ({ ...p, dateOfBirth: '' })); }}
                    />
                  </div>
                  {errors.dateOfBirth && <span className="ob-field-error">{errors.dateOfBirth}</span>}
                </div>

                {/* College Name */}
                <div className="ob-form-group">
                  <label className="ob-label" htmlFor="ob-college">College Name</label>
                  <div className="ob-input-wrapper">
                    <span className="ob-input-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 10L12 5L2 10l10 5l10-5z" /><path d="M6 12v5c3.33 3 9.33 3 12 0v-5" />
                      </svg>
                    </span>
                    <input
                      id="ob-college"
                      type="text"
                      className={`ob-input ${errors.college ? 'error' : ''}`}
                      value={college}
                      onChange={(e) => { setCollege(e.target.value); setErrors((p) => ({ ...p, college: '' })); }}
                      placeholder="MIT"
                    />
                  </div>
                  {errors.college && <span className="ob-field-error">{errors.college}</span>}
                </div>

                <div className="onboarding-actions">
                  <button
                    type="button"
                    className="ob-btn-next"
                    onClick={handleNext}
                  >
                    Continue →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP 2: Contact Information ─── */}
          {currentStep === 2 && (
            <div className="step-content" key="step-2">
              <div className="step-header">
                <span className="step-emoji">📱</span>
                <h2 className="step-title">Contact Information</h2>
                <p className="step-subtitle">How can people reach you?</p>
              </div>

              <div className="onboarding-form">
                {/* Email (read-only) */}
                <div className="ob-form-group">
                  <label className="ob-label" htmlFor="ob-email">Email Address</label>
                  <div className="ob-input-wrapper">
                    <span className="ob-input-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                      </svg>
                    </span>
                    <input
                      id="ob-email"
                      type="email"
                      className="ob-input"
                      value={email}
                      readOnly
                    />
                  </div>
                </div>

                {/* Phone Number with Country Code */}
                <div className="ob-form-group">
                  <label className="ob-label" htmlFor="ob-phone">Phone Number</label>
                  <div className="phone-input-group">
                    <select
                      className="country-code-select"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                    >
                      {COUNTRY_CODES.map((cc) => (
                        <option key={cc.code} value={cc.code}>
                          {cc.label}
                        </option>
                      ))}
                    </select>
                    <input
                      id="ob-phone"
                      type="tel"
                      className={`phone-number-input ${errors.phone ? 'error' : ''}`}
                      value={phoneNumber}
                      onChange={(e) => { setPhoneNumber(e.target.value.replace(/[^0-9\s]/g, '')); setErrors((p) => ({ ...p, phone: '' })); }}
                      placeholder="98765 43210"
                    />
                  </div>
                  {errors.phone && <span className="ob-field-error">{errors.phone}</span>}
                </div>

                <div className="onboarding-actions">
                  <button type="button" className="ob-btn-back" onClick={handleBack}>
                    ←
                  </button>
                  <button
                    type="button"
                    className="ob-btn-next"
                    onClick={handleNext}
                  >
                    Continue →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP 3: Optional Information ─── */}
          {currentStep === 3 && (
            <div className="step-content" key="step-3">
              <div className="step-header">
                <span className="step-emoji">✨</span>
                <h2 className="step-title">Make It Yours</h2>
                <p className="step-subtitle">Personalize your profile — you can always edit this later</p>
              </div>

              <div className="onboarding-form">
                {/* Profile Picture */}
                <div className="ob-form-group">
                  <label className="ob-label">Profile Picture</label>
                  <div className="ob-avatar-upload">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept="image/*"
                      style={{ display: 'none' }}
                    />
                    <div
                      className="ob-avatar-preview"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {profilePicture ? (
                        <img src={profilePicture} alt="Profile" />
                      ) : (
                        '👤'
                      )}
                      <div className="ob-avatar-overlay">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
                        </svg>
                      </div>
                    </div>
                    <span className="ob-avatar-label">Tap to upload</span>
                  </div>
                </div>

                {/* Bio */}
                <div className="ob-form-group">
                  <label className="ob-label" htmlFor="ob-bio">Bio</label>
                  <textarea
                    id="ob-bio"
                    className="ob-textarea"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell the campus about yourself..."
                    maxLength={160}
                    rows={3}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-subtle)', textAlign: 'right' }}>
                    {bio.length}/160
                  </span>
                </div>

                {/* Gender */}
                <div className="ob-form-group">
                  <label className="ob-label" htmlFor="ob-gender">Gender</label>
                  <select
                    id="ob-gender"
                    className="ob-select"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <option value="">Prefer not to say</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non-binary">Non-binary</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Social Links */}
                <div className="ob-form-group">
                  <label className="ob-label">Social Links</label>
                  <div className="ob-links-list">
                    {links.map((link, i) => (
                      <div key={i} className="ob-link-row">
                        <input
                          type="url"
                          className="ob-link-input"
                          value={link}
                          onChange={(e) => handleLinkChange(i, e.target.value)}
                          placeholder="https://..."
                        />
                        {links.length > 1 && (
                          <button
                            type="button"
                            className="ob-link-remove"
                            onClick={() => handleRemoveLink(i)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                    {links.length < 5 && (
                      <button type="button" className="ob-add-link-btn" onClick={handleAddLink}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add Link
                      </button>
                    )}
                  </div>
                </div>

                <div className="onboarding-actions">
                  <button type="button" className="ob-btn-back" onClick={handleBack}>
                    ←
                  </button>
                  <button
                    type="button"
                    className="ob-btn-skip"
                    onClick={handleSkipAndFinish}
                    disabled={isSubmitting}
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    className="ob-btn-finish"
                    onClick={handleFinish}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Setting up...' : 'Finish ✓'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
