// src/pages/LandingPage/Deck3DScene.tsx

import React, { useRef, useEffect, useMemo, Suspense } from 'react'
import { Canvas, useThree, useFrame, useLoader, invalidate } from '@react-three/fiber'
import { TextureLoader, Vector3, Spherical, PerspectiveCamera } from 'three'
import { ResizeObserver } from '@juggle/resize-observer'
import { Html, Preload } from '@react-three/drei'
import DeckGroup from './DeckGroup'
import { CardImage } from './LandingPage'

const TRACKBALL_RADIUS = 7
const BASE_AZIMUTH = 0
const BASE_POLAR = Math.PI / 2.0
const MOUSE_SENSITIVITY = 0.17

const TrackballCamera: React.FC = () => {
  const { camera, size } = useThree()
  const spherical = useRef(new Spherical(TRACKBALL_RADIUS, BASE_POLAR, BASE_AZIMUTH))
  const mouse = useRef({ x: 0, y: 0 })
  const target = useMemo(() => new Vector3(0, 0, 0), [])
  const tempPos = useMemo(() => new Vector3(), [])

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const x = (event.clientX / size.width - 0.5) * 2
      const y = (event.clientY / size.height - 0.5) * 2
      mouse.current.x = x
      mouse.current.y = y
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

    tempPos.setFromSpherical(spherical.current)
    camera.position.lerp(tempPos, 0.1)
    camera.lookAt(target)
  })

  return null
}

const SceneContents: React.FC<{ cards: CardImage[] }> = React.memo(({ cards }) => {
  const { camera, size } = useThree()

  useEffect(() => {
    const cam = camera as PerspectiveCamera
    const aspect = size.width / size.height
    if (cam.aspect !== aspect) {
      cam.aspect = aspect
      cam.updateProjectionMatrix()
    }
  }, [camera, size.width, size.height])

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
})

const PreloadedScene: React.FC<{ cards: CardImage[] }> = ({ cards }) => {
  const textureUrls = useMemo(
    () =>
      cards.flatMap(card =>
        typeof card.front === 'string' && typeof card.back === 'string'
          ? [card.front, card.back]
          : []
      ),
    [cards]
  )

  useLoader(TextureLoader, textureUrls)

  return <SceneContents cards={cards} />
}

const Deck3DScene: React.FC<{ cards: CardImage[] }> = ({ cards }) => {
  // Smooth capped render loop at 45 FPS
  useEffect(() => {
    let mounted = true
    const interval = 1000 / 45

    const loop = () => {
      if (!mounted) return
      invalidate()
      setTimeout(loop, interval)
    }

    loop()

    return () => {
      mounted = false
    }
  }, [])

  return (
    <Canvas
      camera={{ position: [0, 0, TRACKBALL_RADIUS], fov: 45 }}
      resize={{ polyfill: ResizeObserver }}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
      }}
      frameloop="demand"
    >
      <Suspense
        fallback={
          <Html >

          </Html>
        }
      >
        <PreloadedScene cards={cards} />
        <Preload all />
      </Suspense>
    </Canvas>
  )
}

export default Deck3DScene
