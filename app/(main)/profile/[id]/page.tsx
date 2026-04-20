'use client';

import { useState, useEffect, use, useRef } from 'react';
import { posts as mockPosts, currentUser as mockUser } from '@/lib/data';
import '../profile.css';
import Link from 'next/link';
import { getInitialData, getCurrentUser, getUserProfile, blockUser, unblockUser, muteUser, reportUser, getBlockStatus, toggleFollow, getFollowStatus, getFollowCounts, getFollowers, getFollowing } from '@/lib/actions';

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

export default function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isMe, setIsMe] = useState(false);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Options menu state
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'danger' | 'info' } | null>(null);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [userToUnfollow, setUserToUnfollow] = useState<{ id: string, name: string, isList: boolean, profilePicture?: string, avatar?: string } | null>(null);

  // Followers/Following Modal state
  const [showFollowModal, setShowFollowModal] = useState<{ title: string; type: 'followers' | 'following' } | null>(null);
  const [followList, setFollowList] = useState<any[]>([]);
  const [isFollowListLoading, setIsFollowListLoading] = useState(false);
  const [myFollowingIds, setMyFollowingIds] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    async function loadProfileData() {
      try {
        const [currentUserData, targetUserData, data] = await Promise.all([
          getCurrentUser(),
          getUserProfile(id),
          getInitialData(),
        ]);

        if (currentUserData) {
          setCurrentUserId(currentUserData.id);
        }

        if (targetUserData) {
          const targetUserId = targetUserData.id;
          const currentUserId = currentUserData?.id;
          
          const meFlag = targetUserId === currentUserId;
          setIsMe(meFlag);
          
          setUser({
            ...targetUserData,
            postsCount: targetUserData.postsCount || (data?.posts?.filter((p: any) => p.authorId === targetUserId).length || 0),
          });

          if (data) {
            const myPosts = data.posts.filter((p: any) => p.authorId === targetUserId);
            setUserPosts(myPosts);

            if (targetUserId === currentUserId) {
              const savedFromDB = data.posts.filter((p: any) =>
                Array.isArray(p.savedList) && p.savedList.some((s: any) => s.userId === currentUserId)
              );
              setSavedPosts(savedFromDB);
            }
          }

          // Load block/mute status and follow info for other users
          if (!meFlag) {
            const [safetyStatus, followStatus, followCounts] = await Promise.all([
              getBlockStatus(targetUserId),
              getFollowStatus(targetUserId),
              getFollowCounts(targetUserId)
            ]);
            setIsBlocked(safetyStatus.blocked);
            setIsMuted(safetyStatus.muted);
            setIsFollowing(followStatus.following);
            setFollowersCount(followCounts.followers);
            setFollowingCount(followCounts.following);
          } else {
            // For self, just load counts
            const followCounts = await getFollowCounts(targetUserId);
            setFollowersCount(followCounts.followers);
            setFollowingCount(followCounts.following);
          }
        }
      } catch (err) {
        console.error('Failed to load profile data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadProfileData();
  }, [id]);

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
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${user?.name}'s Profile`,
          text: `Check out ${user?.name}'s profile on ProxyPress`,
          url: window.location.href,
        });
      } catch {
        // User cancelled share
      }
    } else {
      handleCopyLink(); // Fallback
      return;
    }
    setShowOptionsMenu(false);
  };

  const handleMuteToggle = async () => {
    if (!user) return;
    setShowOptionsMenu(false);
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

    // Follow Optimistic UI
    setIsFollowing(true);
    setFollowersCount(prev => prev + 1);

    try {
      const result = await toggleFollow(user.id);
      if (!result.success) throw new Error(result.error);
    } catch (err) {
       setIsFollowing(false);
       setFollowersCount(prev => prev - 1);
       setToast({ message: 'Failed to follow user', type: 'danger' });
    }
  };

  const openFollowModal = async (type: 'followers' | 'following') => {
    if (!user) return;
    setShowFollowModal({ 
      title: type === 'followers' ? 'Followers' : 'Following', 
      type 
    });
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
      console.error('Failed to fetch follow list:', err);
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

    if (isMe) {
      setFollowingCount(prev => prev + 1);
    } else if (targetUser.id === user?.id) {
       setIsFollowing(true);
       setFollowersCount(prev => prev + 1);
    }

    try {
      const result = await toggleFollow(targetUser.id);
      if (!result.success) throw new Error();
    } catch {
      setMyFollowingIds(myFollowingIds); // rollback
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
        setFollowingCount(prev => prev - 1);
        if (showFollowModal?.type === 'following') {
          setFollowList(prev => prev.filter(u => u.id !== targetId));
        }
      } else if (targetId === user?.id) {
         setIsFollowing(false);
         setFollowersCount(prev => prev - 1);
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

      try {
        const result = await toggleFollow(targetId);
        if (!result.success) throw new Error(result.error);
      } catch (err) {
         setIsFollowing(true);
         setFollowersCount(prev => prev + 1);
         setToast({ message: 'Failed to update follow status', type: 'danger' });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="ig-profile" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="ig-profile" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <h2 style={{ color: 'var(--text-primary)' }}>User not found</h2>
        <p style={{ color: 'var(--text-muted)' }}>The profile you are looking for doesn't exist or has been removed.</p>
        <Link href="/" style={{ color: 'var(--primary)', marginTop: '20px', display: 'inline-block' }}>Go Home</Link>
      </div>
    );
  }

  return (
    <div className="ig-profile animate-fade-in" id="profile-page" style={{ position: 'relative' }}>
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

      <div className="ig-header-main">
        <div className="ig-avatar-outer">
          <Link href="/" className="ig-header-back-btn" aria-label="Go back">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </Link>

          <div className="ig-avatar-ring jumbo">
            <div className="ig-avatar-inner jumbo" style={{ overflow: 'hidden' }}>
              {user.profilePicture ? (
                <img src={user.profilePicture} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ fontSize: '44px' }}>👤</div>
              )}
            </div>
          </div>
          
          {/* Top-right button: Settings for me, Options for others */}
          {isMe ? (
            <Link href="/settings" className="ig-header-settings-btn" aria-label="Settings">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/>
              </svg>
            </Link>
          ) : (
            <div ref={menuRef} style={{ position: 'absolute', top: 0, right: 0 }}>
              <button
                className="ig-header-settings-btn"
                aria-label="More options"
                onClick={() => setShowOptionsMenu(prev => !prev)}
                style={{ position: 'relative' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/>
                </svg>
              </button>

              {/* ─── Options Dropdown ─── */}
              {showOptionsMenu && (
                <div style={{
                  position: 'absolute', top: '48px', right: '0',
                  background: 'rgba(30, 30, 45, 0.95)', backdropFilter: 'blur(20px)',
                  borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.5)', overflow: 'hidden',
                  minWidth: '220px', zIndex: 200,
                  animation: 'fade-in 0.2s ease-out',
                }}>
                  {/* Copy Link */}
                  <button onClick={handleCopyLink} style={{
                    display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
                    padding: '14px 18px', border: 'none', background: 'transparent',
                    color: 'var(--text-primary)', fontSize: '14px', fontWeight: 500,
                    cursor: 'pointer', transition: 'background 0.2s',
                    textAlign: 'left',
                  }}>
                    <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>🔗</span>
                    Copy Profile Link
                  </button>

                  {/* Share Profile */}
                  <button onClick={handleShareProfile} style={{
                    display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
                    padding: '14px 18px', border: 'none', background: 'transparent',
                    color: 'var(--text-primary)', fontSize: '14px', fontWeight: 500,
                    cursor: 'pointer', transition: 'background 0.2s',
                    textAlign: 'left',
                  }}>
                    <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>📤</span>
                    Share Profile
                  </button>

                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 14px' }} />

                  {/* Mute */}
                  <button onClick={handleMuteToggle} style={{
                    display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
                    padding: '14px 18px', border: 'none', background: 'transparent',
                    color: isMuted ? '#10B981' : 'var(--text-primary)', fontSize: '14px', fontWeight: 500,
                    cursor: 'pointer', transition: 'background 0.2s',
                    textAlign: 'left',
                  }}>
                    <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{isMuted ? '🔔' : '🔕'}</span>
                    {isMuted ? 'Unmute User' : 'Mute User'}
                  </button>

                  {/* Block */}
                  <button onClick={() => { setShowBlockConfirm(true); setShowOptionsMenu(false); }} style={{
                    display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
                    padding: '14px 18px', border: 'none', background: 'transparent',
                    color: isBlocked ? '#10B981' : '#EF4444', fontSize: '14px', fontWeight: 500,
                    cursor: 'pointer', transition: 'background 0.2s',
                    textAlign: 'left',
                  }}>
                    <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{isBlocked ? '✅' : '🚫'}</span>
                    {isBlocked ? 'Unblock User' : 'Block User'}
                  </button>

                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 14px' }} />

                  {/* Report */}
                  <button onClick={() => { setShowReportModal(true); setShowOptionsMenu(false); }} style={{
                    display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
                    padding: '14px 18px', border: 'none', background: 'transparent',
                    color: '#EF4444', fontSize: '14px', fontWeight: 500,
                    cursor: 'pointer', transition: 'background 0.2s',
                    textAlign: 'left',
                  }}>
                    <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>🚩</span>
                    Report User
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Block Confirmation Modal ─── */}
      {showBlockConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)', animation: 'fade-in 0.2s ease-out',
        }} onClick={() => setShowBlockConfirm(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'rgba(30, 30, 45, 0.98)', borderRadius: '20px',
            padding: '28px', maxWidth: '340px', width: '90vw',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)', textAlign: 'center',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>
              {isBlocked ? '✅' : '🚫'}
            </div>
            <h3 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 700, margin: '0 0 8px' }}>
              {isBlocked ? `Unblock ${user.name}?` : `Block ${user.name}?`}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.5, margin: '0 0 24px' }}>
              {isBlocked
                ? 'They will be able to see your profile and posts again.'
                : "They won't be able to find your profile, posts, or stories on ProxyPress. They won't be notified."}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowBlockConfirm(false)} style={{
                flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent', color: 'var(--text-primary)', fontSize: '14px',
                fontWeight: 600, cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={handleBlockConfirm} style={{
                flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                background: isBlocked ? '#10B981' : '#EF4444', color: '#fff', fontSize: '14px',
                fontWeight: 600, cursor: 'pointer',
              }}>{isBlocked ? 'Unblock' : 'Block'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Report Modal ─── */}
      {showReportModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)', animation: 'fade-in 0.2s ease-out',
        }} onClick={() => { setShowReportModal(false); setReportReason(''); }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'rgba(30, 30, 45, 0.98)', borderRadius: '20px',
            padding: '28px', maxWidth: '380px', width: '90vw',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          }}>
            <h3 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 700, margin: '0 0 6px', textAlign: 'center' }}>
              🚩 Report {user.name}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', margin: '0 0 20px' }}>
              Select a reason for reporting this user.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {REPORT_REASONS.map(reason => (
                <button
                  key={reason}
                  onClick={() => setReportReason(reason)}
                  style={{
                    padding: '12px 16px', borderRadius: '12px', border: 'none',
                    background: reportReason === reason ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.04)',
                    color: reportReason === reason ? '#818CF8' : 'var(--text-primary)',
                    fontSize: '14px', textAlign: 'left', cursor: 'pointer',
                    fontWeight: reportReason === reason ? 600 : 400,
                    outline: reportReason === reason ? '1px solid rgba(99, 102, 241, 0.4)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  {reason}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => { setShowReportModal(false); setReportReason(''); }} style={{
                flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent', color: 'var(--text-primary)', fontSize: '14px',
                fontWeight: 600, cursor: 'pointer',
              }}>Cancel</button>
              <button
                onClick={handleReport}
                disabled={!reportReason}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                  background: reportReason ? '#EF4444' : 'rgba(239,68,68,0.3)',
                  color: '#fff', fontSize: '14px', fontWeight: 600,
                  cursor: reportReason ? 'pointer' : 'not-allowed',
                  opacity: reportReason ? 1 : 0.5,
                }}
              >Submit Report</button>
            </div>
          </div>
        </div>
      )}

      <div className="ig-profile-bio-modern">
        <h1 className="ig-display-name">{user.name}</h1>
        {user.username && <p className="ig-handle-tag">@{user.username}</p>}
        <p className="ig-college-tag">
          {user.college || 'Campus Press'}
          {user.branch && <span style={{ opacity: 0.6, margin: '0 6px' }}>•</span>}
          {user.branch}
          {user.department && <span style={{ opacity: 0.6, margin: '0 6px' }}>•</span>}
          {user.department}
        </p>
        <p className="ig-bio-text">{user.bio}</p>
      </div>

      <div className="ig-stats-container-modern stats-bar">
        <div className="ig-stat">
          <span className="ig-stat-value">{userPosts.length}</span>
          <span className="ig-stat-label">Posts</span>
        </div>
        <div className="ig-stat clickable" onClick={() => openFollowModal('followers')}>
          <span className="ig-stat-value">{followersCount >= 1000 ? (followersCount / 1000).toFixed(1) + 'k' : followersCount}</span>
          <span className="ig-stat-label">Followers</span>
        </div>
        <div className="ig-stat clickable" onClick={() => openFollowModal('following')}>
          <span className="ig-stat-value">{followingCount >= 1000 ? (followingCount / 1000).toFixed(1) + 'k' : followingCount}</span>
          <span className="ig-stat-label">Following</span>
        </div>
      </div>

      <div className="ig-profile-actions">
        {isMe ? (
          <Link href="/settings/about" className="ig-action-btn ig-action-btn-secondary" style={{ flex: 1 }}>
            Share Profile
          </Link>
        ) : (
          <>
            <button
              className={`ig-action-btn ${isFollowing ? 'ig-action-btn-following' : 'ig-action-btn-follow'}`}
              onClick={handleFollowToggle}
              style={{ flex: 2 }}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
            <Link href={`/messages?userId=${user.id}`} className="ig-action-btn ig-action-btn-message" style={{ flex: 2 }}>
              Message
            </Link>
          </>
        )}
      </div>

      {/* ─── Tabs ─── */}
      <div className="ig-tabs">
        <button
          className={`ig-tab ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill={activeTab === 'posts' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </button>
        {isMe && (
          <button
            className={`ig-tab ${activeTab === 'saved' ? 'active' : ''}`}
            onClick={() => setActiveTab('saved')}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill={activeTab === 'saved' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        )}
      </div>

      {/* ─── Grid ─── */}
      {displayPosts.length > 0 ? (
        <div className="ig-grid">
          {displayPosts.map(post => (
            <Link key={post.id} href={`/article/${post.slug}`} className="ig-grid-item">
              <img src={post.imageUrl} alt={post.title} loading="lazy" />
              <div className="ig-grid-overlay-premium">
                <span className="ig-grid-category" style={{ background: `${categoryColors[post.category] || '#6366f1'}40` }}>{post.category}</span>
                <h3 className="ig-grid-title">{post.title}</h3>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="ig-empty">
          <h2 className="ig-empty-title">{activeTab === 'saved' ? 'No Saved Posts' : 'No Posts Yet'}</h2>
          <p className="ig-empty-subtitle">{isMe ? "You haven't shared anything yet." : `${user.name} hasn't posted anything yet.`}</p>
        </div>
      )}

      {/* ─── Followers/Following Modal ─── */}
      {showFollowModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)', animation: 'fade-in 0.2s ease-out',
          zIndex: 9000,
        }} onClick={() => setShowFollowModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--surface)', borderRadius: '20px',
            maxWidth: '400px', width: '90vw', maxHeight: '70vh',
            border: '1px solid var(--border)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '16px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ width: '24px' }} />
              <h3 style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 700, margin: 0 }}>
                {showFollowModal.title}
              </h3>
              <button onClick={() => setShowFollowModal(null)} style={{
                background: 'transparent', border: 'none', color: 'var(--text-primary)',
                fontSize: '20px', cursor: 'pointer', padding: '4px'
              }}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {isFollowListLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                  <div className="spinner" style={{ width: '30px', height: '30px' }} />
                </div>
              ) : followList.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {followList.map((item) => (
                    <Link 
                      key={item.id} 
                      href={`/profile/${item.username || item.id}`} 
                      onClick={() => setShowFollowModal(null)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '12px', borderRadius: '12px', textDecoration: 'none',
                        transition: 'background 0.2s'
                      }}
                      className="follow-list-item"
                    >
                      <div style={{
                        width: '44px', height: '44px', borderRadius: '50%',
                        overflow: 'hidden', background: 'var(--surface-2)', border: '2px solid var(--border)'
                      }}>
                        {item.profilePicture ? (
                          <img src={item.profilePicture} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>👤</div>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{item.username || 'user'}</div>
                      </div>

                      {currentUserId && item.id !== currentUserId && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleListFollowToggle(item);
                          }}
                          style={{
                            padding: '6px 16px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 700,
                            border: myFollowingIds.has(item.id) ? '1px solid var(--border)' : 'none',
                            background: myFollowingIds.has(item.id) ? 'var(--surface-2)' : 'var(--primary)',
                            color: myFollowingIds.has(item.id) ? 'var(--text-primary)' : '#fff',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            minWidth: '90px'
                          }}
                        >
                          {myFollowingIds.has(item.id) ? 'Following' : 'Follow'}
                        </button>
                      )}
                    </Link>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: '14px' }}>No {showFollowModal.type} found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Unfollow Confirmation Modal */}
      {userToUnfollow && (
        <div className="modal-overlay" onClick={() => setUserToUnfollow(null)}>
          <div className="modal-content" style={{ maxWidth: '320px', padding: '24px 20px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {userToUnfollow.profilePicture ? (
                  <img src={userToUnfollow.profilePicture} alt={userToUnfollow.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                   <span style={{ fontSize: '32px' }}>{userToUnfollow.avatar || '👤'}</span>
                )}
              </div>
              <div>
                <p style={{ margin: '0 0 8px 0', fontSize: '15px', color: 'var(--text-primary)', fontWeight: 600 }}>Unfollow @{userToUnfollow.name}?</p>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Their posts will no longer show up in your home feed.</p>
              </div>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                <button 
                  onClick={confirmUnfollow}
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'var(--surface-2)', border: '1px solid var(--border)', color: '#EF4444', fontWeight: 600, cursor: 'pointer' }}
                >
                  Unfollow
                </button>
                <button 
                  onClick={() => setUserToUnfollow(null)}
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'var(--primary)', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
