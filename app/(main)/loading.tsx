export default function HomeLoading() {
  return (
    <div className="feed-container extra-bottom-space" style={{ width: '100%', maxWidth: '640px', margin: '0 auto', padding: '16px' }}>
      {/* Stories Section Skeleton */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '28px', overflowX: 'hidden', paddingBottom: '4px' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <div className="skeleton-shimmer" style={{ width: '64px', height: '64px', borderRadius: '50%' }} />
            <div className="skeleton-shimmer" style={{ width: '48px', height: '10px', borderRadius: '4px' }} />
          </div>
        ))}
      </div>

      {/* Main Feed Skeletons */}
      {[1, 2].map((card) => (
        <div 
          key={card} 
          className="card" 
          style={{ 
            padding: '16px', 
            marginBottom: '24px', 
            borderRadius: 'var(--radius-lg)', 
            backgroundColor: 'var(--surface)', 
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          {/* Header (Avatar & User Metadata) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <div className="skeleton-shimmer" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div className="skeleton-shimmer" style={{ width: '30%', height: '14px', borderRadius: '4px' }} />
              <div className="skeleton-shimmer" style={{ width: '20%', height: '10px', borderRadius: '4px' }} />
            </div>
            <div className="skeleton-shimmer" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />
          </div>

          {/* Title & Paragraph skeletons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            <div className="skeleton-shimmer" style={{ width: '80%', height: '18px', borderRadius: '4px' }} />
            <div className="skeleton-shimmer" style={{ width: '100%', height: '12px', borderRadius: '4px' }} />
            <div className="skeleton-shimmer" style={{ width: '90%', height: '12px', borderRadius: '4px' }} />
          </div>

          {/* Media/Image skeleton (16:9) */}
          <div className="skeleton-shimmer" style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 'var(--radius-md)', marginBottom: '16px' }} />

          {/* Footer Action Buttons */}
          <div style={{ display: 'flex', gap: '20px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <div className="skeleton-shimmer" style={{ width: '60px', height: '24px', borderRadius: '6px' }} />
            <div className="skeleton-shimmer" style={{ width: '60px', height: '24px', borderRadius: '6px' }} />
            <div className="skeleton-shimmer" style={{ width: '60px', height: '24px', borderRadius: '6px', marginLeft: 'auto' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
