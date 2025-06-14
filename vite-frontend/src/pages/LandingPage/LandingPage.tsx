// src/pages/LandingPage/LandingPage.tsx
import React, { useEffect, useState } from 'react'
import { Box, CircularProgress } from '@mui/material'
import Deck3DScene from './Deck3DScene'
import OverlayUI from './OverlayUI'

export type CardImage = {
  id: string
  name: string
  image_uris: { png: string }
}

const LandingPage: React.FC = () => {
  const [cards, setCards] = useState<CardImage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/cards/random?limit=8`)
      .then(res => res.json())
      .then(data => setCards(data.results))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <Box sx={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {loading ? (
        <CircularProgress sx={{ position: 'absolute', top: '50%', left: '50%' }} />
      ) : (
        <>
          <Deck3DScene cards={cards} />
          <OverlayUI />
        </>
      )}
    </Box>
  )
}

export default LandingPage