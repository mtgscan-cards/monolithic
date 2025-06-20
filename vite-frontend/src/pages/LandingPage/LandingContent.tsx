// src/pages/LandingPage/LandingContent.tsx

import React, { useRef, useState, useEffect } from 'react'
import { Typography, Container } from '@mui/material'
import { motion, easeInOut, useInView } from 'framer-motion'
import ParticleNetwork from './ParticleNetwork'
import CardCarousel from './CardCarousel'
import type { CardImage } from './LandingPage'
import './LandingContent.css'

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.2, duration: 0.6, ease: easeInOut },
  }),
}

interface LandingContentProps {
  highlightCard?: CardImage
  onCardClick?: (id: string) => void
}

const LandingContent: React.FC<LandingContentProps> = ({ highlightCard, onCardClick }) => {
  const triggerRef = useRef(null)
  const inView = useInView(triggerRef, { margin: '-20% 0px -20% 0px' })
  const [cardVisible, setCardVisible] = useState(false)

  useEffect(() => {
    if (inView) setCardVisible(true)
  }, [inView])

  return (
    <>
      <main
        style={{
          position: 'relative',
          background: '#111',
          color: '#eee',
          overflow: 'hidden',
          zIndex: 0,
        }}
      >
        <ParticleNetwork />

        <Container
          maxWidth="lg"
          style={{
            paddingTop: '1rem',
            position: 'relative',
            zIndex: 1,
            display: 'flex',
           flexDirection: 'column',
            gap: '4rem',
          } }
        >
          <div ref={triggerRef} style={{ height: '1px' }} />

          {/* Row with content blocks + card */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '3rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4rem' }}>
              {[0, 1].map((i) => (
                <motion.section
                  key={i}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.6 }}
                  variants={fadeInUp}
                  className="glow-block"
                  style={{
                    width: '540px',
                    padding: '2rem',
                    background: '#1a1a1a',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <Typography variant="h4" gutterBottom>
                    {i === 0
                      ? 'Scan Cards with Precision'
                      : 'Build Collections Effortlessly'}
                  </Typography>
                  <Typography variant="body1" style={{ lineHeight: 1.6 }}>
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur et
                    velit vitae nunc consequat scelerisque. Sed imperdiet orci non purus
                    elementum, a bibendum ex gravida. Fusce at urna felis.
                  </Typography>
                </motion.section>
              ))}
            </div>

            {highlightCard && cardVisible && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                style={{
                  width: '360px',
                  minHeight: '350px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  flexShrink: 0,
                }}
              >
                <CardCarousel card={highlightCard} onCardClick={onCardClick} />
              </motion.div>
            )}
          </div>

          <motion.section
            custom={2}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.6 }}
            variants={fadeInUp}
            className="glow-block"
            style={{
              alignSelf: 'flex-start',
              width: '100%',
              padding: '2rem',
              marginBottom: '4rem',
              background: '#1a1a1a',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Typography variant="h4" gutterBottom>
              Export, Share, and Sync
            </Typography>
            <Typography variant="body1" style={{ lineHeight: 1.6 }}>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur et velit vitae nunc
              consequat scelerisque. Sed imperdiet orci non purus elementum, a bibendum ex gravida.
              Fusce at urna felis.
            </Typography>
          </motion.section>
        </Container>
      </main>
    </>
  )
}

export default LandingContent
