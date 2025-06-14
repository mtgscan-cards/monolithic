// src/pages/LandingPage/Deck3DScene.tsx
import React, { useRef, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import DeckGroup from './DeckGroup'
import { CardImage } from './LandingPage'
import { Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

const SceneContents: React.FC<{ cards: CardImage[] }> = ({ cards }) => {
  const { camera } = useThree()
  const orbitRef = useRef<OrbitControlsImpl>(null)

  useEffect(() => {
    const center = new Vector3(0, 0, 0)
    camera.lookAt(center)
    orbitRef.current?.target.copy(center)
  }, [camera])

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} />
      <DeckGroup cards={cards} />
      <OrbitControls
        ref={orbitRef}
        enableZoom={false}
        enablePan={false}
        target={[0, 0, 0]}
      />
    </>
  )
}

const Deck3DScene: React.FC<{ cards: CardImage[] }> = ({ cards }) => {
  return (
    <Canvas
      camera={{ position: [0, 0, 12], fov: 50 }}
      style={{ width: '100vw', height: '100vh', display: 'block' }}
    >
      <SceneContents cards={cards} />
    </Canvas>
  )
}

export default Deck3DScene
