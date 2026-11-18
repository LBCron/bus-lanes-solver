import { expect, test } from "bun:test"
import {
  planBusCorridors,
  type ConnectionName,
} from "../lib/plan-bus-corridors"
import type { SimpleRouteJson } from "../lib/types"
import { fixedCopper } from "../lib/vector-scene"

test("coarse planning separates overloaded lanes within one bus and releases their terminals", () => {
  const input: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.1,
    minTraceToPadEdgeClearance: 0.1,
    bounds: { minX: -6, maxX: 6, minY: -4, maxY: 4 },
    obstacles: [],
    connections: Array.from({ length: 8 }, (_, index) => ({
      name: `D${index}`,
      pointsToConnect: [
        { x: -4, y: 0.02 * index, layer: "top" },
        { x: 4, y: 0.02 * index, layer: "top" },
      ],
    })),
    buses: [
      {
        busId: "byte",
        connectionNames: Array.from({ length: 8 }, (_, i) => `D${i}`),
      },
    ],
  }
  const work = planBusCorridors({
    input,
    connections: input.connections,
    fixed: fixedCopper(input),
    widths: new Map<ConnectionName, number>(
      input.connections.map((connection) => [connection.name, 0.1]),
    ),
  })
  let state = work.next()
  let yields = 0
  while (!state.done) {
    yields++
    state = work.next()
  }
  expect(yields).toBeGreaterThan(0)
  expect(state.value.size).toBe(8)
  const crossings = [...state.value.values()].map(
    (guide) =>
      guide.path.reduce((closest, point) =>
        Math.abs(point.x) < Math.abs(closest.x) ? point : closest,
      ).y,
  )
  expect(Math.max(...crossings) - Math.min(...crossings)).toBeGreaterThan(0.7)
  for (const connection of input.connections) {
    const guide = state.value.get(connection.name)!
    const terminal = connection.pointsToConnect[0]
    expect(guide.costAt(terminal)).toBe(0)
    expect(guide.costAt({ x: 0, y: 3, layer: "bottom" })).toBe(0)
    expect(guide.costAt({ x: 0, y: 3, layer: "top" })).toBeGreaterThan(0)
    expect(guide.costAt({ x: 0, y: 3, layer: "top" })).toBeLessThanOrEqual(0.75)
  }
})
