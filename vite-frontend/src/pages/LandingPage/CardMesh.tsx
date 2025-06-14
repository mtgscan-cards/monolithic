// src/pages/LandingPage/CardMesh.tsx
import React from 'react'
import { useLoader } from '@react-three/fiber'
import { TextureLoader } from 'three'

interface CardMeshProps {
  imageUrl: string
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const CardMesh: React.FC<CardMeshProps> = ({ imageUrl, position, rotation }) => {
  const texture = useLoader(TextureLoader, imageUrl)

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[2.5, 3.5]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  )
}

export default CardMesh