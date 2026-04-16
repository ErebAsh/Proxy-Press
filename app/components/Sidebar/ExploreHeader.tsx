'use client';

import { useRouter } from 'next/navigation';
import './ExploreHeader.css';

export default function ExploreHeader() {
  const router = useRouter();

  return (
    <header className="explore-header">
      <div className="explore-header-container">
        <div className="explore-search-wrapper">
          <div className="explore-search-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input 
            type="text" 
            placeholder="Search on ProxyPress..." 
            className="explore-search-input"
            onFocus={() => {
              // Smoothly scroll to top when focused on mobile
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </div>
      </div>
    </header>
  );
}
