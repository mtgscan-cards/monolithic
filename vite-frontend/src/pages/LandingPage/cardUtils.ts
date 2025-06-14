// src/pages/LandingPage/cardUtils.ts
export const getHelixPositions = (count: number) => {
  const radius = 6
  const spacing = 0.6

  return Array.from({ length: count }, (_, i) => {
    const angle = i * 0.35
    const y = i * spacing
    const x = radius * Math.cos(angle)
    const z = radius * Math.sin(angle)
    const rotY = Math.PI / 2 + angle

    return {
      position: [x, y, z] as [number, number, number],
      rotation: [0, rotY, 0] as [number, number, number],
    }
  })
}
