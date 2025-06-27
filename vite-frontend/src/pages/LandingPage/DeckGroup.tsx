// src/pages/LandingPage/DeckGroup.tsx

import React, { useRef, useMemo } from 'react'
import { Group, Vector3 } from 'three'
import { useFrame } from '@react-three/fiber'
import CardMesh from './CardMesh'
import { CardImage } from './LandingPage'

const getRandomPosition = (range = 20) =>
  new Vector3(
    (Math.random() - 0.5) * range,
    (Math.random() - 0.5) * range,
    (Math.random() - 0.5) * range
  )

const getNonOverlappingPosition = (
  existing: Vector3[],
  radius: number,
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
  const clockStartRef = useRef<number | null>(null)

  const validCards = useMemo(
    () =>
      cards.filter(c => typeof c.front === 'string' && typeof c.back === 'string'),
    [cards]
  )

  // Adjust spacing radius based on card count
  const densityRadius = useMemo(() => {
    if (validCards.length <= 16) return 1.8
    if (validCards.length <= 32) return 1.4
    return 1.0
  }, [validCards.length])

  console.log(`[DeckGroup] Spawning ${validCards.length} cards with radius ${densityRadius}`)

  const metadata = useMemo(() => {
    const positions: Vector3[] = []
    return validCards.map(() => {
      const pos = getNonOverlappingPosition(positions, densityRadius)
      positions.push(pos)
      return {
        pos,
        delay: Math.random() * 1.1 + 0.2, // 0.2s–1.2s per card
        rotSpeed: Math.random() * 0.01 + 0.002,
        opacity: 0,
      }
    })
  }, [validCards, densityRadius])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (clockStartRef.current === null) clockStartRef.current = t
    const localTime = t - clockStartRef.current

    if (groupRef.current) {
      groupRef.current.rotation.y += 0.002
      groupRef.current.children.forEach((child, i) => {
        const meta = metadata[i]
        if (!meta) return

        const fadeT = Math.max(0, (localTime - meta.delay) * 2) // fade-in over 0.5s
        const eased = fadeT >= 1 ? 1 : fadeT * fadeT * (3 - 2 * fadeT) // smoothstep easing

        child.scale.setScalar(eased)
        child.visible = eased > 0.01

        // subtle spinning
        child.rotation.y += meta.rotSpeed
        child.rotation.x += meta.rotSpeed / 2
      })
    }
  })

  return (
    <group ref={groupRef}>
      {validCards.map((card, i) => (
        <group key={card.id ?? `${card.name}-${card.number}`} position={metadata[i].pos} scale={0.001}>
          <CardMesh frontUrl={card.front} backUrl={card.back} scale={1} />
        </group>
      ))}
    </group>
  )
}

export default DeckGroup
