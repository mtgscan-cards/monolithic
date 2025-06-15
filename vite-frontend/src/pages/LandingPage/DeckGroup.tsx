import React, { useRef, useState, useEffect } from 'react'
import { a, useSprings } from '@react-spring/three'
import { useFrame, useThree } from '@react-three/fiber'
import { Group } from 'three'
import CardMesh from './CardMesh'
import { CardImage } from './LandingPage'

const DeckGroup: React.FC<{ cards: CardImage[] }> = ({ cards }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const groupRef = useRef<Group>(null)
  const { size } = useThree()

  const radius = Math.min(6, size.width / 100)

  const [springs, api] = useSprings(cards.length, () => ({
    scale: 1,
    position: [0, 0, 0] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
    config: { mass: 1, tension: 250, friction: 20 },
  }))

  useEffect(() => {
    console.log(`📏 size.width = ${size.width}, radius = ${radius}`)

    api.start(index => {
      const angle = (2 * Math.PI * index) / cards.length
      const baseX = Math.cos(angle) * radius
      const baseZ = Math.sin(angle) * radius

      const dirX = baseX / radius
      const dirZ = baseZ / radius
      const isHovered = index === hoveredIndex
      const offset = isHovered ? 1 : 0

      const position = [
        baseX + dirX * offset,
        isHovered ? 0.5 : 0,
        baseZ + dirZ * offset,
      ] as [number, number, number]

      const rotation = [0, -angle + Math.PI / 2, 0] as [number, number, number]
      const scale = isHovered ? 1.1 : 1

      console.log(`🃏 Card ${index}: angle=${angle.toFixed(2)} base=(${baseX.toFixed(2)}, ${baseZ.toFixed(2)})`)
      console.log(`→ position=${position.map(v => v.toFixed(2))}, rotation=${rotation[1].toFixed(2)}, scale=${scale}`)

      return { position, rotation, scale }
    })
  }, [hoveredIndex, api, cards.length, radius, size.width])

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.0015
    }
  })

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {springs.map((style, i) => (
        <a.group
          key={cards[i].id}
          scale={style.scale as unknown as [number, number, number]}
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
