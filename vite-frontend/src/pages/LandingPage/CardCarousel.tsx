// vite-frontend/src/pages/LandingPage/CardCarousel.tsx

import React, { useEffect, useRef } from 'react'
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

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const CardCarousel: React.FC<CardCarouselProps> = ({ card, onCardClick }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const target = useRef({ x: 0.5, y: 0.5 })
  const current = useRef({ x: 0.5, y: 0.5 })

  useEffect(() => {
    const container = containerRef.current
    if (!container || !card) return

    const img = new Image()
    img.src = card.front

    img.onload = () => {
      container.innerHTML = `
        <div class="card" style="
          --rx: 0deg;
          --ry: 0deg;
          --tx: 0px;
          --ty: 0px;
          --s: 1;
          --mx: 50%;
          --my: 50%;
          --pointer-x: 50%;
          --pointer-y: 50%;
          --pointer-from-center: 0.5;
        ">
          <div class="card__translater">
            <button class="card__rotator" tabindex="0" aria-label="${card.name}" data-id="${card.id}">
              <div class="card__front">
                <img class="card__img" src="${card.front}" alt="${card.name}" />
                <div class="card__shine"></div>
                <div class="card__glare"></div>
              </div>
            </button>
          </div>
        </div>`

      const cardElem = container.querySelector<HTMLElement>('.card')
      if (!cardElem) return

      const update = () => {
        const jitter = 0.00001
        current.current.x = lerp(current.current.x, target.current.x, 0.1) + jitter
        current.current.y = lerp(current.current.y, target.current.y, 0.1) + jitter

        const px = current.current.x
        const py = current.current.y
        const fromCenter = Math.hypot(px - 0.5, py - 0.5)

        const maxRot = 25
        const rotX = clamp((0.5 - py) * maxRot * 2, -maxRot, maxRot)
        const rotY = clamp((px - 0.5) * maxRot * 2, -maxRot, maxRot)
        const tx = clamp(rotY * 1.2, -20, 20)
        const ty = clamp(rotX * 1.2, -20, 20)

        cardElem.style.setProperty('--rx', `${rotY}deg`)
        cardElem.style.setProperty('--ry', `${rotX}deg`)
        cardElem.style.setProperty('--tx', `${tx}px`)
        cardElem.style.setProperty('--ty', `${ty}px`)
        cardElem.style.setProperty('--mx', `${50 + rotY * 1.5}%`)
        cardElem.style.setProperty('--my', `${50 + rotX * 1.5}%`)
        cardElem.style.setProperty('--pointer-x', `${px * 100}%`)
        cardElem.style.setProperty('--pointer-y', `${py * 100}%`)
        cardElem.style.setProperty('--pointer-from-center', `${fromCenter}`)

        requestAnimationFrame(update)
      }

      const handleMouseMove = (e: MouseEvent) => {
        target.current.x = e.clientX / window.innerWidth
        target.current.y = e.clientY / window.innerHeight
      }

      window.addEventListener('mousemove', handleMouseMove)
      update()

      const handleClick = (e: MouseEvent) => {
        const btn = (e.target as HTMLElement).closest('.card__rotator') as HTMLElement
        if (btn && btn.dataset.id) onCardClick?.(btn.dataset.id)
      }

      container.addEventListener('click', handleClick)

      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        container.removeEventListener('click', handleClick)
      }
    }
  }, [card, onCardClick])

  return (
    <div
      className="card-carousel-wrapper"
    >
      <div className="card-carousel-showcase card-carousel-floating" ref={containerRef} />
    </div>
  )
}

export default CardCarousel
