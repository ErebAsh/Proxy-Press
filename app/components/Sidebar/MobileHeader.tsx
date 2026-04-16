'use client';

import Link from 'next/link';
import './MobileHeader.css';

export default function MobileHeader() {
  return (
    <header className="mobile-header">
      <div className="mobile-header-container">
        <div className="mobile-header-left">
          <Link href="/" className="mobile-logo-link">
            <span className="mobile-logo-text">
              Proxy<span className="mobile-logo-accent">Press</span>
            </span>
          </Link>
        </div>
        <div className="mobile-header-right">
          <button className="mobile-header-btn" aria-label="Messages">
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M22 2l-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
            <span className="mobile-header-badge">2</span>
          </button>
        </div>
      </div>
    </header>
  );
}
