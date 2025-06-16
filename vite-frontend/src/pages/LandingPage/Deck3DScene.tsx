// src/pages/LandingPage/Deck3DScene.tsx

import React, { useRef, useEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import DeckGroup from './DeckGroup'
import { CardImage } from './LandingPage'
import { Vector3, Spherical, PerspectiveCamera } from 'three'
import { ResizeObserver } from '@juggle/resize-observer'

const TRACKBALL_RADIUS = 8
const BASE_AZIMUTH = 0
const BASE_POLAR = Math.PI / 2.2
const MOUSE_SENSITIVITY = 0.3

const TrackballCamera: React.FC = () => {
  const { camera, size } = useThree()
  const spherical = useRef(new Spherical(TRACKBALL_RADIUS, BASE_POLAR, BASE_AZIMUTH))
  const mouse = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const x = (event.clientX / size.width - 0.5) * 2
      const y = (event.clientY / size.height - 0.5) * 2
      mouse.current = { x, y }
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [size])

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime()
    const azimuth = BASE_AZIMUTH + time * 0.1 + mouse.current.x * MOUSE_SENSITIVITY
    const polar = BASE_POLAR + mouse.current.y * MOUSE_SENSITIVITY

    spherical.current.theta = azimuth
    spherical.current.phi = polar

    const newPos = new Vector3().setFromSpherical(spherical.current)
    camera.position.lerp(newPos, 0.1)
    camera.lookAt(0, 0, 0)
  })

  return null
}

const SceneContents: React.FC<{ cards: CardImage[] }> = ({ cards }) => {
  const { camera, size } = useThree()

  useEffect(() => {
    const cam = camera as PerspectiveCamera
    cam.aspect = size.width / size.height
    cam.updateProjectionMatrix()
  }, [camera, size])

  return (
<>
  <ambientLight intensity={0.7} />
  <directionalLight position={[5, 10, 5]} intensity={0.8} />
  <directionalLight position={[-5, 10, -5]} intensity={0.6} />
  <directionalLight position={[0, 5, 10]} intensity={0.4} />
  <DeckGroup cards={cards} />
  <TrackballCamera />
</>
  )
}

const Deck3DScene: React.FC<{ cards: CardImage[] }> = ({ cards }) => {
  return (
    <Canvas
      camera={{ position: [0, 0, TRACKBALL_RADIUS], fov: 50 }}
      resize={{ polyfill: ResizeObserver }}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    >
      <SceneContents cards={cards} />
    </Canvas>
  )
}

export default Deck3DScene
