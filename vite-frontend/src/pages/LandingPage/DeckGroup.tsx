// src/pages/LandingPage/DeckGroup.tsx

import React, { useRef, useEffect } from 'react'
import { Group, Vector3 } from 'three'
import { useFrame } from '@react-three/fiber'
import CardMesh from './CardMesh'
import { CardImage } from './LandingPage'

// Spread cards out in a cube-ish range
const getRandomPosition = (range = 20) =>
  new Vector3(
    (Math.random() - 0.5) * range,
    (Math.random() - 0.5) * range,
    (Math.random() - 0.5) * range
  )

// Keep new cards from overlapping
const getNonOverlappingPosition = (
  existing: Vector3[],
  radius = 1.2,
  maxAttempts = 100
): Vector3 => {
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = getRandomPosition()
    const tooClose = existing.some(p => p.distanceTo(candidate) < radius)
    if (!tooClose) return candidate
  }
  return getRandomPosition()
}

const DeckGroup: React.FC<{ cards: CardImage[] }> = ({ cards }) => {
  const groupRef = useRef<Group>(null!)

  // Ensure each card has valid front/back image URLs
  const validCards = cards.filter(
    card => typeof card.front === 'string' && typeof card.back === 'string'
  )

  // Precompute randomized position/rotation metadata
  const positions: Vector3[] = []
  const generated = validCards.map(() => {
    const pos = getNonOverlappingPosition(positions, 1.2)
    positions.push(pos)
    return {
      pos,
      rotSpeed: Math.random() * 0.01 + 0.001,
    }
  })

  const cardRefs = useRef<{ pos: Vector3; rotSpeed: number }[]>(generated)

  useFrame(() => {
    if (!groupRef.current) return
    groupRef.current.rotation.y += 0.002

    groupRef.current.children.forEach((child, i) => {
      const ref = cardRefs.current[i]
      if (!ref) return // ✅ Safe guard
      child.rotation.y += ref.rotSpeed
      child.rotation.x += ref.rotSpeed / 2
    })
  })

  useEffect(() => {
    if (validCards.length < cards.length) {
      console.warn(
        `⚠️ Skipping ${cards.length - validCards.length} invalid card(s) missing front/back`
      )
    }
  }, [cards, validCards])

  return (
    <group ref={groupRef}>
      {validCards.map((card, i) => (
        <group key={card.id ?? `${card.name}-${card.number}`} position={cardRefs.current[i]?.pos}>
          <CardMesh frontUrl={card.front} backUrl={card.back} scale={1} />
        </group>
      ))}
    </group>
  )
}

export default DeckGroup
