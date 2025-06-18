import React, { useEffect, useState } from 'react'
import { CircularProgress } from '@mui/material'
import { motion } from 'framer-motion'
import Deck3DScene from './Deck3DScene'
import OverlayUI from './OverlayUI'
import LandingContent from './LandingContent'

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

  useEffect(() => {
    fetch('/cards/index.json')
      .then((res) => res.json())
      .then((data) => setCards(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ width: '100%', overflowX: 'hidden' }}>
      {/* Fullscreen 3D Canvas */}
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

      {/* Fixed Card Display (no scroll trigger needed) */}
      {cards.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            top: '50%',
            right: '8%',
            transform: 'translateY(-50%)',
            zIndex: 100,
            pointerEvents: 'none',
          }}
        >
        </motion.div>
      )}

      {/* Landing Content */}
{!loading && cards.length > 0 && (
  <LandingContent highlightCard={cards[0]} />
)}
    </div>
  )
}

export default LandingPage
