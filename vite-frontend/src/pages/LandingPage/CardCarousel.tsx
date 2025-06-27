// vite-frontend/src/pages/LandingPage/CardCarousel.tsx

import React, { useEffect, useRef, useState } from 'react'
import { useInView } from 'react-intersection-observer'
import './CardCarousel.css'

export interface CardImage {
  id: string
  name: string
  front: string
}

interface CardCarouselProps {
  card: CardImage
  onCardClick?: (id: string) => void
}

type CSSVarStyle = React.CSSProperties & {
  '--rx'?: string
  '--ry'?: string
  '--tx'?: string
  '--ty'?: string
  '--s'?: number | string
  '--pointer-x'?: string
  '--pointer-y'?: string
  '--pointer-from-center'?: number | string
  '--mx'?: string
  '--my'?: string
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const CardCarousel: React.FC<CardCarouselProps> = ({ card, onCardClick }) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const target = useRef({ x: 0.5, y: 0.5 })
  const current = useRef({ x: 0.5, y: 0.5 })
  const resetTimer = useRef<number | null>(null)
  const animationFrame = useRef<number | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)

  const { ref: observerRef, inView } = useInView({ triggerOnce: true, threshold: 0.1 })

  const resetTarget = () => {
    target.current.x = 0.5
    target.current.y = 0.5
  }

  const scheduleReset = () => {
    if (resetTimer.current !== null) {
      clearTimeout(resetTimer.current)
    }
    resetTimer.current = window.setTimeout(resetTarget, 1000)
  }

  useEffect(() => {
    if (!imageLoaded || !inView) return
    const el = cardRef.current
    if (!el) return

    const update = () => {
      current.current.x = lerp(current.current.x, target.current.x, 0.1)
      current.current.y = lerp(current.current.y, target.current.y, 0.1)

      const px = current.current.x
      const py = current.current.y
      const fromCenter = Math.hypot(px - 0.5, py - 0.5)

      const maxRot = 25
      const rotX = clamp((0.5 - py) * maxRot * 2, -maxRot, maxRot)
      const rotY = clamp((px - 0.5) * maxRot * 2, -maxRot, maxRot)
      const tx = clamp(rotY * 1.2, -20, 20)
      const ty = clamp(rotX * 1.2, -20, 20)

      el.style.setProperty('--rx', `${rotY}deg`)
      el.style.setProperty('--ry', `${rotX}deg`)
      el.style.setProperty('--tx', `${tx}px`)
      el.style.setProperty('--ty', `${ty}px`)
      el.style.setProperty('--mx', `${50 + rotY * 1.5}%`)
      el.style.setProperty('--my', `${50 + rotX * 1.5}%`)
      el.style.setProperty('--pointer-x', `${px * 100}%`)
      el.style.setProperty('--pointer-y', `${py * 100}%`)
      el.style.setProperty('--pointer-from-center', `${fromCenter}`)

      animationFrame.current = requestAnimationFrame(update)
    }

    const isTouch = 'ontouchstart' in window

    const handleMouseMove = (e: MouseEvent) => {
      if (isTouch) return
      target.current.x = e.clientX / window.innerWidth
      target.current.y = e.clientY / window.innerHeight
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      target.current.x = t.clientX / window.innerWidth
      target.current.y = t.clientY / window.innerHeight
      scheduleReset()
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      target.current.x = t.clientX / window.innerWidth
      target.current.y = t.clientY / window.innerHeight
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })

    animationFrame.current = requestAnimationFrame(update)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current)
      if (resetTimer.current) clearTimeout(resetTimer.current)
    }
  }, [imageLoaded, inView])

  const handleClick = () => {
    onCardClick?.(card.id)
  }

  const initialStyle: CSSVarStyle = {
    '--rx': '0deg',
    '--ry': '0deg',
    '--tx': '0px',
    '--ty': '0px',
    '--s': 1,
    '--pointer-x': '50%',
    '--pointer-y': '50%',
    '--pointer-from-center': 0.5,
  }

  return (
    <div className="card-carousel-wrapper" ref={observerRef}>
      <div className="card-carousel-showcase card-carousel-floating">
        <div className="card-carousel-card" ref={cardRef} style={initialStyle}>
          <div className="card__translater">
            <button
              className="card__rotator"
              aria-label={card.name}
              onClick={handleClick}
            >
              <div className="card__front">
                <img
                  className="card__img"
                  src={card.front}
                  alt={card.name}
                  draggable={false}
                  loading="lazy"
                  onLoad={() => setImageLoaded(true)}
                />
                {imageLoaded && inView && <div className="card__shine" />}
                {imageLoaded && inView && <div className="card__glare" />}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CardCarousel
