// vite-frontend/src/pages/LandingPage/CardMesh.tsx

import React, { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import {
  LinearFilter,
  LinearMipMapLinearFilter,
  FrontSide,
  PlaneGeometry,
  MeshPhongMaterial,
  Vector3
} from 'three'

interface CardMeshProps {
  frontUrl: string
  backUrl: string
  scale?: number
  position?: Vector3 | [number, number, number]
}

const CardMesh: React.FC<CardMeshProps> = ({ frontUrl, backUrl, scale = 1, position }) => {
  const gl = useThree(state => state.gl)

  // Use Suspense-friendly async texture loading
  const [front, back] = useTexture([frontUrl, backUrl])

  useEffect(() => {
    const balancedAnisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy())
    for (const tex of [front, back]) {
      tex.anisotropy = balancedAnisotropy
      tex.minFilter = LinearMipMapLinearFilter
      tex.magFilter = LinearFilter
      tex.needsUpdate = true
    }
  }, [front, back, gl])

  const geometry = useMemo(() => new PlaneGeometry(0.7 * scale, 1.0 * scale), [scale])

  const frontMaterial = useMemo(
    () =>
      new MeshPhongMaterial({
        map: front,
        side: FrontSide,
        transparent: true,
        shininess: 50,
      }),
    [front]
  )

  const backMaterial = useMemo(
    () =>
      new MeshPhongMaterial({
        map: back,
        side: FrontSide,
        transparent: true,
        shininess: 50,
      }),
    [back]
  )

  return (
    <group position={position}>
      <mesh geometry={geometry} material={frontMaterial} />
      <mesh
        geometry={geometry}
        material={backMaterial}
        position={[0, 0, -0.01]}
        rotation={[0, Math.PI, 0]}
      />
    </group>
  )
}

export default CardMesh