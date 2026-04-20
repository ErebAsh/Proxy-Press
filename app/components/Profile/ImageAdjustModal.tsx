'use client';

import React, { useState, useRef } from 'react';

interface ImageAdjustModalProps {
  imageUrl: string;
  onSave: (position: { x: number, y: number }) => void;
  onClose: () => void;
}

export default function ImageAdjustModal({ imageUrl, onSave, onClose }: ImageAdjustModalProps) {
  const [position, setPosition] = useState({ x: 50, y: 50 }); // percentages for objectPosition
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const startPosition = useRef({ x: 50, y: 50 });
  
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    startPosition.current = { ...position };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;

    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    
    // Convert pixel movement to approximate percentage movement
    // Based on container size
    const rect = containerRef.current.getBoundingClientRect();
    const percentX = dx / rect.width * 100;
    const percentY = dy / rect.height * 100;
    
    // Invert because sliding left should move image right
    const newX = Math.max(0, Math.min(100, startPosition.current.x - percentX));
    const newY = Math.max(0, Math.min(100, startPosition.current.y - percentY));
    
    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 3000 }}>
      <div className="modal-content" style={{ maxWidth: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h2 className="modal-title" style={{ marginBottom: '16px' }}>Adjust Image</h2>
        <p className="modal-text" style={{ marginBottom: '24px', fontSize: '14px', opacity: 0.8 }}>
          Drag to adjust the center of your profile picture.
        </p>

        <div 
          ref={containerRef}
          style={{
            width: '240px',
            height: '240px',
            borderRadius: '50%',
            overflow: 'hidden',
            border: '4px solid var(--surface-2)',
            backgroundColor: '#000',
            position: 'relative'
          }}
        >
          <img 
            src={imageUrl} 
            alt="Adjustable preview"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: `${position.x}% ${position.y}%`,
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              WebkitUserDrag: 'none'
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        </div>

        <div className="modal-buttons" style={{ width: '100%', marginTop: '32px' }}>
          <button onClick={onClose} className="close-btn">
            Cancel
          </button>
          <button onClick={() => onSave(position)} className="confirm-btn">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
