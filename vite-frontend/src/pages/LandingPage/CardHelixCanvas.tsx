// src/pages/LandingPage/CardHelixCanvas.tsx
import React, { useRef, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import CardMesh from './CardMesh'
import { CardImage } from './LandingPage'
import { getHelixPositions } from './cardUtils'
import { Group, Vector3 } from 'three'

const CardScene: React.FC<{ cards: CardImage[] }> = ({ cards }) => {
  const groupRef = useRef<Group>(null)
  const { camera } = useThree()
  const positions = getHelixPositions(cards.length)

  useEffect(() => {
    // Adjust the camera to look at the center of the group
    camera.lookAt(new Vector3(0, 0, 0))
  }, [camera])

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.002
    }
  })

  return (
    <>
      <ambientLight />
      <directionalLight position={[10, 10, 10]} />
      <group ref={groupRef} position={[0, 0, 0]}>
        {cards.map((card, i) => (
          <CardMesh
            key={card.id}
            imageUrl={card.image_uris.png} // Use .png for alpha transparency
            position={positions[i].position}
            rotation={positions[i].rotation}
          />
        ))}
      </group>
      <OrbitControls target={[0, 0, 0]} enableZoom={false} />
    </>
  )
}

const CardHelixCanvas: React.FC<{ cards: CardImage[] }> = ({ cards }) => {
  return (
    <Canvas
      camera={{ position: [0, 0, 20], fov: 50 }}
      style={{ width: '100vw', height: '100vh', display: 'block' }}
    >
      <CardScene cards={cards} />
    </Canvas>
  )
}

export default CardHelixCanvas
