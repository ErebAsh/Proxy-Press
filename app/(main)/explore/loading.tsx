import './explore.css';

export default function ExploreLoading() {
  return (
    <div className="explore-container feed-container extra-bottom-space" id="explore-page" style={{ width: '100%', maxWidth: '640px', margin: '0 auto', padding: '16px' }}>
      {/* Header Skeleton */}
      <div className="explore-header-premium" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <div className="skeleton-shimmer" style={{ width: '120px', height: '32px', borderRadius: '8px' }} />
        <div className="skeleton-shimmer" style={{ width: '220px', height: '14px', borderRadius: '4px', marginBottom: '16px' }} />
        
        {/* Search Bar Skeleton */}
        <div className="skeleton-shimmer" style={{ width: '100%', maxWidth: '480px', height: '54px', borderRadius: '18px' }} />
      </div>

      {/* Categories Row Skeleton */}
      <div className="explore-filter-scroll" style={{ display: 'flex', gap: '10px', overflowX: 'hidden', marginBottom: '24px', paddingBottom: '4px' }}>
        {['All', 'Events', 'Notices', 'Sports', 'Academic', 'Clubs'].map((name, i) => (
          <div 
            key={i} 
            className="skeleton-shimmer" 
            style={{ 
              width: i === 0 ? '50px' : '75px', 
              height: '32px', 
              borderRadius: '9999px',
              flexShrink: 0
            }} 
          />
        ))}
      </div>

      {/* Grid Header Skeleton */}
      <div className="skeleton-shimmer" style={{ width: '130px', height: '22px', borderRadius: '6px', marginBottom: '16px' }} />

      {/* Asymmetric Explore Grid Skeletons */}
      <div className="explore-grid">
        {[0, 1, 2, 3].map((i) => {
          const isLarge = i === 0 || i % 5 === 0;
          return (
            <div 
              key={i} 
              className={`explore-item skeleton-shimmer ${isLarge ? 'large' : ''}`} 
              style={{ 
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--surface-2)',
                aspectRatio: isLarge ? '1.6' : '0.8'
              }}
            >
              {/* Overlay Content Placeholder */}
              <div style={{ position: 'absolute', bottom: '16px', left: '16px', right: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', width: '60px', height: '18px', borderRadius: '4px' }} />
                <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', width: '80%', height: '16px', borderRadius: '4px' }} />
                <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', width: '50%', height: '12px', borderRadius: '4px' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
