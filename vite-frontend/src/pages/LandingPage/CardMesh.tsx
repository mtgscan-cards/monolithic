// src/pages/LandingPage/CardMesh.tsx
import React, { useMemo } from 'react'
import { useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { TextureLoader } from 'three'

interface CardMeshProps {
  imageUrl: string
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const CardMesh: React.FC<CardMeshProps> = ({ imageUrl, position, rotation }) => {
  const gl = useThree(state => state.gl)
  const texture = useLoader(TextureLoader, imageUrl)

  // ✅ Ensure texture stays sharp at oblique angles
  useMemo(() => {
    texture.anisotropy = gl.capabilities.getMaxAnisotropy()
    texture.minFilter = THREE.LinearMipMapLinearFilter   // Best for angle-preserving clarity
    texture.magFilter = THREE.LinearFilter               // Smooth magnification
    texture.generateMipmaps = true                       // Required for mipmap filtering
    texture.needsUpdate = true
  }, [texture, gl])

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[2.5, 3.5]} />
      <meshBasicMaterial
        map={texture}
        transparent
        alphaTest={0.8}
        toneMapped={false}
      />
    </mesh>
  )
}

export default CardMesh