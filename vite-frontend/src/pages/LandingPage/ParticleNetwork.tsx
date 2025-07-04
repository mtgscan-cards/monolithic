// vite-frontend/src/pages/LandingPage/ParticleNetwork.tsx

import React, { useRef, useEffect } from 'react'

interface Particle {
  offsetX: number
  offsetY: number
  angle: number
  orbitRadius: number
  orbitSpeed: number
  z: number
  opacity: number
  pulse: number
  pulseSpeed: number
  age: number
  flickerOffset: number
  connections: number
}

const rgba = (r: number, g: number, b: number, a: number) => `rgba(${r},${g},${b},${a})`

const ParticleNetwork: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const targetMouse = useRef({ x: 0, y: 0 })
  const smoothedMouse = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const container = containerRef.current
    if (!canvas || !ctx || !container) return

    requestAnimationFrame(() => {
      canvas.classList.add('fade-canvas', 'visible')
      canvas.setAttribute('data-ready', 'true')
    })

    const resize = () => {
      canvas.width = container.offsetWidth
      canvas.height = container.offsetHeight
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      targetMouse.current.x = (e.clientX - rect.left) / rect.width - 0.5
      targetMouse.current.y = (e.clientY - rect.top) / rect.height - 0.5
    }

    window.addEventListener('mousemove', onMouseMove)

    // Scale particle limits based on resolution
    const scaleFactor = Math.min(window.innerWidth, window.innerHeight) / 1080
    const MAX_PARTICLES = Math.floor(60 + scaleFactor * 60)
    const MAX_DISTANCE = 170 * scaleFactor
    const MAX_DISTANCE_SQ = MAX_DISTANCE * MAX_DISTANCE
    const MAX_ACTIVE_LINKS = Math.floor(100 * scaleFactor)
    const particles: Particle[] = []

    const spawnParticle = () => {
  if (particles.length >= MAX_PARTICLES) return

  // Uniform -1 to 1 range for both axes
  const offsetX = (Math.random() - 0.5) * 2
  const offsetY = (Math.random() - 0.5) * 2

  particles.push({
    offsetX,
    offsetY,
    angle: Math.random() * Math.PI * 2,
    orbitRadius: 6 + Math.random() * 8,
    orbitSpeed: 0.002 + Math.random() * 0.004,
    z: Math.random(),
    opacity: 1,
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: 0.04 + Math.random() * 0.02,
    age: 1000,
    flickerOffset: Math.random() * 10,
    connections: 0,
  })
}
    const SPAWN_INTERVAL = 120
    const interval = setInterval(spawnParticle, SPAWN_INTERVAL)

    const draw = () => {
      requestAnimationFrame(draw)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const time = performance.now()

      const centerX = canvas.width / 2
      const centerY = canvas.height / 2
      const scale = Math.min(canvas.width, canvas.height) * 0.5

      smoothedMouse.current.x += (targetMouse.current.x - smoothedMouse.current.x) * 0.05
      smoothedMouse.current.y += (targetMouse.current.y - smoothedMouse.current.y) * 0.05

      const mx = smoothedMouse.current.x * 40
      const my = smoothedMouse.current.y * 40

      particles.forEach(p => {
        p.connections = 0
        p.age += 1
        p.pulse += p.pulseSpeed
        p.angle += p.orbitSpeed
      })

      const neighborMap: number[][] = particles.map(() => [])
      const connectionList: { ax: number, ay: number, bx: number, by: number, alpha: number, phase: number }[] = []

      for (let i = 0; i < particles.length; i++) {
        const a = particles[i]
        const axBase = centerX + a.offsetX * scale
        const ayBase = centerY + a.offsetY * scale

        const dists: { index: number; distSq: number }[] = []

        for (let j = 0; j < particles.length; j++) {
          if (i === j) continue
          const b = particles[j]
          const bxBase = centerX + b.offsetX * scale
          const byBase = centerY + b.offsetY * scale

          const dx = axBase - bxBase
          const dy = ayBase - byBase
          const distSq = dx * dx + dy * dy
          if (distSq < MAX_DISTANCE_SQ) {
            dists.push({ index: j, distSq })
          }
        }

        dists.sort((a, b) => a.distSq - b.distSq)
        neighborMap[i] = dists.slice(0, 4).map(n => n.index)
        a.connections = neighborMap[i].length
      }

      for (let i = 0; i < particles.length; i++) {
        const a = particles[i]
        if (a.connections < 2) continue

        for (const j of neighborMap[i]) {
          const b = particles[j]
          if (b.connections < 2) continue

          const axBase = centerX + a.offsetX * scale
          const ayBase = centerY + a.offsetY * scale
          const bxBase = centerX + b.offsetX * scale
          const byBase = centerY + b.offsetY * scale

          const dx = axBase - bxBase
          const dy = ayBase - byBase
          const dist = Math.sqrt(dx * dx + dy * dy)
          const alpha = (1 - dist / MAX_DISTANCE) * a.opacity * b.opacity

          const ax = axBase + Math.cos(a.angle) * a.orbitRadius + mx * a.z
          const ay = ayBase + Math.sin(a.angle) * a.orbitRadius + my * a.z
          const bx = bxBase + Math.cos(b.angle) * b.orbitRadius + mx * b.z
          const by = byBase + Math.sin(b.angle) * b.orbitRadius + my * b.z

          const gradient = ctx.createLinearGradient(ax, ay, bx, by)
          gradient.addColorStop(0, rgba(255, 80, 80, alpha * 0.25))
          gradient.addColorStop(1, rgba(255, 0, 100, alpha * 0.25))
          ctx.strokeStyle = gradient
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(ax, ay)
          ctx.lineTo(bx, by)
          ctx.stroke()

          connectionList.push({ ax, ay, bx, by, alpha, phase: i + j })
        }
      }

      for (let k = 0; k < Math.min(MAX_ACTIVE_LINKS, connectionList.length); k++) {
        const { ax, ay, bx, by, alpha, phase } = connectionList[k]
        const t = (Math.sin(time / 300 + phase) + 1) * 0.5
        const px = ax + (bx - ax) * t
        const py = ay + (by - ay) * t
        ctx.fillStyle = rgba(255, 255, 255, alpha * 0.25)
        ctx.beginPath()
        ctx.arc(px, py, 1.5, 0, Math.PI * 2)
        ctx.fill()
      }

      for (const p of particles) {
        if (p.connections < 2) continue

        const flicker = 0.8 + 0.2 * Math.sin(time / 200 + p.flickerOffset)
        const r = 2.5 + Math.sin(p.pulse) * 1.2
        const baseX = centerX + p.offsetX * scale
        const baseY = centerY + p.offsetY * scale
        const x = baseX + Math.cos(p.angle) * p.orbitRadius + mx * p.z
        const y = baseY + Math.sin(p.angle) * p.orbitRadius + my * p.z

        const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4)
        glow.addColorStop(0, rgba(255, 60, 60, 0.4 * p.opacity * flicker))
        glow.addColorStop(1, rgba(0, 0, 0, 0))
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(x, y, r * 4, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = rgba(255, 80, 80, p.opacity)
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    draw()

    return () => {
      clearInterval(interval)
      observer.disconnect()
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          transform: 'translateZ(0)',
          willChange: 'transform, opacity',
        }}
      />
    </div>
  )
}

export default ParticleNetwork
