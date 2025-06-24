import React, { useMemo, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
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

    const targetX = THREE.MathUtils.clamp(mouse.x * 0.5 + 0.5, 0, 1)
    const targetY = THREE.MathUtils.clamp(-mouse.y * 0.5 + 0.5, 0, 1)

    smoothedMouse.lerp(new THREE.Vector2(targetX, targetY), 0.05)
    uniforms.uMouse.value.copy(smoothedMouse)
  })

  return (
    <mesh>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[
            new Float32Array([
              -1, -1, 0,
              3, -1, 0,
              -1, 3, 0,
            ]),
            3,
          ]}
        />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={`
          void main() {
            gl_Position = vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          precision highp float;
          uniform float uTime;
          uniform vec2 uResolution;
          uniform vec2 uMouse;

          float metaball(vec2 p, vec2 center, float r) {
            vec2 diff = p - center;
            return r * r / (dot(diff, diff) + 1e-4);
          }

          float wobbleMod(vec2 p, vec2 center, float baseR, float influence, float timeOffset) {
            vec2 diff = p - center;
            float dist = length(diff);
            float angle = atan(diff.y, diff.x);

            float decay = pow(clamp(1.0 - dist / baseR, 0.0, 1.0), 1.6);
            float maxMagnitude = 0.004;

            float id = dot(center, vec2(13.37, 17.11));
            float harmonic =
                0.4 * sin(angle * 3.0 + id + uTime * 0.7) +
                0.2 * sin(angle * 6.0 + id + uTime * 1.1) +
                0.1 * sin(angle * 11.0 + id + uTime * 1.8);

            return baseR + harmonic * decay * influence * maxMagnitude;
          }

          float random(float n) {
            return fract(sin(n) * 43758.5453123);
          }

          void main() {
            vec2 uv = gl_FragCoord.xy / uResolution;
            vec2 offset = vec2(1.0 / uResolution.x, 1.0 / uResolution.y);

            float accum = 0.0;
            vec2 centers[16];
            float radii[16];

            for (int i = 0; i < 16; i++) {
              float depth = 0.2 + 0.8 * fract(sin(float(i) * 57.0) * 43758.5453);
              float depthInfluence = pow(depth, 1.5);
              vec2 parallaxOffset = (uMouse - 0.5) * 0.2 * (1.0 - depthInfluence);

              vec2 center = vec2(
                0.5 + 0.33 * sin(uTime * 0.2 + float(i) * 1.3),
                0.5 + 0.33 * cos(uTime * 0.15 + float(i) * 1.7)
              ) + parallaxOffset;

              float r = 0.035 + 0.01 * mod(float(i), 4.0);
              centers[i] = center;
              radii[i] = r;
            }

            for (int i = 0; i < 16; i++) {
              float influence = 0.0;
              for (int j = 0; j < 16; j++) {
                if (i != j) {
                  float d = distance(centers[i], centers[j]);
                  influence += smoothstep(0.0, 0.2, 0.2 - d); // Smooth proximity-based influence
                }
              }

              float timeOffset = float(i) * 2.8;
              float wobbleR = wobbleMod(uv, centers[i], radii[i], influence, timeOffset);
              accum += metaball(uv, centers[i], wobbleR);
            }

            float t = smoothstep(0.9, 1.3, accum); // more realistic smooth merge/detach threshold

            float dx = accum - metaball(uv + vec2(offset.x, 0.0), vec2(0.5), 0.3);
            float dy = accum - metaball(uv + vec2(0.0, offset.y), vec2(0.5), 0.3);
            vec3 normal = normalize(vec3(dx, dy, 1.0));
            float lighting = dot(normal, normalize(vec3(-0.2, 0.3, 1.0)));

            float variation = random(accum * 23.17);
            vec3 base = vec3(0.04 + variation * 0.02, 0.01 + variation * 0.01, 0.015);
            vec3 glow = vec3(0.25 + variation * 0.05, 0.01, 0.05 + variation * 0.02);

            vec3 merged = mix(base, glow, pow(t, 1.5));
            merged = mix(merged, vec3(1.0), 0.05);
            merged *= 0.4 + 0.3 * lighting;
            merged.r += 0.05 * lighting;
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

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uNoiseDensity: { value: 2.5 },
    uNoiseStrength: { value: 0.25 },
    uMouse: { value: new THREE.Vector2(0, 0) },
  }), [])

  const smoothedMouse = useMemo(() => new THREE.Vector2(0, 0), [])

  useFrame(({ clock, mouse }) => {
    uniforms.uTime.value = clock.getElapsedTime()

    // Only smooth and apply mouse influence when hovered
    if (hovered) {
      const target = new THREE.Vector2(mouse.x, mouse.y)
      smoothedMouse.lerp(target, 0.08)
      uniforms.uMouse.value.copy(smoothedMouse)
    } else {
      smoothedMouse.lerp(new THREE.Vector2(0, 0), 0.05)
      uniforms.uMouse.value.copy(smoothedMouse)
    }
  })

  return (
    <group position={[0, 1.1, 0]}>
      <mesh
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[3.5, 128, 128]} />
        <shaderMaterial
          vertexShader={`
            varying float vDistort;
            varying vec3 vNormal;
            uniform float uTime;
            uniform float uNoiseDensity;
            uniform float uNoiseStrength;
            uniform vec2 uMouse;

            float hash(vec3 p) {
              return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
            }

            float noise(vec3 p) {
              vec3 i = floor(p);
              vec3 f = fract(p);
              f = f*f*(3.0 - 2.0*f);
              return mix(
                mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                    mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                    mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
                f.z);
            }

            void main() {
              // Inject subtle parallax variation based on uMouse when hovered
              vec3 distortedNormal = normal + vec3(
                (uMouse.x - 0.5) * 0.2,
                (uMouse.y - 0.5) * 0.2,
                0.0
              );

              float n = noise(distortedNormal * uNoiseDensity + uTime) * uNoiseStrength;
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

              vec3 base = cosPalette(
                d,
                vec3(0.10, 0.08, 0.08),
                vec3(0.4, 0.1, 0.1),
                vec3(1.0),
                vec3(0.0, 0.2, 0.25)
              );

              vec3 rim = vec3(0.4, 0.05, 0.05) * fresnel;
              vec3 final = base + rim;

              gl_FragColor = vec4(final, 1.0);
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

const SiteStatsSection: React.FC = () => {
  return (
    <div className="site-stats-wrapper">
      <Canvas
        camera={{ position: [0, 4, 7], fov: 70 }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          minHeight: '800px',
          display: 'block',
          zIndex: 0,
          background: 'transparent',
          borderTop: '1px solid rgba(255, 255, 255, 0.2)',
        }}
        gl={{ alpha: true, antialias: true }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color('#111111'), 1.0)
          gl.domElement.setAttribute('data-ready', 'true')
        }}
      >
        <FullscreenMetaball />
        <BlobMesh />
      </Canvas>

      <div className="stats-overlay">
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