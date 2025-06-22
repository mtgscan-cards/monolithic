// src/pages/LandingPage/Deck3DScene.tsx

import React, { useRef, useEffect, useMemo, Suspense } from 'react'
import { Canvas, useThree, useFrame, invalidate } from '@react-three/fiber'
import { Vector3, Spherical, PerspectiveCamera } from 'three'
import { ResizeObserver } from '@juggle/resize-observer'
import { Preload } from '@react-three/drei'
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
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} />
      <DeckGroup cards={cards} />
      <TrackballCamera />
    </>
  )
}

const Deck3DScene: React.FC<{ cards: CardImage[] }> = ({ cards }) => {
  useEffect(() => {
    let mounted = true
    let visible = document.visibilityState === 'visible'
    const interval = 1000 / 45
    let timeoutId: number | null = null

    const loop = () => {
      if (!mounted || !visible) return
      invalidate()
      timeoutId = window.setTimeout(loop, interval)
    }

    const handleVisibility = () => {
      visible = document.visibilityState === 'visible'
      if (!visible && timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      } else if (visible && timeoutId === null) {
        loop()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    if (visible) loop()

    return () => {
      mounted = false
      if (timeoutId !== null) clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '600px',
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
          minHeight: '600px',
          background: '#111',
        }}
        frameloop="demand"
        onCreated={({ gl }) => {
          gl.domElement.setAttribute('data-ready', 'true')
        }}
      >
        {/* Preloading removed here to prevent blocking first paint */}
        <Suspense>
          <SceneContents cards={cards} />
          <Preload all />
        </Suspense>
      </Canvas>
    </div>
  )
}

export default Deck3DScene