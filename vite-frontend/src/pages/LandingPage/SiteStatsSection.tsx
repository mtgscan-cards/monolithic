// src/pages/LandingPage/SiteStatsSection.tsx

import React, { useMemo, useState, useEffect, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useInView } from 'react-intersection-observer'
import { a, useSpring } from '@react-spring/three'
import * as THREE from 'three'
import './SiteStatsSection.css'

const FullscreenMetaball = () => {
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1280, 800) },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
  }), [])

  const smoothedMouse = useMemo(() => new THREE.Vector2(0.5, 0.5), [])

  useFrame(({ clock, size, mouse }) => {
    uniforms.uTime.value = clock.getElapsedTime()
    uniforms.uResolution.value.set(size.width, size.height)

    if (mouse.x !== 0 || mouse.y !== 0) {
      const targetX = THREE.MathUtils.clamp(mouse.x * 0.5 + 0.5, 0, 1)
      const targetY = THREE.MathUtils.clamp(-mouse.y * 0.5 + 0.5, 0, 1)
      smoothedMouse.lerp(new THREE.Vector2(targetX, targetY), 0.025)
      uniforms.uMouse.value.copy(smoothedMouse)
    }
  })

  return (
    <mesh frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3]}
        />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={`void main() { gl_Position = vec4(position, 1.0); }`}
        fragmentShader={`precision mediump float;
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;

float metaball(vec2 p, vec2 center, float r) {
  vec2 diff = p - center;
  return r * r / (dot(diff, diff) + 1e-4);
}

float wobbleMod(vec2 p, vec2 center, float baseR, float influence) {
  vec2 diff = p - center;
  float dist = length(diff);
  float angle = atan(diff.y, diff.x);
  float decay = pow(clamp(1.0 - dist / baseR, 0.0, 1.0), 1.4);
  float id = dot(center, vec2(13.37, 17.11));
  float harmonic =
    0.35 * sin(angle * 2.7 + id + uTime * 0.65) +
    0.15 * sin(angle * 5.5 + id + uTime * 1.0);
  return baseR + harmonic * decay * influence * 0.0035;
}

float random(float n) {
  return fract(sin(n) * 43758.5453123);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 offset = vec2(1.0 / uResolution.x, 1.0 / uResolution.y);
  float accum = 0.0;
  vec2 centers[6];
  float radii[6];

  for (int i = 0; i < 6; i++) {
    float id = float(i);
    float depth = 0.3 + 0.7 * fract(sin(id * 57.0) * 43758.5453);
    float influence = pow(depth, 1.5);
    vec2 parallax = (uMouse - 0.5) * 0.2 * (1.0 - influence);
    centers[i] = vec2(
      0.5 + 0.33 * sin(uTime * 0.2 + id * 1.3),
      0.5 + 0.33 * cos(uTime * 0.15 + id * 1.7)
    ) + parallax;
    radii[i] = 0.038 + 0.008 * mod(id, 3.0);
  }

  for (int i = 0; i < 6; i++) {
    float infl = 0.0;
    for (int j = 0; j < 6; j++) {
      if (i != j) {
        infl += smoothstep(0.0, 0.2, 0.2 - distance(centers[i], centers[j]));
      }
    }
    accum += metaball(uv, centers[i], wobbleMod(uv, centers[i], radii[i], infl));
  }

  float t = smoothstep(0.9, 1.2, accum);
  float dx = accum - metaball(uv + vec2(offset.x, 0.0), vec2(0.5), 0.3);
  float dy = accum - metaball(uv + vec2(0.0, offset.y), vec2(0.5), 0.3);
  vec3 normal = normalize(vec3(dx, dy, 1.0));
  float lighting = dot(normal, normalize(vec3(-0.2, 0.3, 1.0)));
  float variation = random(accum * 23.17);
  vec3 base = vec3(0.04 + variation * 0.015, 0.01 + variation * 0.008, 0.015);
  vec3 glow = vec3(0.22 + variation * 0.04, 0.01, 0.05 + variation * 0.015);
  vec3 merged = mix(base, glow, pow(t, 1.4));
  merged = mix(merged, vec3(1.0), 0.05);
  merged *= 0.4 + 0.3 * lighting;
  merged.r += 0.04 * lighting;
  merged.g *= 0.9;
  merged.b *= 0.8;
  float glowEdge = smoothstep(0.3, 0.8, t) * 0.35;
  float alpha = clamp(t * 0.3 + glowEdge, 0.0, 1.0);
  gl_FragColor = vec4(merged, alpha);
}
`}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  )
}

