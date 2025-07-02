// src/pages/LandingPage/DeckGroup.tsx

import React, { useRef, useMemo, useEffect, useState } from 'react'
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
    if (!existing.some(p => p.distanceTo(candidate) < radius)) return candidate
  }
  return getRandomPosition()
}

const DeckGroup: React.FC<{ cards: CardImage[] }> = ({ cards }) => {
  const groupRef = useRef<Group>(null!)
  const clockStartRef = useRef<number | null>(null)

  const validCards = useMemo(
    () => cards.filter(c => typeof c.front === 'string' && typeof c.back === 'string'),
    [cards]
  )

  const densityRadius = useMemo(() => {
    if (validCards.length <= 16) return 1.8
    if (validCards.length <= 32) return 1.4
    return 1.0
  }, [validCards.length])

  useEffect(() => {
    console.log(`[DeckGroup] Spawning ${validCards.length} cards with radius ${densityRadius}`)
  }, [validCards.length, densityRadius])

  const metadata = useMemo(() => {
    const positions: Vector3[] = []
    return validCards.map(() => {
      const pos = getNonOverlappingPosition(positions, densityRadius)
      positions.push(pos)
      return {
        pos,
        delay: Math.random() * 1.1 + 0.2,
        rotSpeed: Math.random() * 0.01 + 0.002,
      }
    })
  }, [validCards, densityRadius])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (clockStartRef.current === null) clockStartRef.current = t
    const localTime = t - clockStartRef.current

    const group = groupRef.current
    if (!group) return

    group.rotation.y += 0.002

    group.children.forEach((child, i) => {
      const meta = metadata[i]
      if (!meta) return

      const fadeT = Math.max(0, (localTime - meta.delay) * 2)
      const eased = fadeT >= 1 ? 1 : fadeT * fadeT * (3 - 2 * fadeT)

      if (!child.userData.activated && eased >= 1) {
        child.userData.activated = true
      }

      if (!child.userData.activated) {
        child.scale.setScalar(eased)
        if (!child.visible && eased > 0.01) child.visible = true
      }

      if (meta.rotSpeed > 0) {
        child.rotation.y += meta.rotSpeed
        child.rotation.x += meta.rotSpeed / 2
      }
    })
  })

  // Optional: spawn cards progressively in batches to reduce first-load stall
  const [spawnCount, setSpawnCount] = useState(8)
  useEffect(() => {
    if (spawnCount >= validCards.length) return
    const id = setInterval(() => {
      setSpawnCount(prev => Math.min(prev + 8, validCards.length))
    }, 50)
    return () => clearInterval(id)
  }, [spawnCount, validCards.length])

  return (
    <group ref={groupRef}>
      {validCards.slice(0, spawnCount).map((card, i) => (
        <group
          key={card.id ?? `${card.name}-${card.number}`}
          position={metadata[i].pos}
          scale={0.001}
          visible={false}
        >
          <CardMesh frontUrl={card.front} backUrl={card.back} scale={1} />
        </group>
      ))}
    </group>
  )
}

export default DeckGroup
