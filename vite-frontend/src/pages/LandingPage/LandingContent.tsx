// vite-frontend/src/pages/LandingPage/LandingContent.tsx

import React, { useRef, useState, useEffect, Suspense } from 'react'
import { Typography, Container } from '@mui/material'
import { motion, easeInOut } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import type { CardImage } from './LandingPage'
import './LandingContent.css'

// Lazy load ParticleNetwork and CardCarousel to reduce initial load time
const ParticleNetwork = React.lazy(() => import('./ParticleNetwork'))
const CardCarousel = React.lazy(() => import('./CardCarousel'))

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
  const triggerRef = useRef<HTMLDivElement>(null)
  const [cardVisible, setCardVisible] = useState(false)

  const [particleRef, particleInView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  useEffect(() => {
    const triggerEl = triggerRef.current
    if (!triggerEl) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setCardVisible(true)
          observer.disconnect()
        }
      },
      {
        root: null,
        threshold: 0.1,
        rootMargin: '0px',
      }
    )

    observer.observe(triggerEl)

    // Immediate fallback check
    requestAnimationFrame(() => {
      const rect = triggerEl.getBoundingClientRect()
      if (rect.top < window.innerHeight) {
        setCardVisible(true)
        observer.disconnect()
      }
    })

    return () => observer.disconnect()
  }, [])

  return (
    <main
      style={{
        position: 'relative',
        background: 'transparent',
        color: '#eee',
        overflow: 'visible',
        zIndex: 0,
      }}
    >
      {/* Particle background deferred */}
      <div
        ref={particleRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >
        {particleInView && (
          <Suspense fallback={null}>
            <ParticleNetwork />
          </Suspense>
        )}
      </div>

      {/* Foreground UI */}
      <Container
        maxWidth="lg"
        style={{
          paddingTop: '1rem',
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '4rem',
        }}
      >
        <div ref={triggerRef} style={{ height: '1px' }} />

        <div className="landing-row">
          <div className="info-column">
            {[
              {
                title: 'Scan Cards with Precision',
                body: 'Try out the powerful custom scanner that delivers fast, accurate results with just a phone or webcam.',
              },
              {
                title: 'Build Collections Effortlessly',
                body: 'Add, track, and manage an unlimited number of cards. Export your lists or sync them across devices.',
              },
            ].map((section, i) => (
              <motion.section
                key={i}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.6 }}
                variants={fadeInUp}
                className="glow-block"
              >
                <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
                  {section.title}
                </Typography>
                <Typography variant="body1" style={{ lineHeight: 1.6 }}>
                  {section.body}
                </Typography>
              </motion.section>
            ))}
          </div>

          {highlightCard && cardVisible && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.6, ease: 'easeOut' }}
              className="highlight-card-container"
            >
              <Suspense fallback={null}>
                <CardCarousel card={highlightCard} onCardClick={onCardClick} />
              </Suspense>
            </motion.div>
          )}
        </div>

        <motion.section
          custom={3}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.6 }}
          variants={fadeInUp}
          className="glow-block glow-block--wide"
          style={{ marginBottom: '4rem' }}
        >
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
            Export, Share, and Sync
          </Typography>
          <Typography variant="body1" style={{ lineHeight: 1.6 }}>
            Upload your collections, store decks, and sync your cards to the cloud using the only open-source card database that updates every single day.
          </Typography>
        </motion.section>
      </Container>
    </main>
  )
}

export default LandingContent
