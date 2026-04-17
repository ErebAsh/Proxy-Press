'use client';

import { useState, useEffect } from 'react';
import './SplashScreen.css';

export default function SplashScreen() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // We wait for hydration then trigger the fade out
    // A small delay ensures the user sees the beautiful animation
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`splash-screen ${!isVisible ? 'fade-out' : ''}`}>
      <div className="news-line"></div>
      <div className="news-line"></div>
      <div className="news-line"></div>
      <div className="news-line"></div>
      
      <div className="splash-bg-ripples">
        <div className="ripple"></div>
        <div className="ripple"></div>
        <div className="ripple"></div>
        <div className="ripple"></div>
      </div>

      <div className="splash-container">
        <div className="splash-logo-reveal">
          <span className="splash-logo-text">Proxy-Press</span>
        </div>
        <div className="splash-loader-bar">
          <div className="splash-loader-progress"></div>
        </div>
      </div>
    </div>
  );
}
