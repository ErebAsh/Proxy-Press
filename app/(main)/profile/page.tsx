'use client';

import { useIdentity } from '@/lib/IdentityContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProfileRedirectPage() {
  const { currentUserId } = useIdentity();
  const router = useRouter();

  useEffect(() => {
    if (currentUserId) {
      router.replace(`/profile/${currentUserId}`);
    } else {
      // If identity hasn't loaded yet, wait; if truly no user, go to login
      const timeout = setTimeout(() => {
        if (!currentUserId) {
          router.replace('/login');
        }
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [currentUserId, router]);

  // Show the existing profile loading skeleton while redirecting
  return (
    <div className="feed-container" style={{ maxWidth: 640, margin: '0 auto', padding: 16, paddingTop: 40 }}>
      {/* Cover photo skeleton */}
      <div className="skeleton-shimmer" style={{ width: '100%', height: 180, borderRadius: 16, marginBottom: 20 }} />
      {/* Avatar skeleton */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <div className="skeleton-shimmer" style={{ width: 80, height: 80, borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="skeleton-shimmer" style={{ width: '50%', height: 20, borderRadius: 6 }} />
          <div className="skeleton-shimmer" style={{ width: '30%', height: 14, borderRadius: 4 }} />
        </div>
      </div>
      {/* Stats skeleton */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
        <div className="skeleton-shimmer" style={{ width: 60, height: 40, borderRadius: 8 }} />
        <div className="skeleton-shimmer" style={{ width: 60, height: 40, borderRadius: 8 }} />
        <div className="skeleton-shimmer" style={{ width: 60, height: 40, borderRadius: 8 }} />
      </div>
    </div>
  );
}
