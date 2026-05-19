'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import '../profile.css';
import Link from 'next/link';
import { blockUser, unblockUser, muteUser, reportUser, getBlockStatus, toggleFollow, getFollowStatus, getFollowCounts, getFollowers, getFollowing, getFollowRequestStatus, getProfileData } from '@/lib/actions';
import { OfflineManager } from '@/lib/offline-manager';
import { useIdentity } from '@/lib/IdentityContext';
import { supabase } from '@/lib/supabase';

const categoryColors: Record<string, string> = {
  Events: '#8B5CF6', Notices: '#F59E0B', Sports: '#10B981',
  Academic: '#2563EB', Clubs: '#EC4899', Exams: '#EF4444',
  News: '#6366F1', "College Daily Update": '#14B8A6', Others: '#94A3B8',
};

const REPORT_REASONS = [
  'Spam or misleading',
  'Harassment or bullying',
  'Inappropriate content',
  'Impersonation',
  'Other',
];

interface ProfileClientProps {
  id: string;
  profilePromise: Promise<any>;
}

export default function ProfileClient({ id, profilePromise }: ProfileClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts');

  // Use a ref to track if we've already loaded from cache to avoid infinite loops
  const cacheLoaded = useRef(false);

  const [isFollowing, setIsFollowing] = useState(false);
  const { currentUserId, refreshIdentity, isLoading: isIdentityLoading } = useIdentity();

  const [user, setUser] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      // 1. Check for Sync Metadata Mirror (INSTANT)
      const metaCache = localStorage.getItem(`pp_meta_${id}`);
      if (metaCache) return JSON.parse(metaCache);

      // 2. Check specific profile cache (SQLite/Large)
      const cached = localStorage.getItem(`profile_cache_${id}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.user) return parsed.user;
        } catch (e) { }
      }

      // 2. Check global user data if this is our own profile
      const storedViewerId = localStorage.getItem('last_user_id') || localStorage.getItem('proxypress_viewer_id');
      if (id === storedViewerId) {
        const shared = localStorage.getItem('proxypress_user_data');
        if (shared) {
          try {
            return JSON.parse(shared);
          } catch (e) { }
        }
      }
    }
    return null;
  });

  const isMe = currentUserId && (id === currentUserId || (user && currentUserId === user.id));
  
  const [userPosts, setUserPosts] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      // 1. Try Sync Grid Mirror (INSTANT)
      const gridCache = localStorage.getItem(`pp_grid_${id}`);
      if (gridCache) return JSON.parse(gridCache);

      // 2. Try Legacy Cache
      const cached = localStorage.getItem(`profile_cache_${id}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          return parsed.posts || [];
        } catch (e) { return []; }
      }
    }
    return [];
  });

  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  
  const [followersCount, setFollowersCount] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const meta = localStorage.getItem(`pp_meta_${id}`);
      if (meta) return JSON.parse(meta).followersCount || 0;
      
      const cached = localStorage.getItem(`profile_cache_${id}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          return parsed.followCounts?.followers || 0;
        } catch (e) { return 0; }
      }
    }
    return 0;
  });

  const [followingCount, setFollowingCount] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const meta = localStorage.getItem(`pp_meta_${id}`);
      if (meta) return JSON.parse(meta).followingCount || 0;

      const cached = localStorage.getItem(`profile_cache_${id}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          return parsed.followCounts?.following || 0;
        } catch (e) { return 0; }
      }
    }
    return 0;
  });

  const [isRequested, setIsRequested] = useState(false);
  
  const [isLoading, setIsLoading] = useState(() => {
    // If we have user data from ANY cache (Local or Shared), we can show the UI immediately
    if (user) return false;
    return true;
  });
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const staggerPosts = (freshPosts: any[]) => {
    if (!freshPosts || freshPosts.length === 0) return;
    setUserPosts(freshPosts);
  };

  // Settings Pre-warming: If this is my profile, keep my global user data fresh for Settings
  useEffect(() => {
    if (isMe && user && typeof window !== 'undefined') {
      localStorage.setItem('proxypress_user_data', JSON.stringify(user));
    }
  }, [isMe, user]);

  // Cache loading logic
  useEffect(() => {
    async function loadCache() {
      if (cacheLoaded.current) return;
      
      // 1. Try SQLite first (New Relational Engine)
      const offlineProfile = await OfflineManager.getOfflineProfile();
      const offlinePosts = await OfflineManager.getOfflinePosts();

      if (offlineProfile) {
        console.log(`[Offline] SQLite Profile loaded for: ${id}`);
        
        // Use the local cached images if available
        const userToSet = {
          ...offlineProfile,
          avatar: offlineProfile.localAvatar || offlineProfile.avatar,
          profilePicture: offlineProfile.localAvatar || offlineProfile.profilePicture
        };

        const postsToSet = offlinePosts.map((p: any) => ({
          ...p,
          imageUrl: p.localImageUrl || p.imageUrl
        }));

        setUser(userToSet);
        staggerPosts(postsToSet);
        
        // Mirror metadata & top posts for instant sync on next visit
        localStorage.setItem(`pp_meta_${id}`, JSON.stringify({
          ...userToSet,
          followersCount: userToSet.followersCount || 0,
          followingCount: userToSet.followingCount || 0
        }));
        localStorage.setItem(`pp_grid_${id}`, JSON.stringify(postsToSet.slice(0, 6))); // Cache top 6

        setIsLoading(false);
        cacheLoaded.current = true;
        return;
      }

      // 2. Fallback to Preferences/LocalStorage (Legacy)
      const cached = await OfflineManager.loadData<any>(`profile_cache_${id}`);
      if (cached) {
        console.log(`[Offline] Legacy Cache load for: ${id}`);
        setUser(cached.user);
        staggerPosts(cached.posts || []);
        setIsFollowing(cached.isFollowing);
        setFollowersCount(cached.followCounts?.followers || 0);
        setFollowingCount(cached.followCounts?.following || 0);
        setIsLoading(false);
      }
      cacheLoaded.current = true;
    }

    loadCache();

    // Background refresh from server promise pipeline
    async function refreshProfile() {
      try {
        const freshData = await profilePromise;
        if (freshData) {
          const updatedUser = {
            ...freshData.user,
            postsCount: freshData.posts?.length || 0,
            statusDisplay: freshData.statusDisplay || null
          };
          setUser(updatedUser);
          // Mirror metadata & top posts for instant sync on next visit
          if (typeof window !== 'undefined') {
            const metaObj = {
              ...updatedUser,
              followersCount: freshData.followCounts?.followers || 0,
              followingCount: freshData.followCounts?.following || 0
            };
            localStorage.setItem(`pp_meta_${id}`, JSON.stringify(metaObj));
            if (freshData.posts) {
              localStorage.setItem(`pp_grid_${id}`, JSON.stringify(freshData.posts.slice(0, 6)));
            }
          }
          if (freshData.posts) {
            staggerPosts(freshData.posts);
          }
          setIsFollowing(freshData.isFollowing || false);
          setFollowersCount(freshData.followCounts?.followers || 0);
          setFollowingCount(freshData.followCounts?.following || 0);
          
          if (freshData.currentUserId) {
            refreshIdentity();
            OfflineManager.saveData('last_user_id', freshData.currentUserId);
            
            // SYNC TO SQLITE if this is my profile
            if (id === freshData.currentUserId) {
              OfflineManager.syncAllUserData(freshData.currentUserId);
            }
          }

          // Update Cache
          OfflineManager.saveData(`profile_cache_${id}`, {
            user: updatedUser,
            posts: freshData.posts || [],
            isFollowing: freshData.isFollowing || false,
            followCounts: { 
              followers: freshData.followCounts?.followers || 0, 
              following: freshData.followCounts?.following || 0 
            },
            timestamp: Date.now()
          });
          
          setIsLoading(false);
        } else {
          // If freshData is null (e.g. 404), only then stop loading if we don't have cached user
          if (!user) setIsLoading(false);
        }
      } catch (err) {
        console.error("Background refresh failed", err);
        setIsLoading(false);
      }
    }

    refreshProfile();
  }, [id, profilePromise]);

  // Manual cache save on user updates
  useEffect(() => {
    if (user) {
      OfflineManager.saveData(`profile_cache_${id}`, {
        user,
        posts: userPosts,
        isFollowing,
        followCounts: { followers: followersCount, following: followingCount },
        timestamp: Date.now()
      });
    }
  }, [user, userPosts, id, isFollowing, followersCount, followingCount]);
  
  // ─── Supabase Real-time Updates ───
  useEffect(() => {
    if (!id) return;

    // 1. Listen for Follower Updates
    const channel = supabase
      .channel(`profile-realtime-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follows',
          filter: `followingId=eq.${id}`
        },
        (payload) => {
          const isOurFollow = (payload.new as any)?.followerId === currentUserId || (payload.old as any)?.followerId === currentUserId;
          
          if (payload.eventType === 'INSERT') {
            setFollowersCount(prev => prev + 1);
            if (isOurFollow) setIsFollowing(true);
          } else if (payload.eventType === 'DELETE') {
            setFollowersCount(prev => prev - 1);
            if (isOurFollow) setIsFollowing(false);
          }
        }
      )
      // 2. Listen for Post Like Updates
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_likes'
        },
        (payload) => {
          const targetPostId = (payload.new as any)?.postId || (payload.old as any)?.postId;
          if (targetPostId) {
            setUserPosts(prev => prev.map(post => {
              if (post.id === targetPostId) {
                const currentLikes = typeof post.likes === 'number' ? post.likes : 0;
                return { 
                  ...post, 
                  likes: payload.eventType === 'INSERT' ? currentLikes + 1 : Math.max(0, currentLikes - 1) 
                };
              }
              return post;
            }));
          }
        }
      )
      // 3. Listen for Follow Request Updates (Self -> Target)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follow_requests'
        },
        (payload) => {
          // If we are the one who sent the request (or it involves us)
          const isOurRequest = (payload.new as any)?.followerId === currentUserId || (payload.old as any)?.followerId === currentUserId;
          const involvesThisProfile = (payload.new as any)?.followingId === id || (payload.old as any)?.followingId === id;
          
          if (isOurRequest && involvesThisProfile) {
            if (payload.eventType === 'INSERT') {
              setIsRequested(true);
            } else if (payload.eventType === 'DELETE') {
              setIsRequested(false);
              // Note: If accepted, the 'follows' listener above will catch the INSERT 
              // and set isFollowing(true) and update the count.
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);


  // Options menu state
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'danger' | 'info' } | null>(null);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showMuteConfirm, setShowMuteConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [userToUnfollow, setUserToUnfollow] = useState<{ id: string, name: string, isList: boolean, profilePicture?: string, avatar?: string } | null>(null);
  const [showFullImage, setShowFullImage] = useState(false);
  const [isClosingFullImage, setIsClosingFullImage] = useState(false);

  // Followers/Following Modal state
  const [showFollowModal, setShowFollowModal] = useState<{ title: string; type: 'followers' | 'following' } | null>(null);
  const [followList, setFollowList] = useState<any[]>([]);
  const [isFollowListLoading, setIsFollowListLoading] = useState(false);
  const [myFollowingIds, setMyFollowingIds] = useState<Set<string>>(new Set());

  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowOptionsMenu(false);
      }
    }
    if (showOptionsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showOptionsMenu]);

  const handleCloseFullImage = () => {
    setIsClosingFullImage(true);
    setTimeout(() => {
      setShowFullImage(false);
      setIsClosingFullImage(false);
    }, 350);
  };

  // Handle Escape key for lightbox
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleCloseFullImage();
      }
    }
    if (showFullImage) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [showFullImage]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Load remaining data (like saved posts) only if it's "Me"
  useEffect(() => {
    if (isMe && activeTab === 'saved' && savedPosts.length === 0) {
      async function loadSaved() {
        try {
          const data = await getProfileData(id); // Re-use for saved posts logic
          if (data && data.user.id === currentUserId) {
             // Filter saved logic...
          }
        } catch (err) {}
      }
      loadSaved();
    }
  }, [activeTab, isMe]);

  const displayPosts = activeTab === 'posts' ? userPosts : (isMe ? savedPosts : []);

  // ─── Action Handlers ───
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast({ message: 'Profile link copied!', type: 'info' });
    } catch {
      setToast({ message: 'Failed to copy link', type: 'danger' });
    }
    setShowOptionsMenu(false);
  };

  const handleShareProfile = async () => {
    const shareUrl = `${window.location.origin}/profile/${user?.id || id}`;
    const shareData = {
      title: `${user?.name || 'User'} on ProxyPress`,
      text: `Check out ${user?.name || 'this profile'} on ProxyPress`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // Only log if it's not a user cancellation
        if ((err as any).name !== 'AbortError') {
          console.error('Error sharing:', err);
        }
      }
    } else {
      // Fallback for browsers without Web Share API
      try {
        await navigator.clipboard.writeText(shareUrl);
        setToast({ message: 'Profile link copied!', type: 'info' });
      } catch {
        setToast({ message: 'Failed to share profile', type: 'danger' });
      }
    }
    setShowOptionsMenu(false);
  };


  const handleMuteToggle = () => {
    setShowMuteConfirm(true);
    setShowOptionsMenu(false);
  };

  const handleMuteConfirm = async () => {
    if (!user) return;
    setShowMuteConfirm(false);
    const result = await muteUser(user.id);
    if (result.success) {
      const nowMuted = result.muted ?? !isMuted;
      setIsMuted(nowMuted);
      setToast({
        message: nowMuted ? `${user.name} has been muted` : `${user.name} has been unmuted`,
        type: nowMuted ? 'info' : 'success',
      });
    }
  };

  const handleBlockConfirm = async () => {
    if (!user) return;
    setShowBlockConfirm(false);
    setShowOptionsMenu(false);

    if (isBlocked) {
      const result = await unblockUser(user.id);
      if (result.success) {
        setIsBlocked(false);
        setToast({ message: `${user.name} has been unblocked`, type: 'success' });
      }
    } else {
      const result = await blockUser(user.id);
      if (result.success) {
        setIsBlocked(true);
        setToast({ message: `${user.name} has been blocked`, type: 'danger' });
      }
    }
  };

  const handleReport = async () => {
    if (!user || !reportReason) return;
    const result = await reportUser(user.id, reportReason);
    if (result.success) {
      setToast({ message: 'Report submitted. We will review it shortly.', type: 'info' });
    }
    setShowReportModal(false);
    setReportReason('');
    setShowOptionsMenu(false);
  };

  const handleFollowToggle = async () => {
    if (!user) return;
    if (isFollowing) {
      setUserToUnfollow({ id: user.id, name: user.name, isList: false, profilePicture: user.profilePicture, avatar: user.avatar });
      return;
    }
    if (isRequested) {
      setIsRequested(false);
      try { await toggleFollow(user.id); } catch (err) { setIsRequested(true); }
      return;
    }

    if (!user.isPrivate) {
      setIsFollowing(true);
      setFollowersCount(prev => prev + 1);
    } else {
      setIsRequested(true);
    }

    try {
      const result = await toggleFollow(user.id);
      if (!result.success) throw new Error();
      if (user.isPrivate) {
        setIsRequested(result.requested ?? false);
        setIsFollowing(false);
      } else {
        setIsFollowing(result.following ?? true);
        setIsRequested(false);
      }
    } catch (err) {
       setIsFollowing(false);
       setIsRequested(false);
       if (!user.isPrivate) setFollowersCount((prev: number) => prev - 1);
       setToast({ message: 'Failed to follow user', type: 'danger' });
    }
  };

  const openFollowModal = async (type: 'followers' | 'following') => {
    if (!user) return;
    setShowFollowModal({ title: type === 'followers' ? 'Followers' : 'Following', type });
    setFollowList([]);
    setIsFollowListLoading(true);
    try {
      const [data, myFollowing] = await Promise.all([
        type === 'followers' ? getFollowers(user.id) : getFollowing(user.id),
        currentUserId ? getFollowing(currentUserId) : Promise.resolve([])
      ]);
      setFollowList(data || []);
      setMyFollowingIds(new Set(myFollowing.map((u: any) => u.id)));
    } catch (err) {
      setToast({ message: 'Failed to load list', type: 'danger' });
    } finally {
      setIsFollowListLoading(false);
    }
  };

  const handleListFollowToggle = async (targetUser: any) => {
    if (!currentUserId || targetUser.id === currentUserId) return;
    const isCurrentlyFollowing = myFollowingIds.has(targetUser.id);
    if (isCurrentlyFollowing) {
      setUserToUnfollow({ id: targetUser.id, name: targetUser.name, isList: true, profilePicture: targetUser.profilePicture, avatar: targetUser.avatar });
      return;
    }
    const newFollowingIds = new Set(myFollowingIds);
    newFollowingIds.add(targetUser.id);
    setMyFollowingIds(newFollowingIds);
    if (isMe) setFollowingCount((prev: number) => prev + 1);
    try {
      const result = await toggleFollow(targetUser.id);
      if (!result.success) throw new Error();
    } catch {
      setMyFollowingIds(myFollowingIds);
      setToast({ message: 'Action failed', type: 'danger' });
    }
  };

  const confirmUnfollow = async () => {
    if (!userToUnfollow) return;
    const { id: targetId, isList } = userToUnfollow;
    setUserToUnfollow(null);
    if (isList) {
      const newFollowingIds = new Set(myFollowingIds);
      newFollowingIds.delete(targetId);
      setMyFollowingIds(newFollowingIds);
      if (isMe) {
        setFollowingCount((prev: number) => prev - 1);
        if (showFollowModal?.type === 'following') setFollowList(prev => prev.filter(u => u.id !== targetId));
      }
      try {
        const result = await toggleFollow(targetId);
        if (!result.success) throw new Error();
      } catch {
        setMyFollowingIds(myFollowingIds);
        setToast({ message: 'Action failed', type: 'danger' });
      }
    } else {
      setIsFollowing(false);
      setFollowersCount(prev => prev - 1);
      setFollowersCount((prev: number) => prev - 1);
      try {
        const result = await toggleFollow(targetId);
        if (!result.success) throw new Error();
      } catch (err) {
         setIsFollowing(true);
         setFollowersCount((prev: number) => prev + 1);
         setToast({ message: 'Failed to update follow status', type: 'danger' });
      }
    }
  };

  // Remove the blocking full-page spinner to allow partial/skeleton rendering

  return (
    <div className="ig-profile extra-bottom-space" id="profile-page" style={{ position: 'relative' }}>
      {/* ─── Skeleton Loading State (Only if no user data yet) ─── */}
      {!user && isLoading && (
        <div className="profile-skeleton" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
            <div className="skeleton-circle" style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--surface-3)' }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton-line" style={{ width: '60%', height: '20px', background: 'var(--surface-3)', marginBottom: '10px', borderRadius: '4px' }} />
              <div className="skeleton-line" style={{ width: '40%', height: '14px', background: 'var(--surface-3)', borderRadius: '4px' }} />
            </div>
          </div>
          <div className="skeleton-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} style={{ aspectRatio: '1/1', background: 'var(--surface-3)' }} />
            ))}
          </div>
        </div>
      )}

      {!user && !isLoading && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <h2 style={{ color: 'var(--text-primary)' }}>User not found</h2>
          <p style={{ color: 'var(--text-muted)' }}>The profile you are looking for doesn't exist.</p>
          <Link href="/" style={{ color: 'var(--primary)', marginTop: '20px', display: 'inline-block' }}>Go Home</Link>
        </div>
      )}

      {user && (
        <>
      {/* ─── Toast ─── */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
          padding: '12px 24px', borderRadius: '12px', zIndex: 9999,
          background: toast.type === 'danger' ? 'rgba(239, 68, 68, 0.95)'
            : toast.type === 'success' ? 'rgba(16, 185, 129, 0.95)'
            : 'rgba(99, 102, 241, 0.95)',
          color: '#fff', fontSize: '14px', fontWeight: 600,
          backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          animation: 'fade-in 0.3s ease-out',
          maxWidth: '90vw', textAlign: 'center',
        }}>
          {toast.message}
        </div>
      )}

      {/* Profile Header UI (Omitted for brevity, but same as original) */}
      <div className="ig-header-main">
        <div className="ig-avatar-outer">
          <button onClick={() => router.back()} className="ig-header-back-btn" aria-label="Go back">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>

          <div className="ig-avatar-ring jumbo" onClick={() => setShowFullImage(true)} style={{ cursor: 'pointer' }}>
            <div className="ig-avatar-inner jumbo" style={{ overflow: 'hidden' }}>
               <img src={user.profilePicture || user.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&color=fff&size=200`} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </div>

          {isIdentityLoading ? (
            <div style={{ width: '40px' }} /> 
          ) : isMe ? (
            <Link 
              href="/settings" 
              className="ig-header-settings-btn" 
              aria-label="Settings"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </Link>
          ) : (
            <div ref={menuRef} className="ig-header-options-wrapper">
              <button className="ig-header-settings-btn" onClick={() => setShowOptionsMenu(prev => !prev)} aria-label="Options">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
                </svg>
              </button>
              {showOptionsMenu && (
                <div className="dropdown-menu">
                   <button onClick={handleCopyLink}><span>🔗</span> Copy Link</button>
                   <button onClick={handleShareProfile}><span>📤</span> Share Profile</button>
                   <button onClick={handleMuteToggle}>
                     <span>{isMuted ? '🔔' : '🔕'}</span> 
                     {isMuted ? 'Unmute' : 'Mute'}
                   </button>
                   <button onClick={() => setShowBlockConfirm(true)} className={isBlocked ? '' : 'danger'}>
                     <span>{isBlocked ? '✅' : '🚫'}</span> 
                     {isBlocked ? 'Unblock' : 'Block'}
                   </button>
                   <button onClick={() => setShowReportModal(true)} className="danger">
                     <span>🚩</span> Report
                   </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="ig-profile-bio-modern">
        <h1>{user.name}</h1>
        {user.username && <p className="ig-handle-tag">@{user.username}</p>}
        <p className="ig-college-tag">{user.college} • {user.branch}</p>
        <p className="ig-bio-text">{user.bio}</p>
      </div>

      <div className="ig-stats-container-modern stats-bar">
        <div className="ig-stat">
          <span className="ig-stat-value">{userPosts.length}</span>
          <span className="ig-stat-label">Posts</span>
        </div>
        <div className="ig-stat clickable" onClick={() => openFollowModal('followers')}>
          <span className="ig-stat-value">{followersCount}</span>
          <span className="ig-stat-label">Followers</span>
        </div>
        <div className="ig-stat clickable" onClick={() => openFollowModal('following')}>
          <span className="ig-stat-value">{followingCount}</span>
          <span className="ig-stat-label">Following</span>
        </div>
      </div>

      <div className="ig-profile-actions">
        {isMe ? (
          <button onClick={handleShareProfile} className="ig-action-btn ig-action-btn-secondary" style={{ flex: 1 }}>Share Profile</button>
        ) : (
          <>
            <button className={`ig-action-btn ${isFollowing ? 'ig-action-btn-following' : isRequested ? 'ig-action-btn-secondary' : 'ig-action-btn-follow'}`} onClick={handleFollowToggle} style={{ flex: 2 }}>
              {isFollowing ? 'Following' : isRequested ? 'Requested' : 'Follow'}
            </button>
            <Link href={`/messages?userId=${user.id}`} className="ig-action-btn ig-action-btn-message" style={{ flex: 2 }}>Message</Link>
          </>
        )}
      </div>

      <div className="ig-tabs">
        <button className={`ig-tab ${activeTab === 'posts' ? 'active' : ''}`} onClick={() => setActiveTab('posts')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill={activeTab === 'posts' ? 'currentColor' : 'none'} stroke="currentColor"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
        </button>
        {isMe && (
          <button className={`ig-tab ${activeTab === 'saved' ? 'active' : ''}`} onClick={() => setActiveTab('saved')}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill={activeTab === 'saved' ? 'currentColor' : 'none'} stroke="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
          </button>
        )}
      </div>

      <div className="ig-grid">
        {displayPosts.map((post, idx) => (
          <Link 
            key={post.id} 
            href={`/article/${post.slug}`} 
            className="ig-grid-item"
            style={{
              '--stagger-index': idx
            } as React.CSSProperties}
          >
            <img src={post.imageUrl} alt={post.title} loading="lazy" />
          </Link>
        ))}
      </div>

      {/* ─── Full Image Lightbox ─── */}
      {showFullImage && (
        <div 
          className={`ig-full-image-overlay ${isClosingFullImage ? 'closing' : ''}`}
          onClick={handleCloseFullImage}
        >
          <div className="ig-full-image-content" onClick={(e) => e.stopPropagation()}>
            <img 
              src={user.profilePicture || user.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&color=fff&size=500`} 
              alt={user.name} 
            />
          </div>
        </div>
      )}

      {/* ─── Follow Modal (Followers/Following) ─── */}
      {showFollowModal && (
        <div className="modal-overlay" onClick={() => setShowFollowModal(null)} style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', textAlign: 'center', position: 'relative' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{showFollowModal.title}</h3>
              <button onClick={() => setShowFollowModal(null)} style={{ position: 'absolute', right: '16px', top: '16px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {isFollowListLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><div className="spinner" /></div>
              ) : followList.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No {showFollowModal.type} yet.</div>
              ) : (
                followList.map((item: any) => (
                  <div key={item.id} className="follow-list-item" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', cursor: 'pointer' }}>
                    <div 
                      className="ig-avatar-ring" 
                      style={{ width: '44px', height: '44px', padding: '2px' }}
                      onClick={() => { setShowFollowModal(null); router.push(`/profile/${item.id}`); }}
                    >
                      <div className="ig-avatar-inner" style={{ fontSize: '18px' }}>
                        {item.profilePicture ? <img src={item.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (item.avatar || item.name.substring(0, 1))}
                      </div>
                    </div>
                    <div style={{ flex: 1 }} onClick={() => { setShowFollowModal(null); router.push(`/profile/${item.id}`); }}>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{item.name}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>@{item.username || item.name.toLowerCase().replace(' ', '')}</div>
                    </div>
                    {currentUserId && item.id !== currentUserId && (
                      <button 
                        onClick={() => handleListFollowToggle(item)}
                        className={`ig-action-btn ${myFollowingIds.has(item.id) ? 'ig-action-btn-following' : 'ig-action-btn-follow'}`}
                        style={{ width: 'auto', padding: '6px 16px', fontSize: '13px' }}
                      >
                        {myFollowingIds.has(item.id) ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Unfollow Confirmation ─── */}
      {userToUnfollow && (
        <div className="modal-overlay" onClick={() => setUserToUnfollow(null)} style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div style={{ padding: '32px 24px 24px' }}>
              <div className="ig-avatar-ring" style={{ width: '90px', height: '90px', margin: '0 auto 16px', padding: '3px' }}>
                <div className="ig-avatar-inner" style={{ fontSize: '40px' }}>
                  {userToUnfollow.profilePicture ? <img src={userToUnfollow.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (userToUnfollow.avatar || userToUnfollow.name.substring(0, 1))}
                </div>
              </div>
              <p style={{ fontSize: '14px', color: 'var(--text-primary)', margin: 0 }}>Unfollow @{userToUnfollow.name.toLowerCase().replace(' ', '')}?</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border)' }}>
              <button onClick={confirmUnfollow} style={{ padding: '16px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', color: '#ef4444', fontWeight: 700, cursor: 'pointer' }}>Unfollow</button>
              <button onClick={() => setUserToUnfollow(null)} style={{ padding: '16px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Block Confirmation ─── */}
      {showBlockConfirm && (
        <div className="modal-overlay" onClick={() => setShowBlockConfirm(false)} style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div style={{ padding: '32px 24px 24px' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700 }}>Block {user.name}?</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>They won't be able to find your profile, posts or story on ProxyPress. They won't be notified that you blocked them.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border)' }}>
              <button onClick={handleBlockConfirm} style={{ padding: '16px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', color: '#ef4444', fontWeight: 700, cursor: 'pointer' }}>Block</button>
              <button onClick={() => setShowBlockConfirm(false)} style={{ padding: '16px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Mute Confirmation ─── */}
      {showMuteConfirm && (
        <div className="modal-overlay" onClick={() => setShowMuteConfirm(false)} style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div style={{ padding: '32px 24px 24px' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700 }}>Mute {user.name}?</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>You can unmute them from their profile at any time. They won't be notified that you muted them.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border)' }}>
              <button onClick={handleMuteConfirm} style={{ padding: '16px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', color: '#ef4444', fontWeight: 700, cursor: 'pointer' }}>Mute</button>
              <button onClick={() => setShowMuteConfirm(false)} style={{ padding: '16px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Report Modal ─── */}
      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)} style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Report</h3>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <p style={{ padding: '16px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Why are you reporting this account?</p>
              {REPORT_REASONS.map(reason => (
                <button 
                  key={reason}
                  onClick={() => { setReportReason(reason); handleReport(); }}
                  style={{ width: '100%', padding: '14px 16px', textAlign: 'left', background: 'none', border: 'none', borderTop: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '14px', cursor: 'pointer' }}
                >
                  {reason}
                </button>
              ))}
            </div>
            <button onClick={() => setShowReportModal(false)} style={{ padding: '16px', background: 'none', border: 'none', borderTop: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
