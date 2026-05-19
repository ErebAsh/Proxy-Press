export default function MessagesLoading() {
  return (
    <div style={{ padding: '20px', paddingTop: 'calc(20px + env(safe-area-inset-top))', width: '100%', maxWidth: '640px', margin: '0 auto' }}>
      {/* Search Inbox Row Skeleton */}
      <div className="skeleton-shimmer" style={{ width: '100%', height: '50px', borderRadius: '12px', marginBottom: '24px' }} />
      
      {/* Inbox Thread List Skeletons */}
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
          {/* Circular avatar shimmer */}
          <div className="skeleton-shimmer" style={{ width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0 }} />
          
          {/* Info blocks */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="skeleton-shimmer" style={{ width: '35%', height: '14px', borderRadius: '4px' }} />
              <div className="skeleton-shimmer" style={{ width: '15%', height: '10px', borderRadius: '4px' }} />
            </div>
            <div className="skeleton-shimmer" style={{ width: '65%', height: '12px', borderRadius: '4px' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
