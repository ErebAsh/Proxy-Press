import './profile.css';

export default function ProfileLoading() {
  return (
    <div className="profile-container feed-container extra-bottom-space" id="profile-page" style={{ width: '100%', maxWidth: '640px', margin: '0 auto', padding: '16px' }}>
      {/* Profile Header Card Skeleton */}
      <div className="card" style={{ padding: '24px', borderRadius: 'var(--radius-xl)', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', marginBottom: '24px' }}>
        {/* Profile Identity (Avatar + Name) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px', marginBottom: '20px' }}>
          {/* Avatar shimmer */}
          <div className="skeleton-shimmer" style={{ width: '96px', height: '96px', borderRadius: '50%' }} />
          
          {/* Display name & handle shimmer */}
          <div className="skeleton-shimmer" style={{ width: '180px', height: '24px', borderRadius: '6px' }} />
          <div className="skeleton-shimmer" style={{ width: '120px', height: '14px', borderRadius: '4px' }} />
        </div>

        {/* Bio text shimmer */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', marginBottom: '24px' }}>
          <div className="skeleton-shimmer" style={{ width: '90%', height: '12px', borderRadius: '4px' }} />
          <div className="skeleton-shimmer" style={{ width: '60%', height: '12px', borderRadius: '4px' }} />
        </div>

        {/* Stats Columns Skeleton */}
        <div style={{ display: 'flex', justifyContent: 'space-around', borderTop: '1.5px solid var(--border-light)', paddingTop: '16px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div className="skeleton-shimmer" style={{ width: '40px', height: '24px', borderRadius: '6px' }} />
              <div className="skeleton-shimmer" style={{ width: '60px', height: '10px', borderRadius: '4px' }} />
            </div>
          ))}
        </div>
      </div>

      {/* Profile Tab Bar Skeleton */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
        {['Stories', 'Saved'].map((tab, i) => (
          <div 
            key={i} 
            style={{ 
              flex: 1, 
              display: 'flex', 
              justifyContent: 'center', 
              padding: '12px 0', 
              borderBottom: i === 0 ? '2px solid var(--primary)' : '2px solid transparent' 
            }}
          >
            <div className="skeleton-shimmer" style={{ width: '60px', height: '16px', borderRadius: '4px' }} />
          </div>
        ))}
      </div>

      {/* Profile 3x3 Photo Grid Skeletons */}
      <div className="profile-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div 
            key={i} 
            className="profile-grid-item skeleton-shimmer" 
            style={{ 
              aspectRatio: '1', 
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--surface-2)' 
            }} 
          />
        ))}
      </div>
    </div>
  );
}
