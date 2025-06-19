// SiteStatsSection.tsx
import React, { useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import './SiteStatsSection.css'

const vertexShader = `
  varying float vDistort;
  varying vec3 vNormal;

  uniform float uTime;
  uniform float uNoiseDensity;
  uniform float uNoiseStrength;
  uniform float uFrequency;
  uniform float uAmplitude;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f*f*(3.0 - 2.0*f);

    return mix(
      mix(
        mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(
        mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }

  vec3 rotateY(vec3 v, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
  }

  void main() {
    float time = uTime;
    float n = noise(normal * uNoiseDensity + time) * uNoiseStrength;
    vec3 displaced = position + normal * n;
    float angle = sin(uv.y * uFrequency + time) * uAmplitude;
    displaced = rotateY(displaced, angle);
    vDistort = n;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`

const fragmentShader = `
  varying float vDistort;
  varying vec3 vNormal;

  vec3 cosPalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(6.28318 * (c * t + d));
  }

  void main() {
    float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0, 0, 1))), 3.0);
    float d = clamp(vDistort, 0.0, 1.0);

    vec3 base = cosPalette(
      d,
      vec3(0.10, 0.08, 0.08),   // dark grey base
      vec3(0.4, 0.1, 0.1),      // red-tinted contrast
      vec3(1.0),
      vec3(0.0, 0.2, 0.25)
    );

    vec3 rim = vec3(0.4, 0.05, 0.05) * fresnel;
    vec3 final = base + rim;

    gl_FragColor = vec4(final, 1.0);
  }
`

const BlobMesh = () => {
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uNoiseDensity: { value: 2.5 },
    uNoiseStrength: { value: 0.25 },
    uFrequency: { value: 2.0 },
    uAmplitude: { value: 0.35 },
  }), [])

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <mesh>
      <sphereGeometry args={[3.5, 128, 128]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.FrontSide}
        transparent
        depthWrite={false}
      />
    </mesh>
  )
}

const SiteStatsSection: React.FC = () => {
  return (
    <div className="site-stats-wrapper">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 70 }}
        style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'transparent' }}
        gl={{
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: false,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color('#111111'), 1.0)
        }}
      >
        <BlobMesh />
      </Canvas>
      <div className="stats-overlay">
        <div className="stat-block">
          <div className="stat-value">30,000+</div>
          <div className="stat-label">Cards Tracked</div>
        </div>
        <div className="stat-block">
          <div className="stat-value">50+</div>
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