const BlobMesh = () => {
  const [hovered, setHovered] = useState(false)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 600

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uNoiseDensity: { value: 2.0 },
    uNoiseStrength: { value: 0.18 },
    uMouse: { value: new THREE.Vector2(0, 0) },
  }), [])

  const smoothedMouse = useMemo(() => new THREE.Vector2(0, 0), [])

  useFrame(({ clock, mouse }) => {
    uniforms.uTime.value = clock.getElapsedTime()

    if (!isMobile && hovered) {
      smoothedMouse.lerp(new THREE.Vector2(mouse.x, mouse.y), 0.06)
      uniforms.uMouse.value.copy(smoothedMouse)
    }
  })

  return (
    <group position={[0, 1.1, 0]}>
      <mesh
        onPointerOver={() => !isMobile && setHovered(true)}
        onPointerOut={() => !isMobile && setHovered(false)}
      >
        <sphereGeometry args={[3.7, isMobile ? 12 : 32, isMobile ? 12 : 32]} />
        <shaderMaterial
          vertexShader={`
varying float vDistort;
varying vec3 vNormal;

uniform float uTime;
uniform float uNoiseDensity;
uniform float uNoiseStrength;
uniform vec2 uMouse;

float hash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float n000 = hash(i + vec3(0, 0, 0));
  float n100 = hash(i + vec3(1, 0, 0));
  float n010 = hash(i + vec3(0, 1, 0));
  float n110 = hash(i + vec3(1, 1, 0));
  float n001 = hash(i + vec3(0, 0, 1));
  float n101 = hash(i + vec3(1, 0, 1));
  float n011 = hash(i + vec3(0, 1, 1));
  float n111 = hash(i + vec3(1, 1, 1));

  float x00 = mix(n000, n100, f.x);
  float x10 = mix(n010, n110, f.x);
  float x01 = mix(n001, n101, f.x);
  float x11 = mix(n011, n111, f.x);

  float y0 = mix(x00, x10, f.y);
  float y1 = mix(x01, x11, f.y);

  return mix(y0, y1, f.z);
}

void main() {
  vec3 offsetNormal = normal + vec3((uMouse.x - 0.5) * 0.15, (uMouse.y - 0.5) * 0.15, 0.0);
  float n = noise(offsetNormal * uNoiseDensity + uTime) * uNoiseStrength;
  vec3 displaced = position + normal * n;
  vDistort = n;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
`}
          fragmentShader={`
varying float vDistort;
varying vec3 vNormal;

vec3 cosPalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.28318 * (c * t + d));
}

void main() {
  float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0, 0, 1))), 3.0);
  float d = clamp(vDistort, 0.0, 1.0);
  vec3 base = cosPalette(d, vec3(0.1, 0.08, 0.08), vec3(0.4, 0.1, 0.1), vec3(1.0), vec3(0.0, 0.2, 0.25));

  vec3 bumpedNormal = normalize(vNormal + d * 0.6 * vec3(0.5, 0.5, 1.0));
  float light = dot(bumpedNormal, normalize(vec3(-0.4, 0.3, 1.0)));

  vec3 rim = vec3(0.4, 0.05, 0.05) * fresnel;
  vec3 lit = base * (0.6 + 0.4 * light);

  gl_FragColor = vec4(lit + rim, 1.0);
}
`}
          uniforms={uniforms}
          side={THREE.FrontSide}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

interface PopInSceneProps {
  visible: boolean
}

const PopInScene: React.FC<PopInSceneProps> = ({ visible }) => {
  const [ready, setReady] = useState(false)
  const [showMetaballs, setShowMetaballs] = useState(false)
  const isSmallScreen = typeof window !== 'undefined' && window.innerWidth < 600

  const { scale, opacity } = useSpring({
    from: { scale: 0.8, opacity: 0 },
    to: { scale: visible ? 1 : 0.8, opacity: visible ? 1 : 0 },
    config: { tension: 60, friction: 30 },
  })

  useEffect(() => {
    if (visible) {
      const t1 = setTimeout(() => setReady(true), 100)
      const t2 = setTimeout(() => setShowMetaballs(true), 500)
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }
  }, [visible])

  return (
    <a.group scale={scale} visible={opacity.to(o => o > 0)}>
      <a.group scale={scale} position={[0, 0, 0]}>
        {ready && <BlobMesh />}
        {showMetaballs && !isSmallScreen && <FullscreenMetaball />}
      </a.group>
    </a.group>
  )
}

const SiteStatsSection: React.FC = () => {
  const [, setCanvasReady] = useState(false)
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.3 })

  return (
    <div className="site-stats-wrapper" ref={ref}>
      <Canvas
        camera={{ position: [0, 4, 7], fov: 70 }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '800px',
          zIndex: 0,
          background: '#111111',
          pointerEvents: 'none', // ✅ ensures selectable overlay
        }}
        gl={{ alpha: false, antialias: true }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color('#111111'), 1.0)
          gl.domElement.setAttribute('data-ready', 'true')
          setCanvasReady(true)
        }}
      >
        <Suspense fallback={null}>
          <PopInScene visible={inView} />
        </Suspense>
      </Canvas>

      <div className="stats-overlay" style={{ userSelect: 'text', position: 'relative', zIndex: 1 }}>
        <div className="stat-block">
          <div className="stat-value">34,900+</div>
          <div className="stat-label">Cards Tracked</div>
        </div>
        <div className="stat-block">
          <div className="stat-value">365+</div>
          <div className="stat-label">MTG Sets Indexed</div>
        </div>
        <div className="stat-block">
          <div className="stat-value">Open Source ML</div>
          <div className="stat-label">Powered by Community</div>
        </div>
      </div>
    </div>
  )
}

export default SiteStatsSection
