// src/pages/LandingPage/CardMesh.tsx

import React, { useMemo } from 'react'
import { useLoader, useThree } from '@react-three/fiber'
import { TextureLoader } from 'three'
import * as THREE from 'three'

interface CardMeshProps {
  frontUrl: string
  backUrl: string
  scale?: number
}

const CardMesh: React.FC<CardMeshProps> = ({ frontUrl, backUrl, scale = 1 }) => {
  const gl = useThree(state => state.gl)
  const [front, back] = useLoader(TextureLoader, [frontUrl, backUrl])

  useMemo(() => {
    [front, back].forEach(tex => {
      tex.anisotropy = gl.capabilities.getMaxAnisotropy()
      tex.minFilter = THREE.LinearMipMapLinearFilter
      tex.magFilter = THREE.LinearFilter
      tex.generateMipmaps = true
      tex.needsUpdate = true
    })
  }, [front, back, gl])

  const width = 0.7 * scale
  const height = 1.0 * scale

  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[width, height]} />
        <meshPhongMaterial
          map={front}
          side={THREE.FrontSide}
          transparent
        />
      </mesh>
      <mesh position={[0, 0, -0.01]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[width, height]} />
        <meshPhongMaterial
          map={back}
          side={THREE.FrontSide}
          transparent
        />
      </mesh>
    </group>
  )
}

export default CardMesh
