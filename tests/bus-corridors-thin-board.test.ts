import { expect, test } from "bun:test"
import { planBusCorridors } from "../lib/plan-bus-corridors"
import type { SimpleRouteJson } from "../lib/types"

test("a board narrower than one coarse tile produces no invalid guide field", () => {
  const input: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.01,
    minTraceToPadEdgeClearance: 0.01,
    bounds: { minX: 0, maxX: 10, minY: 0, maxY: 0.1 },
    obstacles: [],
    connections: [0.03, 0.07].map((y, index) => ({
      name: `D${index}`,
      pointsToConnect: [
        { x: 1, y, layer: "top" },
        { x: 9, y, layer: "top" },
      ],
    })),
    buses: [{ busId: "byte", connectionNames: ["D0", "D1"] }],
  }
  const work = planBusCorridors(
    input,
    input.connections,
    [],
    new Map([
      ["D0", 0.01],
      ["D1", 0.01],
    ]),
  )
  let state = work.next()
  while (!state.done) state = work.next()
  expect(state.value.size).toBe(0)
})
