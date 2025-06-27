// vite-frontend/src/pages/LandingPage/LandingPage.tsx

import React, { useEffect, useState } from 'react'
import Deck3DScene from './Deck3DScene'
import OverlayUI from './OverlayUI'
import LandingContent from './LandingContent'
import SiteStatsSection from './SiteStatsSection'
import Footer from './Footer'
import { useInView } from 'react-intersection-observer'

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
        }}
      >
        {loading ? (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
            }}
          />
        ) : (
          <>
            <Deck3DScene cards={cards} />
            <OverlayUI />
          </>
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
            <Footer />
          </>
        )}
      </div>
    </div>
  )
}

export default LandingPage
