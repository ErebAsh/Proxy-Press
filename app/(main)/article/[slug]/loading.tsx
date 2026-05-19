export default function Loading() {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 16 }}>
      {/* Hero image */}
      <div
        className="skeleton-shimmer"
        style={{ width: "100%", height: 300, borderRadius: 12 }}
      />

      {/* Title */}
      <div
        className="skeleton-shimmer"
        style={{ width: "90%", height: 32, borderRadius: 8, marginTop: 24 }}
      />
      <div
        className="skeleton-shimmer"
        style={{ width: "60%", height: 32, borderRadius: 8, marginTop: 10 }}
      />

      {/* Author info: avatar + name + date */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20 }}>
        <div
          className="skeleton-shimmer"
          style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0 }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            className="skeleton-shimmer"
            style={{ width: 120, height: 14, borderRadius: 6 }}
          />
          <div
            className="skeleton-shimmer"
            style={{ width: 90, height: 12, borderRadius: 6 }}
          />
        </div>
      </div>

      {/* Divider */}
      <div
        className="skeleton-shimmer"
        style={{ width: "100%", height: 1, marginTop: 24, marginBottom: 24, opacity: 0.5 }}
      />

      {/* Article body lines */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="skeleton-shimmer" style={{ width: "100%", height: 14, borderRadius: 6 }} />
        <div className="skeleton-shimmer" style={{ width: "100%", height: 14, borderRadius: 6 }} />
        <div className="skeleton-shimmer" style={{ width: "92%", height: 14, borderRadius: 6 }} />
        <div className="skeleton-shimmer" style={{ width: "100%", height: 14, borderRadius: 6 }} />
        <div className="skeleton-shimmer" style={{ width: "85%", height: 14, borderRadius: 6 }} />
        <div style={{ height: 8 }} />
        <div className="skeleton-shimmer" style={{ width: "100%", height: 14, borderRadius: 6 }} />
        <div className="skeleton-shimmer" style={{ width: "97%", height: 14, borderRadius: 6 }} />
        <div className="skeleton-shimmer" style={{ width: "100%", height: 14, borderRadius: 6 }} />
        <div className="skeleton-shimmer" style={{ width: "70%", height: 14, borderRadius: 6 }} />
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 16, marginTop: 32 }}>
        <div className="skeleton-shimmer" style={{ width: 80, height: 36, borderRadius: 20 }} />
        <div className="skeleton-shimmer" style={{ width: 80, height: 36, borderRadius: 20 }} />
        <div className="skeleton-shimmer" style={{ width: 80, height: 36, borderRadius: 20 }} />
      </div>
    </div>
  );
}
