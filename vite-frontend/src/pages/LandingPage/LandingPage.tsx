// src/pages/LandingPage/LandingPage.tsx

import React, { useEffect, useState } from 'react'
import { CircularProgress, Typography, Box } from '@mui/material'
import Deck3DScene from './Deck3DScene'
import OverlayUI from './OverlayUI'

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
      .then(res => res.json())
      .then(data => setCards(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ width: '100%', overflowX: 'hidden' }}>
      {/* Fullscreen canvas section */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100vh'
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

      {/* Scrollable content below */}
      <section style={{ padding: '4rem 2rem', background: '#111', color: '#eee' }}>
        <Box maxWidth="800px" margin="0 auto">
          <Typography variant="h4" gutterBottom>
            More Content Below
          </Typography>
          <Typography variant="body1">
            This section is now scrollable beneath the full-screen 3D canvas. Perfect for feature callouts, links, or info.
          </Typography>
        </Box>
      </section>
    </div>
  )
}

export default LandingPage