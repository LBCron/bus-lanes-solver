import { expect, test } from "bun:test"
import {
  clearanceToCopper,
  copperTooClose,
  fixedCopper,
} from "../lib/vector-scene"

test("rectangular pad pruning preserves exact clearance decisions", (): void => {
  const pads = fixedCopper({
    layerCount: 2,
    minTraceWidth: 0.1,
    bounds: { minX: -10, maxX: 10, minY: -10, maxY: 10 },
    connections: [],
    obstacles: [0, 45].map((ccwRotationDegrees) => ({
      type: "rect" as const,
      layers: ["top"],
      center: { x: 0, y: 0 },
      width: 1,
      height: 2,
      ccwRotationDegrees,
      connectedTo: [],
    })),
  })
  let seed = 12345
  const random = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 2 ** 32
  }
  const point = (): { x: number; y: number } => ({
    x: random() * 8 - 4,
    y: random() * 8 - 4,
  })
  for (let i = 0; i < 10000; i++) {
    const a = point()
    let b = point()
    if (i % 4 === 0) b = a
    if (i % 4 === 1) b.x = a.x
    if (i % 4 === 2) b.y = a.y
    for (const pad of pads) {
      const clearance = clearanceToCopper(a, b, pad)
      for (const margin of [
        0,
        0.075,
        clearance,
        clearance - 1e-12,
        clearance + 1e-12,
      ]) {
        expect(copperTooClose(a, b, pad, margin)).toBe(clearance < margin)
      }
    }
  }
})
