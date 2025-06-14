import React, { useRef, useState, useEffect } from 'react'
import { a, useSprings } from '@react-spring/three'
import { useFrame } from '@react-three/fiber'
import { Group } from 'three'
import CardMesh from './CardMesh'
import { CardImage } from './LandingPage'

const DeckGroup: React.FC<{ cards: CardImage[] }> = ({ cards }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const groupRef = useRef<Group>(null)

  const [springs, api] = useSprings(cards.length, () => ({
    scale: 1,
    position: [0, 0, 0] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
    config: { mass: 1, tension: 250, friction: 20 },
  }))

    useEffect(() => {
    api.start(index => {
        const angle = (2 * Math.PI * index) / cards.length
        const baseX = Math.cos(angle) * 6
        const baseZ = Math.sin(angle) * 6
        const baseY = 0

        const isHovered = index === hoveredIndex

        // Direction vector from carousel center to card (camera looks from +Z)
        const dirX = baseX / 6
        const dirZ = baseZ / 6
        const offset = isHovered ? 1 : 0

        return {
        position: [baseX + dirX * offset, baseY + 0.5 * (isHovered ? 1 : 0), baseZ + dirZ * offset],
        scale: isHovered ? 1.1 : 1,
        rotation: [0, -angle + Math.PI / 2, 0],
        }
    })
    }, [hoveredIndex, api, cards.length])

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.0015
    }
  })

  return (
    <group ref={groupRef}>
      {springs.map((style, i) => (
        <a.group
          key={cards[i].id}
          scale={style.scale}
          position={style.position as unknown as [number, number, number]}
          rotation={style.rotation as unknown as [number, number, number]}
          onPointerOver={() => setHoveredIndex(i)}
          onPointerOut={() => setHoveredIndex(null)}
        >
          <CardMesh imageUrl={cards[i].image_uris.png} />
        </a.group>
      ))}
    </group>
  )
}

export default DeckGroup
