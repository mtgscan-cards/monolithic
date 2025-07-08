import React, {
  useRef,
  useEffect,
  useState,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useCursor, Text } from '@react-three/drei'
import {
  AnimationMixer,
  LoopOnce,
  Group,
  Color,
  Mesh,
  Object3D,
} from 'three'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils'

interface MtgCardStackProps {
  cardStackScale?: number
  xOffset?: number
}

const MtgCardStack: React.FC<MtgCardStackProps> = ({
  cardStackScale = 1,
  xOffset = 0,
}) => {
  const gltf = useGLTF('stack.glb')
  const clonedStack = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene])

  useEffect(() => {
    clonedStack.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
  }, [clonedStack])

  return (
    <group position={[xOffset, 0, 0]} scale={[cardStackScale, 1, 1]}>
      <group position={[0, 0.083, 0]} scale={[0.05, 0.025, 0.05]}>
        <primitive object={clonedStack} />
      </group>
    </group>
  )
}

interface ModelProps {
  scaleX?: number
  scaleY?: number
  scaleZ?: number
  initialPosition?: [number, number, number]
  label?: string
  color?: { top: number; bottom: number }
  cardStackStateIndex?: number
  onClick?: () => void
}

const Model = forwardRef<Group, ModelProps>(
  (
    {
      scaleX = 1,
      scaleY = 1,
      scaleZ = 1,
      initialPosition = [0, 0, 0],
      label,
      color,
      cardStackStateIndex,
      onClick,
    },
    ref
  ) => {
    const gltf = useGLTF('compressed_box.glb')
    const localRef = useRef<Group>(null)
    const pointerTypeRef = useRef<'mouse' | 'touch' | 'pen' | undefined>(undefined)

    useImperativeHandle(ref, () => localRef.current!)

    const mixerRef = useRef<AnimationMixer | null>(null)
    const [hovered, setHovered] = useState(false)
    useCursor(hovered)

    const clonedScene = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene])

    useEffect(() => {
      clonedScene.traverse((child: Object3D) => {
        if (child instanceof Mesh) {
          child.castShadow = true
          child.receiveShadow = true
          if (child.material && child.material.color) {
            child.material = child.material.clone()
            if (child.name.includes('TOP')) {
              child.material.color = new Color(color ? color.top : 0xffffff)
            } else if (child.name.includes('BOTTOM')) {
              child.material.color = new Color(color ? color.bottom : 0x8b4513)
            }
          }
        }
      })
    }, [clonedScene, color])

    useEffect(() => {
      if (gltf.animations.length && localRef.current) {
        mixerRef.current = new AnimationMixer(localRef.current)
        const action = mixerRef.current.clipAction(gltf.animations[0])
        action.setLoop(LoopOnce, 1)
        action.clampWhenFinished = true
        action.play()
        action.paused = true
      }
    }, [gltf])

    useFrame((_, delta) => {
      mixerRef.current?.update(delta)
    })

    const playHoverAnimation = () => {
      const action = mixerRef.current?.clipAction(gltf.animations[0])
      if (action) {
        action.timeScale = 1
        action.paused = false
      }
    }

    const handlePointerOver = () => {
      setHovered(true)
      playHoverAnimation()
    }

    const handlePointerOut = () => {
      setHovered(false)
      const action = mixerRef.current?.clipAction(gltf.animations[0])
      if (action) {
        action.timeScale = -1
        action.paused = false
      }
    }

    const handlePointerDown = (e: React.PointerEvent<Group>) => {
      pointerTypeRef.current = e.pointerType
    }

    const handleClick = () => {
      playHoverAnimation()

      if (pointerTypeRef.current === 'touch') {
        setTimeout(() => {
          onClick?.()
        }, 1600)
      } else {
        onClick?.()
      }
    }

    const cardStackStates = [
      { xOffset: -0.235, cardStackScale: 0.04 },
      { xOffset: -0.23, cardStackScale: 0.1 },
      { xOffset: -0.22, cardStackScale: 0.2 },
      { xOffset: -0.18, cardStackScale: 0.6 },
      { xOffset: -0.14, cardStackScale: 1 },
      { xOffset: -0.05, cardStackScale: 1.86 },
      { xOffset: -0.001, cardStackScale: 2.35 },
      { xOffset: -0.001, cardStackScale: 2.35 },
    ]
    const stateIndex = cardStackStateIndex ?? 0
    const selectedState = cardStackStates[stateIndex % cardStackStates.length - 1]

    return (
      <group
        ref={localRef}
        position={initialPosition}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        scale={[scaleX, scaleY, scaleZ]}
      >
        <primitive object={clonedScene} />
        {stateIndex > 0 && (
          <MtgCardStack
            cardStackScale={selectedState.cardStackScale}
            xOffset={selectedState.xOffset}
          />
        )}
        {label && (
          <Text
            position={[0, 0.5, 0]}
            fontSize={0.09}
            color="black"
            anchorX="center"
            anchorY="middle"
          >
            {label}
          </Text>
        )}
      </group>
    )
  }
)

Model.displayName = 'Model'
export default Model
