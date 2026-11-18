import { expect, test } from "bun:test"
import { length } from "../lib/geometry"
import { GridVisibilitySearch } from "../lib/grid-visibility"
import { VectorScene } from "../lib/vector-scene"
import type { SimpleRouteJson } from "../lib/types"

function getCentralChannelCost(x: number, y: number): number {
  return x > 1 && x < 5 && Math.abs(y) < 0.75 ? 5 : 0
}

test("advisory corridor costs permit detours without changing physical length limits", () => {
  const input: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.1,
    bounds: { minX: -1, maxX: 7, minY: -2, maxY: 2 },
    obstacles: [],
    connections: [
      {
        name: "DQ0",
        pointsToConnect: [
          { x: 0, y: 0, layer: "top" },
          { x: 6, y: 0, layer: "top" },
        ],
      },
    ],
  }
  const connection = input.connections[0]
  const scene = new VectorScene(input, connection, 0.1, [])
  for (const maxLength of [8, 6]) {
    const search = new GridVisibilitySearch(
      scene,
      connection.pointsToConnect[0],
      connection.pointsToConnect[1],
      [],
      0,
      undefined,
      {
        bounds: input.bounds,
        step: 0.25,
        maxLength,
        paretoLength: true,
        costAt: getCentralChannelCost,
      },
    )
    while (!search.solved && !search.failed) search.step()
    expect(search.solved).toBe(true)
    expect(scene.pathVisible(search.result)).toBe(true)
    expect(length(search.result)).toBeLessThanOrEqual(maxLength + 1e-8)
    expect(search.result[0]).toEqual(connection.pointsToConnect[0])
    expect(search.result.at(-1)).toEqual(connection.pointsToConnect[1])
    if (maxLength === 8)
      expect(search.result.some((point) => Math.abs(point.y) >= 0.75)).toBe(
        true,
      )
    else expect(length(search.result)).toBeCloseTo(6, 8)
  }
})
