export default function CreateLoading() {
  return (
    <div
      className="feed-container"
      style={{ maxWidth: 640, margin: "0 auto", padding: 16 }}
    >
      {/* Header / Title */}
      <div
        className="skeleton-shimmer"
        style={{
          width: 160,
          height: 28,
          borderRadius: 6,
          marginBottom: 24,
        }}
      />

      {/* Content text area */}
      <div
        className="skeleton-shimmer"
        style={{
          width: "100%",
          height: 200,
          borderRadius: 8,
          marginBottom: 16,
        }}
      />

      {/* Image upload zone */}
      <div
        style={{
          width: "100%",
          height: 120,
          borderRadius: 8,
          border: "2px dashed rgba(128,128,128,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <div
          className="skeleton-shimmer"
          style={{ width: 48, height: 48, borderRadius: 8 }}
        />
      </div>

      {/* Category / tag pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {[72, 88, 64, 96, 72].map((w, i) => (
          <div
            key={i}
            className="skeleton-shimmer"
            style={{
              width: w,
              height: 28,
              borderRadius: 9999,
            }}
          />
        ))}
      </div>

      {/* Submit button */}
      <div
        className="skeleton-shimmer"
        style={{
          width: 120,
          height: 40,
          borderRadius: 8,
          marginLeft: "auto",
        }}
      />
    </div>
  );
}
