// src/pages/LandingPage/Deck3DScene.tsx

import React, { useRef, useEffect, useMemo, Suspense } from 'react'
import { Canvas, useThree, useFrame, invalidate } from '@react-three/fiber'
import { Vector3, Spherical, PerspectiveCamera, Color } from 'three'
import { ResizeObserver } from '@juggle/resize-observer'
import DeckGroup from './DeckGroup'
import { CardImage } from './LandingPage'

const TRACKBALL_RADIUS = 7
const BASE_AZIMUTH = 0
const BASE_POLAR = Math.PI / 2.0
const MOUSE_SENSITIVITY = 0.17

const TrackballCamera: React.FC = () => {
  const { camera, size, clock } = useThree()
  const spherical = useRef(new Spherical(TRACKBALL_RADIUS, BASE_POLAR, BASE_AZIMUTH))
  const mouse = useRef({ x: 0, y: 0 })
  const target = useMemo(() => new Vector3(0, 0, 0), [])
  const tempPos = useMemo(() => new Vector3(), [])

  const lastTimeRef = useRef<number>(0)
  const timeOffsetRef = useRef<number>(0)

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const x = (event.clientX / size.width - 0.5) * 2
      const y = (event.clientY / size.height - 0.5) * 2
      mouse.current.x = x
      mouse.current.y = y
      invalidate() // redraw when user moves mouse
    }

    window.addEventListener('mousemove', handleMouseMove)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lastTimeRef.current = clock.getElapsedTime()
      } else {
        const now = clock.getElapsedTime()
        const pausedDuration = now - lastTimeRef.current
        timeOffsetRef.current += pausedDuration
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [size, clock])

  useFrame(() => {
    const time = clock.getElapsedTime() - timeOffsetRef.current
    const azimuth = BASE_AZIMUTH + time * 0.05 + mouse.current.x * MOUSE_SENSITIVITY
    const polar = BASE_POLAR + mouse.current.y * MOUSE_SENSITIVITY

    spherical.current.theta = azimuth
    spherical.current.phi = polar

    tempPos.setFromSpherical(spherical.current)
    camera.position.lerp(tempPos, 0.1)
    camera.lookAt(target)

    invalidate() // redraw when camera moves
  })

  return null
}

const SceneContents: React.FC<{ cards: CardImage[] }> = ({ cards }) => {
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
      <ambientLight intensity={0.65} />
      <directionalLight position={[4, 8, 6]} intensity={0.8} />
      <DeckGroup cards={cards} />
      <TrackballCamera />
    </>
  )
}

const Deck3DScene: React.FC<{ cards: CardImage[] }> = ({ cards }) => {
  const width = window.innerWidth
  const height = window.innerHeight
  const dpr = window.devicePixelRatio || 1
  const screenArea = width * height * dpr

  const maxCards = useMemo(() => {
    if (screenArea <= 480 * 800) return 12
    if (screenArea <= 768 * 1024) return 16
    if (screenArea <= 1280 * 1440) return 32
    return 45
  }, [screenArea])

  const visibleCards = useMemo(() => cards.slice(0, maxCards), [cards, maxCards])

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#111',
      }}
    >
      <Canvas
        camera={{ position: [0, 0, TRACKBALL_RADIUS], fov: 45 }}
        resize={{ polyfill: ResizeObserver }}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          background: '#111',
        }}
        frameloop="demand"
        onCreated={({ gl }) => {
          gl.setClearColor(new Color('#111111'), 1.0)
          gl.domElement.setAttribute('data-ready', 'true')
        }}
      >
        <Suspense fallback={null}>
          <SceneContents cards={visibleCards} />
        </Suspense>
      </Canvas>
    </div>
  )
}

export default Deck3DScene