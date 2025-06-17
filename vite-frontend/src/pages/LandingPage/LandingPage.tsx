// src/pages/LandingPage/LandingPage.tsx

import React, { useEffect, useState } from 'react'
import { CircularProgress } from '@mui/material'
import Deck3DScene from './Deck3DScene'
import OverlayUI from './OverlayUI'
import CardCarousel from './CardCarousel'
import LandingContent from './LandingContent'

export type CardImage = {
  id?: string
  name: string
  number: number
  front: string
  back: string
}

const LandingPage: React.FC = () => {
  const [cards, setCards] = useState<CardImage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/cards/index.json')
      .then((res) => res.json())
      .then((data) => setCards(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ width: '100%', overflowX: 'hidden' }}>
      {/* Fullscreen 3D canvas */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100vh',
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
          >
            <CircularProgress />
          </div>
        ) : (
          <>
            <Deck3DScene cards={cards} />
            <OverlayUI />
          </>
        )}
      </div>

      {/* Carousel */}
      {!loading && cards.length > 0 && (
        <CardCarousel
          cards={cards}
          onCardClick={(id) => console.log('Clicked card:', id)}
        />
      )}

      {/* Post-3D content */}
      {!loading && <LandingContent />}
    </div>
  )
}

export default LandingPage
