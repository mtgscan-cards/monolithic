// src/pages/LandingPage/CardMesh.tsx

import React, { useEffect, useMemo } from 'react'
import { useLoader, useThree } from '@react-three/fiber'
import {
  TextureLoader,
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
  const [front, back] = useLoader(TextureLoader, [frontUrl, backUrl])

  useEffect(() => {
    const maxAnisotropy = gl.capabilities.getMaxAnisotropy()
    for (const tex of [front, back]) {
      tex.anisotropy = maxAnisotropy
      tex.minFilter = LinearMipMapLinearFilter
      tex.magFilter = LinearFilter
      tex.generateMipmaps = true
      tex.needsUpdate = true
    }
  }, [front, back, gl])

  const width = useMemo(() => 0.7 * scale, [scale])
  const height = useMemo(() => 1.0 * scale, [scale])

  const geometry = useMemo(() => new PlaneGeometry(width, height), [width, height])

  const frontMaterial = useMemo(
    () =>
      new MeshPhongMaterial({
        map: front,
        side: FrontSide,
        transparent: true,
      }),
    [front]
  )

  const backMaterial = useMemo(
    () =>
      new MeshPhongMaterial({
        map: back,
        side: FrontSide,
        transparent: true,
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
