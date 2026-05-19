export default function NotificationsLoading() {
  return (
    <div
      className="feed-container"
      style={{ maxWidth: 640, margin: '0 auto', paddingTop: 20 }}
    >
      {/* Section label skeleton – "Today" */}
      <div style={{ marginBottom: 16 }}>
        <div
          className="skeleton-shimmer"
          style={{
            width: 60,
            height: 16,
            borderRadius: 4,
          }}
        />
      </div>

      {/* Card container */}
      <div
        style={{
          background: 'var(--card, #fff)',
          borderRadius: 12,
          border: '1px solid var(--border, #e5e7eb)',
          overflow: 'hidden',
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            {i > 0 && (
              <div
                style={{
                  height: 1,
                  background: 'var(--border, #e5e7eb)',
                }}
              />
            )}

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '14px 16px',
              }}
            >
              {/* Circular avatar */}
              <div
                className="skeleton-shimmer"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  flexShrink: 0,
                }}
              />

              {/* Text content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Actor name + message line */}
                <div
                  className="skeleton-shimmer"
                  style={{
                    width: '85%',
                    height: 14,
                    borderRadius: 4,
                    marginBottom: 8,
                  }}
                />
                {/* Second line of message */}
                <div
                  className="skeleton-shimmer"
                  style={{
                    width: '60%',
                    height: 14,
                    borderRadius: 4,
                    marginBottom: 10,
                  }}
                />
                {/* Timestamp */}
                <div
                  className="skeleton-shimmer"
                  style={{
                    width: 50,
                    height: 10,
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
