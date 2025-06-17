import React, { useRef, useEffect } from 'react'

interface Particle {
  targetX: number
  targetY: number
  angle: number
  orbitRadius: number
  orbitSpeed: number
  z: number
  opacity: number
  pulse: number
  pulseSpeed: number
  age: number
  flickerOffset: number
}

const ParticleNetwork: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mouse = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const container = containerRef.current
    if (!canvas || !ctx || !container) return

    const resize = () => {
      canvas.width = container.offsetWidth
      canvas.height = container.offsetHeight
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)

    window.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width - 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5
      mouse.current = { x, y }
    })

    const particles: Particle[] = []
    const MAX_PARTICLES = 90
    const SPAWN_INTERVAL = 100
    const MAX_DISTANCE = 160

    const spawnParticle = () => {
      if (particles.length >= MAX_PARTICLES) return

      const angle = Math.random() * Math.PI * 2
      const radius = Math.pow(Math.random(), 0.6) * (canvas.width / 2.4)
      const centerX = canvas.width / 2
      const centerY = canvas.height / 2

      const targetX = centerX + Math.cos(angle) * radius
      const targetY = centerY + Math.sin(angle) * radius

      particles.push({
        targetX,
        targetY,
        angle: Math.random() * Math.PI * 2,
        orbitRadius: 6 + Math.random() * 8,
        orbitSpeed: 0.002 + Math.random() * 0.004,
        z: Math.random(),
        opacity: 0,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.04 + Math.random() * 0.02,
        age: 0,
        flickerOffset: Math.random() * 10,
      })
    }

    const interval = setInterval(spawnParticle, SPAWN_INTERVAL)

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const time = performance.now()

      // Animate
      particles.forEach((p) => {
        p.age += 1
        p.opacity = Math.min(1, p.age / 20)
        p.pulse += p.pulseSpeed
        p.angle += p.orbitSpeed
      })

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]

          const ax = a.targetX
          const ay = a.targetY
          const bx = b.targetX
          const by = b.targetY

          const dx = ax - bx
          const dy = ay - by
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < MAX_DISTANCE) {
            const alpha = (1 - dist / MAX_DISTANCE) * a.opacity * b.opacity

            const axRender = ax + Math.cos(a.angle) * a.orbitRadius + mouse.current.x * 40 * a.z
            const ayRender = ay + Math.sin(a.angle) * a.orbitRadius + mouse.current.y * 40 * a.z
            const bxRender = bx + Math.cos(b.angle) * b.orbitRadius + mouse.current.x * 40 * b.z
            const byRender = by + Math.sin(b.angle) * b.orbitRadius + mouse.current.y * 40 * b.z

            const gradient = ctx.createLinearGradient(axRender, ayRender, bxRender, byRender)
            gradient.addColorStop(0, `rgba(255, 80, 80, ${alpha * 0.25})`)
            gradient.addColorStop(1, `rgba(255, 0, 100, ${alpha * 0.25})`)
            ctx.strokeStyle = gradient
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(axRender, ayRender)
            ctx.lineTo(bxRender, byRender)
            ctx.stroke()

            const t = (Math.sin(time / 300 + i + j) + 1) / 2
            const px = axRender + (bxRender - axRender) * t
            const py = ayRender + (byRender - ayRender) * t
            ctx.fillStyle = `rgba(255,255,255,${alpha * 0.25})`
            ctx.beginPath()
            ctx.arc(px, py, 1.5, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }

      // Draw particles
      particles.forEach((p) => {
        const flicker = 0.8 + 0.2 * Math.sin(time / 200 + p.flickerOffset)
        const r = 2.5 + Math.sin(p.pulse) * 1.2

        const x = p.targetX + Math.cos(p.angle) * p.orbitRadius + mouse.current.x * 40 * p.z
        const y = p.targetY + Math.sin(p.angle) * p.orbitRadius + mouse.current.y * 40 * p.z

        const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4)
        glow.addColorStop(0, `rgba(255, 60, 60, ${0.4 * p.opacity * flicker})`)
        glow.addColorStop(1, `rgba(0, 0, 0, 0)`)
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(x, y, r * 4, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = `rgba(255, 80, 80, ${p.opacity})`
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      })

      requestAnimationFrame(draw)
    }

    draw()

    return () => {
      clearInterval(interval)
      observer.disconnect()
      window.removeEventListener('mousemove', () => {})
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
    </div>
  )
}

export default ParticleNetwork
