'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { uploadMedia, createPost, updatePost, getPostById, getCurrentUser } from '@/lib/actions';
import { categories } from '@/lib/data';
import type { Category } from '@/lib/data';
import './create.css';

const categoryEmojis: Record<string, string> = {
  Events: '🎉', Notices: '📢', Sports: '⚽',
  Academic: '📚', Clubs: '🎭', Exams: '📝',
  News: '📰', "College Daily Update": '🗓️', Others: '✨',
};

export default function CreatePostClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const isEditing = !!editId;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [dragging, setDragging] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isHoveringUpload, setIsHoveringUpload] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraMode, setCameraMode] = useState<'photo' | 'video'>('photo');
  const [isCompressing, setIsCompressing] = useState(false);
  const [existingVideoUrl, setExistingVideoUrl] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const compressVideo = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.src = url;
      video.muted = true;
      video.playsInline = true;
      video.style.display = 'none';
      document.body.appendChild(video);
      
      video.onloadedmetadata = () => {
        try {
          const duration = video.duration || 1;
          const targetSizeBits = 9.5 * 1024 * 1024 * 8; // 9.5MB safety limit
          
          // Calculate required bitrate to fit in target size
          // Clamp between 500kbps (min) and 5Mbps (max)
          let calculatedBitRate = Math.floor(targetSizeBits / duration);
          calculatedBitRate = Math.max(500000, Math.min(5000000, calculatedBitRate));

          const stream = (video as any).captureStream();
          const recorder = new MediaRecorder(stream, { 
            mimeType: 'video/webm',
            videoBitsPerSecond: calculatedBitRate
          });
          
          const chunks: Blob[] = [];
          recorder.ondataavailable = (e) => chunks.push(e.data);
          recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            document.body.removeChild(video);
            URL.revokeObjectURL(url);
            resolve(blob);
          };
          
          recorder.start();
          video.play();
          
          video.onended = () => recorder.stop();
        } catch (err) {
          reject(err);
        }
      };

      video.onerror = (err) => reject(err);
    });
  };

  const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Scale down if too large (max 1920px)
        const MAX_SIZE = 1920;
        if (width > height && width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        } else if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas toBlob failed'));
            URL.revokeObjectURL(url);
          }, 'image/jpeg', 0.8); // 80% quality JPEG
        } else {
          reject(new Error('Failed to get canvas context'));
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = (err) => {
        reject(err);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    });
  };

  useEffect(() => {
    const main = document.getElementById('main-content');
    if (main) {
      main.classList.add('no-header-page', 'extra-bottom-space');
      return () => main.classList.remove('no-header-page', 'extra-bottom-space');
    }
  }, []);

  useEffect(() => {
    if (showCamera && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }

    // Hide global nav when camera is open
    if (showCamera) {
      document.body.classList.add('camera-active');
    } else {
      document.body.classList.remove('camera-active');
    }
    
    return () => {
      document.body.classList.remove('camera-active');
    };
  }, [showCamera, cameraStream]);

  useEffect(() => {
    async function loadUser() {
      const user = await getCurrentUser();
      if (user) setCurrentUserId(user.id);
    }
    loadUser();
  }, []);

  useEffect(() => {
    if (isEditing && editId) {
      const loadPostData = async () => {
        try {
          const postData = await getPostById(editId);
          if (postData) {
            setTitle(postData.title);
            setDescription(postData.description || postData.content);
            setCategory(postData.category as Category);
            setMediaUrl(postData.imageUrl);
            setExistingVideoUrl(postData.videoUrl);
            if (postData.videoUrl) {
              setMediaType('video');
            } else {
              setMediaType('image');
            }
          }
        } catch (err) {
          console.error('Failed to load post for editing:', err);
        }
      };
      loadPostData();
    }
  }, [isEditing, editId]);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      const isVideo = file.type.startsWith('video/');
      if (isVideo && file.size > 10 * 1024 * 1024) { // > 10MB
        setIsCompressing(true);
        try {
          const compressedBlob = await compressVideo(file);
          const url = URL.createObjectURL(compressedBlob);
          setMediaUrl(url);
          setMediaType('video');
          // Important: Create a new file so the input reference is still technically valid
          const compressedFile = new File([compressedBlob], "compressed-video.webm", { type: "video/webm" });
          const dT = new DataTransfer();
          dT.items.add(compressedFile);
          if (fileInputRef.current) fileInputRef.current.files = dT.files;
        } catch (err) {
          console.error('Compression failed', err);
          alert('Video is too large. Please select a smaller clip.');
        } finally {
          setIsCompressing(false);
        }
      } else {
        // Compress image if larger than 2MB to avoid Vercel 4.5MB payload limit
        if (file.type.startsWith('image/') && file.size > 2 * 1024 * 1024) {
          try {
            const compressedBlob = await compressImage(file);
            const url = URL.createObjectURL(compressedBlob);
            setMediaUrl(url);
            setMediaType('image');
            const compressedFile = new File([compressedBlob], "compressed-image.jpg", { type: "image/jpeg" });
            const dT = new DataTransfer();
            dT.items.add(compressedFile);
            if (fileInputRef.current) fileInputRef.current.files = dT.files;
          } catch (err) {
            console.error('Image compression failed', err);
            const url = URL.createObjectURL(file);
            setMediaUrl(url);
            setMediaType('image');
          }
        } else {
          const url = URL.createObjectURL(file);
          setMediaUrl(url);
          setMediaType('image');
        }
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isVideo = file.type.startsWith('video/');
      if (isVideo && file.size > 10 * 1024 * 1024) {
        setIsCompressing(true);
        try {
          const compressedBlob = await compressVideo(file);
          const url = URL.createObjectURL(compressedBlob);
          setMediaUrl(url);
          setMediaType('video');
          
          // Replace the file in the input with the compressed version
          const compressedFile = new File([compressedBlob], "compressed-video.webm", { type: "video/webm" });
          const dT = new DataTransfer();
          dT.items.add(compressedFile);
          if (fileInputRef.current) fileInputRef.current.files = dT.files;
        } catch (err) {
          console.error('Compression failed', err);
          alert('Video is too large. Please select a smaller clip.');
        } finally {
          setIsCompressing(false);
        }
      } else {
        // Compress image if larger than 2MB to avoid Vercel 4.5MB payload limit
        if (file.type.startsWith('image/') && file.size > 2 * 1024 * 1024) {
          try {
            const compressedBlob = await compressImage(file);
            const url = URL.createObjectURL(compressedBlob);
            setMediaUrl(url);
            setMediaType('image');
            const compressedFile = new File([compressedBlob], "compressed-image.jpg", { type: "image/jpeg" });
            const dT = new DataTransfer();
            dT.items.add(compressedFile);
            if (fileInputRef.current) fileInputRef.current.files = dT.files;
          } catch (err) {
            console.error('Image compression failed', err);
            const url = URL.createObjectURL(file);
            setMediaUrl(url);
            setMediaType('image');
          }
        } else {
          const url = URL.createObjectURL(file);
          setMediaUrl(url);
          setMediaType('image');
        }
      }
    }
  };

  const startCamera = async (mode: 'user' | 'environment' = 'environment') => {
    // Stop any existing stream first
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: mode,
          aspectRatio: { ideal: 0.5625 }, // 9:16
          width: { ideal: 1080 },
          height: { ideal: 1920 }
        },
        audio: true 
      });
      setCameraStream(stream);
      setFacingMode(mode);
      setShowCamera(true);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        alert('Camera or Microphone access was denied. Please enable permissions.');
      } else {
        alert('Could not access camera. Make sure it is not in use by another app.');
      }
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
      setMediaUrl(dataUrl);
      setMediaType('image');
      stopCamera();
    }
  };

  const startRecording = () => {
    if (!cameraStream) return;
    
    chunksRef.current = [];
    const options = { 
      mimeType: 'video/webm;codecs=vp9,opus',
      videoBitsPerSecond: 1000000 // 1.0Mbps
    };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'video/webm';
    }
    
    try {
      const recorder = new MediaRecorder(cameraStream, options);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setMediaUrl(url);
        setMediaType('video');
        stopCamera();
        setIsRecording(false);
        setRecordingTime(0);
      };
      
      recorder.onerror = (e) => {
        console.error('MediaRecorder error:', e);
        setIsRecording(false);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      
      // Ensure preview keeps playing
      if (videoRef.current) {
        videoRef.current.play().catch(c => console.warn('Preview play failed:', c));
      }

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Recorder error:', err);
      alert('Video recording failed to start.');
    }
  };

  const stopRecordingCapture = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generateThumbnail = async (videoUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = videoUrl;
      video.muted = true;
      video.playsInline = true;
      video.currentTime = 0.5; // Capture at 0.5 seconds for better result
      
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } else {
          resolve('');
        }
        video.remove();
      };
      
      video.onerror = () => {
        resolve('');
        video.remove();
      };
    });
  };

  const handlePublish = async () => {
    if (!title || !description || !category) return;
    setPublishing(true);
    
    try {
      const user = await getCurrentUser();
      if (!user) {
        setPublishing(false);
        alert('Your session has expired. Please log in again to post.');
        router.push('/login');
        return;
      }

      let finalMediaUrl = mediaUrl || '';
      let finalVideoUrl = existingVideoUrl || '';
      const selectedFile = fileInputRef.current?.files?.[0];
      
      // 1. Process media
      if (mediaUrl) {
        let fileToUpload: File | null = null;
        
        try {
          // Always fetch from mediaUrl (blob/data) to bypass Capacitor Android native File object quirks
          const res = await fetch(mediaUrl);
          const blob = await res.blob();
          const isVideo = blob.type.startsWith('video/');
          fileToUpload = new File([blob], isVideo ? "upload.webm" : "upload.jpg", { type: blob.type });
        } catch (e) {
          console.error("Failed to fetch blob from mediaUrl:", e);
        }

        if (fileToUpload) {
          const isVideo = fileToUpload.type.startsWith('video/');
          const formData = new FormData();
          formData.append('file', fileToUpload);
          formData.append('category', isVideo ? 'videos' : 'images');
          
          const uploadRes = await uploadMedia(formData);
          
          if (isVideo) {
            finalVideoUrl = uploadRes.url;
            // Generate and upload thumbnail for video
            const thumbDataUrl = await generateThumbnail(mediaUrl);
            if (thumbDataUrl) {
              const tRes = await fetch(thumbDataUrl);
              const tBlob = await tRes.blob();
              const thumbFile = new File([tBlob], "thumbnail.jpg", { type: "image/jpeg" });
              const thumbData = new FormData();
              thumbData.append('file', thumbFile);
              thumbData.append('category', 'images');
              const thumbRes = await uploadMedia(thumbData);
              finalMediaUrl = thumbRes.url;
            }
          } else {
            finalMediaUrl = uploadRes.url;
          }
        }
      }

      // 2. Create or Update post in DB
      if (isEditing && editId) {
        await updatePost(editId, {
          title,
          description,
          content: description,
          category,
          imageUrl: finalMediaUrl || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80',
          videoUrl: finalVideoUrl || undefined,
        });
      } else {
        await createPost({
          title,
          description,
          content: description, 
          category,
          imageUrl: finalMediaUrl || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80',
          videoUrl: finalVideoUrl || undefined,
          authorId: user.id,
        });
      }

      setPublished(true);
    } catch (err: any) {
      console.error('Publish error:', err);
      alert(`Failed to publish post: ${err?.message || 'Please try again. Check server logs.'}`);
    } finally {
      setPublishing(false);
    }
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
            Post {isEditing ? 'Updated' : 'Published'}!
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
            Your post is now live on the campus feed.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => { setPublished(false); setTitle(''); setDescription(''); setCategory(''); setMediaUrl(null); setMediaType(null); }}>
              ✍️ Write Another
            </button>
            <Link href="/" className="btn btn-ghost">🏠 Home</Link>
            <Link 
              href={currentUserId ? `/profile/${currentUserId}` : '/profile'} 
              className="btn btn-ghost" 
              style={{ border: '1px solid var(--primary)', color: 'var(--primary)' }}
            >
              👤 View Profile
            </Link>
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
          {isEditing ? 'Edit Post' : 'Create Post'}
        </h1>
        <p className="create-post-subtitle" style={{ fontSize: '14px', opacity: 0.7, fontWeight: 500 }}>
          {isEditing ? 'Update your campus news' : 'Share your latest campus updates'}
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

            <div style={{ marginBottom: '28px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Cover Media (Image/Video)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                id="media-file-input"
              />
              <div
                className={`upload-zone ${dragging ? 'dragging' : ''}`}
                id="media-drop-zone"
                onMouseEnter={() => setIsHoveringUpload(true)}
                onMouseLeave={() => setIsHoveringUpload(false)}
                style={{ 
                  position: 'relative',
                  padding: mediaUrl ? '0' : '40px 20px', 
                  overflow: 'hidden', 
                  minHeight: '220px',
                  borderRadius: '20px',
                  background: isHoveringUpload ? 'var(--surface-hover)' : 'var(--surface-2)',
                  border: dragging ? '2px solid var(--primary)' : '2px dashed var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  cursor: mediaUrl ? 'default' : 'pointer'
                }}
                onClick={() => !mediaUrl && fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                {mediaUrl ? (
                  <div style={{ position: 'relative', width: '100%', height: '100%', animation: 'fade-in 0.4s ease' }}>
                    {isCompressing && (
                      <div style={{
                        position: 'absolute', inset: 0, zIndex: 10,
                        background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', color: '#fff'
                      }}>
                        <div className="spinner" style={{ marginBottom: '12px' }} />
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>Compressing Video...</span>
                        <span style={{ fontSize: '11px', opacity: 0.8, marginTop: '4px' }}>Ensuring it fits 10MB limit</span>
                      </div>
                    )}
                    {mediaType === 'video' ? (
                      <video 
                        key={mediaUrl}
                        src={mediaUrl} 
                        style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} 
                        autoPlay 
                        loop 
                        playsInline
                      />
                    ) : (
                      <img src={mediaUrl} alt="Preview" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                    )}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)', pointerEvents: 'none' }} />
                    <button
                      onClick={e => { e.stopPropagation(); setMediaUrl(null); setMediaType(null); }}
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
                        <rect x="14" y="2" width="8" height="8" rx="1" />
                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                      </svg>
                    </div>
                    <h3 style={{ fontWeight: 700, fontSize: '17px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {dragging ? 'Release to Drop' : 'Upload Cover Media'}
                    </h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                      Drag and drop image or video
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
              <><div className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)', width: '20px', height: '20px' }} /> {isEditing ? 'Updating...' : 'Publishing...'}</>
            ) : (
              <>{isEditing ? '💾 Update Post' : '🚀 Publish Post'}</>
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
            </div>

            {/* Image Wrapper with Overlays */}
            {(() => {
              const catData = categories.find(c => c.name === category);
              const catColor = catData?.color || 'var(--primary)';
              
              return (
                <div style={{ position: 'relative', marginTop: '14px', overflow: 'hidden' }}>
                  {/* Overlaid Category */}
                  {category && (
                    <span style={{
                      position: 'absolute', top: '12px', left: '12px', zIndex: 10,
                      padding: '4px 12px', borderRadius: '100px',
                      fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
                      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
                      border: `1px solid ${catColor}cc`, color: '#fff',
                      letterSpacing: '0.05em', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                    }}>
                      {categoryEmojis[category]} {category}
                    </span>
                  )}
                  
                  {mediaUrl ? (
                    mediaType === 'video' ? (
                        <video 
                          key={mediaUrl}
                          src={mediaUrl} 
                          style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} 
                          autoPlay 
                          loop 
                          playsInline
                        />
                    ) : (
                        <img src={mediaUrl} alt="Preview" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                    )
                  ) : (
                    <div style={{
                      width: '100%', aspectRatio: '16/9',
                      background: 'linear-gradient(135deg, var(--surface-2) 0%, var(--border-light) 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'column', gap: '10px',
                    }}>
                      <div style={{ fontSize: '40px', opacity: 0.3 }}>🖼️</div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Media preview</span>
                    </div>
                  )}

                  {/* Headline Overlay */}
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
                    padding: '24px 16px 16px', zIndex: 5
                  }}>
                    <h2 style={{ 
                      fontWeight: 800, fontSize: '18px', lineHeight: 1.3, 
                      color: title ? '#fff' : 'rgba(255,255,255,0.5)', 
                      margin: 0, textShadow: '0 1px 3px rgba(0,0,0,0.5)' 
                    }}>
                      {title || 'Your headline will appear here...'}
                    </h2>
                  </div>
                </div>
              );
            })()}

            {/* Content (Description) */}
            <div style={{ padding: '16px' }}>
              <p style={{ fontSize: '14px', color: description ? 'var(--text-muted)' : 'var(--text-subtle)', lineHeight: 1.6, minHeight: '44px', margin: 0 }}>
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
            position: 'fixed', inset: 0, zIndex: 9999,
            background: '#000', display: 'flex', flexDirection: 'column',
            animation: 'fade-in 0.3s ease',
            overflow: 'hidden'
          }}
        >
          {/* Full Screen Video Background */}
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted
            style={{ 
              position: 'absolute',
              inset: 0,
              width: '100%', 
              height: '100%', 
              objectFit: 'contain',
              zIndex: 1
            }}
          />
          
          {/* Camera Frame UI / Vignette */}
          <div style={{ 
            position: 'absolute', inset: 0, 
            background: 'radial-gradient(circle, transparent 60%, rgba(0,0,0,0.4) 100%)',
            pointerEvents: 'none',
            zIndex: 2
          }} />

          {/* UI Overlays */}
          <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Top Bar */}
            <div style={{ 
              padding: '24px 24px 0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div style={{ 
                background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
                padding: '6px 14px', borderRadius: '20px', color: '#fff',
                fontSize: '12px', fontWeight: 600, letterSpacing: '0.05em'
              }}>
                LIVE · {facingMode === 'user' ? 'Front' : 'Back'}
              </div>
              <button 
                onClick={toggleCamera}
                disabled={isRecording}
                style={{ 
                  background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%',
                  width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', cursor: 'pointer', transition: 'all 0.2s',
                  opacity: isRecording ? 0.3 : 1
                }}
                title="Flip Camera"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </button>
            </div>

            {isRecording && (
              <div style={{
                marginTop: '40px', alignSelf: 'center',
                background: 'rgba(239, 68, 68, 0.85)', padding: '6px 14px', borderRadius: '8px',
                color: '#fff', fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px',
                boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)'
              }}>
                <div style={{
                  width: '10px', height: '10px', borderRadius: '50%', background: '#fff',
                  animation: 'pulse 1s infinite'
                }} />
                {formatTime(recordingTime)}
              </div>
            )}
            
            <div style={{ flex: 1 }} />

            {/* Bottom Controls Area */}
            <div 
              style={{ 
                height: '240px', 
                background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)', 
                display: 'flex', 
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '24px',
                paddingBottom: '20px'
              }}
            >
              <div style={{ color: '#fff', fontSize: '13px', opacity: 0.8, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                {isRecording ? 'Recording video...' : cameraMode === 'video' ? 'Tap red button to record' : 'Align post subject within the frame'}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', width: '100%', padding: '0 40px' }}>
                <button 
                  className="btn" 
                  onClick={stopCamera}
                  disabled={isRecording}
                  style={{ 
                    color: '#fff', background: 'rgba(255,255,255,0.15)', 
                    width: '56px', height: '56px', borderRadius: '50%', 
                    padding: 0, justifyContent: 'center', opacity: isRecording ? 0.3 : 1,
                    backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>

                <button 
                  onClick={cameraMode === 'video' ? (isRecording ? stopRecordingCapture : startRecording) : takePhoto}
                  style={{
                    width: '88px', height: '88px', borderRadius: '50%',
                    background: cameraMode === 'video' ? (isRecording ? '#fff' : '#EF4444') : '#fff',
                    border: `6px solid ${isRecording ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.4)'}`,
                    padding: '4px', cursor: 'pointer', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: isRecording ? '0 0 30px rgba(239, 68, 68, 0.6)' : '0 4px 15px rgba(0,0,0,0.3)'
                  }}
                >
                  {cameraMode === 'video' && isRecording ? (
                    <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#EF4444' }} />
                  ) : (
                    <div style={{ 
                      width: '64px', height: '64px', borderRadius: '50%', 
                      border: '3px solid rgba(0,0,0,0.1)',
                      background: cameraMode === 'video' ? '#EF4444' : '#fff'
                    }} />
                  )}
                </button>

                <button 
                  className="btn"
                  onClick={() => setCameraMode(prev => prev === 'photo' ? 'video' : 'photo')}
                  disabled={isRecording}
                  style={{ 
                    color: '#fff', background: 'rgba(255,255,255,0.15)', 
                    width: '56px', height: '56px', borderRadius: '50%', 
                    padding: 0, justifyContent: 'center',
                    opacity: isRecording ? 0.3 : 1,
                    backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)'
                  }}
                  title={cameraMode === 'photo' ? "Switch to Video" : "Switch to Photo"}
                >
                  {cameraMode === 'photo' ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
