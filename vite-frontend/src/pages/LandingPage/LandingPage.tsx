// vite-frontend/src/pages/LandingPage/LandingPage.tsx

import React, { useEffect, useState, Suspense } from 'react'
import OverlayUI from './OverlayUI'
import LandingContent from './LandingContent'
import SiteStatsSection from './SiteStatsSection'
import { useInView } from 'react-intersection-observer'
import '../../styles/App.css'

// Lazy load Footer to improve first paint
const Footer = React.lazy(() => import('./Footer'))
const Deck3DScene = React.lazy(() => import('./Deck3DScene'))

export type CardImage = {
  id: string
  name: string
  number: number
  front: string
  back: string
}

const LandingPage: React.FC = () => {
  const [cards, setCards] = useState<CardImage[]>([])
  const [loading, setLoading] = useState(true)

  const [statsRef, statsInView] = useInView({
    triggerOnce: true,
    threshold: 0.2,
  })

  const [footerRef, footerInView] = useInView({
    triggerOnce: true,
    threshold: 0,
  })

  // Fetch cards immediately on mount
  useEffect(() => {
    fetch('/cards/index.json')
      .then((res) => res.json())
      .then((data) => setCards(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

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
      {/* Top 3D Scene */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '94vh',
          overflow: 'hidden',
          flexShrink: 0,
          display: 'flex',
          background: '#111', // immediate dark background for LCP
        }}
      >
        {/* OverlayUI for fast LCP */}
        <OverlayUI />

        {loading ? (
          <div
            style={{
              color: '#111',
            }}
          >
            Loading cards...
          </div>
        ) : (
          <Suspense
            fallback={
              <div
                style={{
                  color: '#111'
                }}
              >
                Loading 3D scene...
              </div>
            }
          >
            <Deck3DScene cards={cards} />
          </Suspense>
        )}
      </div>

      {/* Content below 3D scene */}
      <div
        style={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
        }}
      >
        {loading || cards.length === 0 ? (
          <div style={{ flexGrow: 1, background: '#111' }} />
        ) : (
          <>
            <LandingContent highlightCard={cards[0]} />

            <div ref={statsRef}>
              {statsInView && <SiteStatsSection />}
            </div>

            {/* Footer deferred rendering */}
            <div ref={footerRef} style={{ minHeight: 200 }}>
              {footerInView && (
                <Suspense
                  fallback={
                    <div
                      style={{
                        color: '#888',
                        textAlign: 'center',
                        padding: '1rem',
                      }}
                    >
                      Loading footer...
                    </div>
                  }
                >
                  <Footer />
                </Suspense>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default LandingPage
