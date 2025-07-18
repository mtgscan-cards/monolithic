// vite-frontend/src/pages/LandingPage/ParticleNetwork.tsx

import React, { useRef, useEffect } from 'react'

interface Particle {
  offsetX: number
  offsetY: number
  angle: number
  orbitRadius: number
  orbitSpeed: number
  z: number
  pulse: number
  pulseSpeed: number
  flickerOffset: number
}

type Link = [i: number, j: number, alpha: number]

const rgba = (r: number, g: number, b: number, a: number) =>
  `rgba(${r},${g},${b},${a})`

const CONFIG = {
  baseParticleCount: 40,
  orbitRadiusRange: [6, 12],
  orbitSpeedRange: [0.001, 0.003],
  pulseSpeedRange: [0.02, 0.035],
  maxLinkDistance: 140,
  maxLinksPerParticle: 3,
  frameRateLimit: 1000 / 30,
  poissonMinDist: 0.09,
  poissonMaxAttempts: 30,
}

const ParticleNetwork: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const particles = useRef<Particle[]>([])
  const positions = useRef<[number, number][]>([])
  const cachedLinks = useRef<Link[]>([])

  const targetMouse = useRef({ x: 0, y: 0 })
  const smoothedMouse = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const container = containerRef.current
    if (!canvas || !ctx || !container) return

canvas.classList.remove('fade-canvas', 'visible')
canvas.removeAttribute('data-ready')

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

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      targetMouse.current.x = (e.clientX - rect.left) / rect.width - 0.5
      targetMouse.current.y = (e.clientY - rect.top) / rect.height - 0.5
    }

    window.addEventListener('mousemove', handleMouseMove)

    const scale = Math.min(window.innerWidth, window.innerHeight) / 1080
    const count = Math.floor(CONFIG.baseParticleCount + scale * CONFIG.baseParticleCount)

    const newParticles: Particle[] = []
    const placed: [number, number][] = []
    const distSqThreshold = CONFIG.poissonMinDist * CONFIG.poissonMinDist

    while (newParticles.length < count) {
      let attempts = 0
      let valid = false
      let fx = 0, fy = 0

      while (attempts++ < CONFIG.poissonMaxAttempts && !valid) {
        fx = Math.random() * 2 - 1
        fy = Math.random() * 2 - 1

        if (Math.abs(fx) > 1 || Math.abs(fy) > 1) continue

        valid = true
        for (const [px, py] of placed) {
          const dx = fx - px
          const dy = fy - py
          if (dx * dx + dy * dy < distSqThreshold) {
            valid = false
            break
          }
        }
      }

      if (valid) {
        placed.push([fx, fy])
        newParticles.push({
          offsetX: fx,
          offsetY: fy,
          angle: Math.random() * Math.PI * 2,
          orbitRadius: CONFIG.orbitRadiusRange[0] +
                       Math.random() * (CONFIG.orbitRadiusRange[1] - CONFIG.orbitRadiusRange[0]),
          orbitSpeed: CONFIG.orbitSpeedRange[0] +
                      Math.random() * (CONFIG.orbitSpeedRange[1] - CONFIG.orbitSpeedRange[0]),
          z: Math.random(),
          pulse: Math.random() * Math.PI * 2,
          pulseSpeed: CONFIG.pulseSpeedRange[0] +
                      Math.random() * (CONFIG.pulseSpeedRange[1] - CONFIG.pulseSpeedRange[0]),
          flickerOffset: Math.random() * 500,
        })
      }
    }

    particles.current = newParticles
    positions.current = new Array(newParticles.length).fill([0, 0])

    const cx = canvas.width / 2
    const cy = canvas.height / 2
    const scaleFactor = Math.min(canvas.width, canvas.height) * 0.5
    const maxDistSq = CONFIG.maxLinkDistance * CONFIG.maxLinkDistance
    const links: Link[] = []

    for (let i = 0; i < newParticles.length; i++) {
      const pi = newParticles[i]
      const xi = cx + pi.offsetX * scaleFactor
      const yi = cy + pi.offsetY * scaleFactor

      let linksCount = 0
      for (let j = i + 1; j < newParticles.length; j++) {
        const pj = newParticles[j]
        const xj = cx + pj.offsetX * scaleFactor
        const yj = cy + pj.offsetY * scaleFactor

        const dx = xi - xj
        const dy = yi - yj
        const distSq = dx * dx + dy * dy

        if (distSq < maxDistSq) {
          const alpha = 1 - distSq / maxDistSq
          links.push([i, j, alpha])
          if (++linksCount >= CONFIG.maxLinksPerParticle) break
        }
      }
    }

    cachedLinks.current = links

    let lastFrame = 0

    const render = (t: number) => {
      requestAnimationFrame(render)
      if (t - lastFrame < CONFIG.frameRateLimit) return
      lastFrame = t

      const w = canvas.width, h = canvas.height
      const cx = w / 2, cy = h / 2
      const scaleFactor = Math.min(w, h) * 0.5

      smoothedMouse.current.x += (targetMouse.current.x - smoothedMouse.current.x) * 0.05
      smoothedMouse.current.y += (targetMouse.current.y - smoothedMouse.current.y) * 0.05
      const mx = smoothedMouse.current.x * 40
      const my = smoothedMouse.current.y * 40

      ctx.clearRect(0, 0, w, h)

      const ps = particles.current
      const pos = positions.current

      for (let i = 0; i < ps.length; i++) {
        const p = ps[i]
        p.angle += p.orbitSpeed
        p.pulse += p.pulseSpeed

        const baseX = cx + p.offsetX * scaleFactor
        const baseY = cy + p.offsetY * scaleFactor
        const zStretch = 1 + p.z * 2.5
        const x = baseX + Math.cos(p.angle) * p.orbitRadius * zStretch + mx * p.z
        const y = baseY + Math.sin(p.angle) * p.orbitRadius * zStretch + my * p.z

        pos[i] = [x, y]
      }

      ctx.lineWidth = 1
      for (const [i, j, alpha] of cachedLinks.current) {
        const [x1, y1] = pos[i]
        const [x2, y2] = pos[j]
        ctx.strokeStyle = rgba(255, 80, 80, alpha * 0.25)
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      }

      ctx.shadowColor = 'rgba(255,60,60,0.4)'
      ctx.shadowBlur = 8

      for (let i = 0; i < ps.length; i++) {
        const [x, y] = pos[i]
        const r = 2.5 + Math.sin(ps[i].pulse) * 1.2
        const flicker = 0.85 + 0.15 * Math.sin(t / 200 + ps[i].flickerOffset)
        ctx.fillStyle = rgba(255, 80, 80, flicker)
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.shadowBlur = 0
    }

    requestAnimationFrame(render)

    return () => {
      observer.disconnect()
      window.removeEventListener('mousemove', handleMouseMove)
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
          opacity: '1',
          transform: 'translateZ(0)',
          willChange: 'transform, opacity',
        }}
      />
    </div>
  )
}

export default ParticleNetwork
