// vite-frontend/src/pages/LandingPage/LandingPage.tsx

import React, { useEffect, useState, Suspense } from 'react';
import OverlayUI from './OverlayUI';
import Deck3DScene from './Deck3DScene';
import { useInView } from 'react-intersection-observer';
import '../../styles/App.css';

// ✅ Lazy load non-critical components
const Footer = React.lazy(() => import('./Footer'));
const LandingContent = React.lazy(() => import('./LandingContent'));
const SiteStatsSection = React.lazy(() => import('./SiteStatsSection'));

export type CardImage = {
  id: string;
  name: string;
  number: number;
  front: string;
  back: string;
};

const LandingPage: React.FC = () => {
  const [cards, setCards] = useState<CardImage[]>([]);
  const [loading, setLoading] = useState(true);

  const [statsRef, statsInView] = useInView({
    triggerOnce: true,
    threshold: 0.2,
  });

  const [footerRef, footerInView] = useInView({
    triggerOnce: true,
    threshold: 0,
  });

  useEffect(() => {
    fetch('/cards/index.json')
      .then((res) => res.json())
      .then((data) => setCards(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      style={{
        width: '100%',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Hero Section */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '94vh',
          overflow: 'hidden',
          flexShrink: 0,
          display: 'flex',
          background: '#111',
        }}
      >
        <OverlayUI />

        {loading ? (
          <div style={{ color: '#111' }}>Loading cards...</div>
        ) : (
          <Deck3DScene cards={cards} />
        )}
      </div>

      {/* Main Content */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', padding: 0 }}>
        {loading || cards.length === 0 ? (
          <div style={{ flexGrow: 1, background: '#111' }} />
        ) : (
          <>
            {/* Lazy load LandingContent */}
            <Suspense fallback={null}>
              <LandingContent highlightCard={cards[0]} />
            </Suspense>

            {/* Lazy load SiteStatsSection when in view */}
            <div ref={statsRef}>
              {statsInView && (
                <Suspense fallback={null}>
                  <SiteStatsSection />
                </Suspense>
              )}
            </div>

            {/* Lazy load Footer when in view */}
            <div ref={footerRef} style={{ minHeight: 200 }}>
              {footerInView && (
                <Suspense fallback={null}>
                  <Footer />
                </Suspense>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LandingPage;
