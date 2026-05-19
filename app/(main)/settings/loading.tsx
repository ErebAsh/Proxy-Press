export default function SettingsLoading() {
  return (
    <div style={{ padding: '20px', paddingTop: 'calc(20px + env(safe-area-inset-top))', width: '100%', maxWidth: '640px', margin: '0 auto' }}>
      {/* Header Skeleton */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
        <div className="skeleton-shimmer" style={{ width: '24px', height: '24px', borderRadius: '6px' }} />
        <div className="skeleton-shimmer" style={{ width: '120px', height: '24px', borderRadius: '6px' }} />
      </div>

      {/* Settings Groups Skeleton */}
      {[1, 2, 3].map((group) => (
        <div key={group} style={{ marginBottom: '28px' }}>
          {/* Group Title shimmer */}
          <div className="skeleton-shimmer" style={{ width: '100px', height: '14px', borderRadius: '4px', marginBottom: '16px' }} />
          
          {/* Group Items list */}
          {[1, 2].map((item) => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
              {/* Circular setting icon shimmer */}
              <div className="skeleton-shimmer" style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0 }} />
              
              {/* Text label shimmers */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div className="skeleton-shimmer" style={{ width: '40%', height: '15px', borderRadius: '4px' }} />
                <div className="skeleton-shimmer" style={{ width: '60%', height: '11px', borderRadius: '4px' }} />
              </div>
              
              {/* Chevron icon shimmer */}
              <div className="skeleton-shimmer" style={{ width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0 }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
