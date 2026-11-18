import { expect, test } from "bun:test"
import { planBusCorridors } from "../lib/plan-bus-corridors"
import type { SimpleRouteJson } from "../lib/types"

test("uncongested and layer-disjoint buses retain their original detailed search", () => {
  const input: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.1,
    bounds: { minX: -2, maxX: 12, minY: -2, maxY: 6 },
    obstacles: [],
    connections: ["top", "bottom"].map((layer, index) => ({
      name: `D${index}`,
      pointsToConnect: [
        { x: 0, y: 0, layer },
        { x: 10, y: 0, layer },
      ],
    })),
    buses: [{ busId: "byte", connectionNames: ["D0", "D1"] }],
  }
  const work = planBusCorridors(
    input,
    input.connections,
    [],
    new Map([
      ["D0", 0.1],
      ["D1", 0.1],
    ]),
  )
  let state = work.next()
  while (!state.done) state = work.next()
  expect(state.value.size).toBe(0)
})
