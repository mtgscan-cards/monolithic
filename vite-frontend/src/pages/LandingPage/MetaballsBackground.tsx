// src/pages/LandingPage/MetaballsBackground.tsx

import React, { useRef, useEffect } from 'react'

const MetaballsBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl')
    if (!gl) return

    const width = canvas.width = window.innerWidth
    const height = canvas.height = window.innerHeight

    const numMetaballs = 30
    const metaballs: { x: number; y: number; vx: number; vy: number; r: number }[] = []

    for (let i = 0; i < numMetaballs; i++) {
      const radius = Math.random() * 60 + 10
      metaballs.push({
        x: Math.random() * (width - 2 * radius) + radius,
        y: Math.random() * (height - 2 * radius) + radius,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        r: radius * 0.75,
      })
    }

    const vertexShaderSrc = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `

    const fragmentShaderSrc = `
      precision highp float;
      const float WIDTH = ${width.toFixed(1)};
      const float HEIGHT = ${height.toFixed(1)};
      uniform vec3 metaballs[${numMetaballs}];
      void main() {
        float x = gl_FragCoord.x;
        float y = gl_FragCoord.y;
        float sum = 0.0;
        for (int i = 0; i < ${numMetaballs}; i++) {
          vec3 mb = metaballs[i];
          float dx = mb.x - x;
          float dy = mb.y - y;
          float r = mb.z;
          sum += (r * r) / (dx * dx + dy * dy);
        }
        if (sum >= 0.99) {
          gl_FragColor = vec4(mix(vec3(x / WIDTH, y / HEIGHT, 1.0), vec3(0, 0, 0), max(0.0, 1.0 - (sum - 0.99) * 100.0)), 1.0);
        } else {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        }
      }
    `

    const compileShader = (source: string, type: number) => {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) || 'Shader compile failed')
      }
      return shader
    }

    const vertexShader = compileShader(vertexShaderSrc, gl.VERTEX_SHADER)
    const fragmentShader = compileShader(fragmentShaderSrc, gl.FRAGMENT_SHADER)

    const program = gl.createProgram()!
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    gl.useProgram(program)

    const vertexData = new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1])
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW)

    const positionLoc = gl.getAttribLocation(program, 'position')
    gl.enableVertexAttribArray(positionLoc)
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0)

    const metaballsLoc = gl.getUniformLocation(program, 'metaballs')

    const loop = () => {
      for (const mb of metaballs) {
        mb.x += mb.vx
        mb.y += mb.vy
        if (mb.x < mb.r || mb.x > width - mb.r) mb.vx *= -1
        if (mb.y < mb.r || mb.y > height - mb.r) mb.vy *= -1
      }

      const data = new Float32Array(numMetaballs * 3)
      metaballs.forEach((mb, i) => {
        data[3 * i + 0] = mb.x
        data[3 * i + 1] = mb.y
        data[3 * i + 2] = mb.r
      })

      gl.uniform3fv(metaballsLoc, data)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      requestAnimationFrame(loop)
    }

    loop()
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1,
        pointerEvents: 'none',
      }}
    />
  )
}

export default MetaballsBackground
