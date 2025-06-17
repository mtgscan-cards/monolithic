// src/pages/LandingPage/LandingContent.tsx

import React from 'react'
import { Typography, Container } from '@mui/material'
import { motion, easeInOut } from 'framer-motion'
import ParticleNetwork from './ParticleNetwork'

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.2, duration: 0.6, ease: easeInOut },
  }),
}

const LandingContent: React.FC = () => {
  return (
    <main
      style={{
        position: 'relative',
        background: '#111',
        color: '#eee',
        paddingBottom: '6rem',
        overflow: 'hidden',
      }}
    >
      {/* Particle animation only within this section */}
      <ParticleNetwork />

      <Container maxWidth="md" style={{ paddingTop: '5rem', position: 'relative', zIndex: 1 }}>
        {[...Array(3)].map((_, i) => (
          <motion.section
            key={i}
            custom={i}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.6 }}
            variants={fadeInUp}
            style={{
              marginBottom: '4rem',
              padding: '2rem',
              background: '#1a1a1a',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            <Typography variant="h4" gutterBottom>
              {i === 0
                ? 'Scan Cards with Precision'
                : i === 1
                ? 'Build Collections Effortlessly'
                : 'Export, Share, and Sync'}
            </Typography>
            <Typography variant="body1" style={{ lineHeight: 1.6 }}>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur et
              velit vitae nunc consequat scelerisque. Sed imperdiet orci non purus
              elementum, a bibendum ex gravida. Fusce at urna felis.
            </Typography>
          </motion.section>
        ))}
      </Container>
    </main>
  )
}

export default LandingContent