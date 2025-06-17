// src/components/CardCarousel.tsx

import React, { useRef, useState } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { TextureLoader } from 'three'
import { OrbitControls } from '@react-three/drei'
import { CardImage } from './LandingPage'
import './CardCarousel.css'

interface CardCarouselProps {
  cards: CardImage[]
  onCardClick?: (id: string) => void
}

const CardBlock: React.FC<{
  imageUrl: string
  position: [number, number, number]
  rotation: [number, number, number]
  onClick?: () => void
}> = ({ imageUrl, position, rotation, onClick }) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  const texture = useLoader(TextureLoader, imageUrl)

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x = hovered
        ? THREE.MathUtils.lerp(meshRef.current.rotation.x, -0.1, 0.1)
        : THREE.MathUtils.lerp(meshRef.current.rotation.x, 0, 0.1)

      meshRef.current.position.y = hovered
        ? THREE.MathUtils.lerp(meshRef.current.position.y, 0.3, 0.1)
        : THREE.MathUtils.lerp(meshRef.current.position.y, 0, 0.1)

      meshRef.current.scale.setScalar(hovered ? 1.08 : 1)
    }
  })

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={onClick}
    >
      <boxGeometry args={[2.5, 3.5, 0.005]} />
      <meshStandardMaterial
        map={texture}
        transparent
        alphaTest={0.1}
        roughness={0.85}
        metalness={0.03}
        toneMapped={false}
        color={'white'}
      />
    </mesh>
  )
}

const CardGroup: React.FC<{
  cards: CardImage[]
  onCardClick?: (id: string) => void
}> = ({ cards, onCardClick }) => {
  const radius = 9
  const angleStep = Math.PI / 9
  const centerOffset = (cards.length - 1) * angleStep * 0.5

  return (
    <group position={[0, 1, 0]}>
      {cards.map((card, i) => {
        const angle = i * angleStep - centerOffset
        const x = radius * Math.sin(angle)
        const z = radius * Math.cos(angle)
        return (
          <CardBlock
            key={card.id ?? `${card.name}-${card.number}`}
            imageUrl={card.front}
            position={[x, 0, z]}
            rotation={[0, -angle, 0]}
            onClick={() => onCardClick?.(card.id ?? '')}
          />
        )
      })}
    </group>
  )
}

const CardCarousel: React.FC<CardCarouselProps> = ({ cards, onCardClick }) => {
  const visibleCards = cards.slice(0, 7)

  return (
    <div className="carousel-3d-wrapper">
      <Canvas
        camera={{ position: [0, 6.5, 13], fov: 40 }}
        style={{ width: '100%', height: '500px' }}
      >
        {/* Realistic but performant lighting */}
        <hemisphereLight color="#e5e5e5" groundColor="#1a1a1a" intensity={0.9} />
        <ambientLight intensity={0.95} />
        <directionalLight position={[5, 7, 5]} intensity={0.8} />

        <CardGroup cards={visibleCards} onCardClick={onCardClick} />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          rotateSpeed={0.35}
          maxPolarAngle={Math.PI / 2.2}
          minPolarAngle={Math.PI / 2.2}
        />
      </Canvas>
    </div>
  )
}

export default CardCarousel