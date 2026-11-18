import { expect, test } from "bun:test"
import {
  planBusCorridors,
  type BusCorridorGuide,
  type ConnectionName,
} from "../lib/plan-bus-corridors"
import type { SimpleRouteJson } from "../lib/types"

test("mixed extreme widths keep advisory footprint work bounded by the coarse grid", () => {
  const input: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.1,
    minTraceToPadEdgeClearance: 0.1,
    bounds: { minX: -10, maxX: 10, minY: -10, maxY: 10 },
    obstacles: [],
    connections: [
      {
        name: "wide",
        pointsToConnect: [
          { x: 0, y: 0, layer: "top" },
          { x: 0.1, y: 0.1, layer: "top" },
        ],
      },
      {
        name: "D0",
        pointsToConnect: [
          { x: -5, y: 0, layer: "top" },
          { x: 5, y: 0, layer: "top" },
        ],
      },
      {
        name: "D1",
        pointsToConnect: [
          { x: -5, y: 0.2, layer: "top" },
          { x: 5, y: 0.2, layer: "top" },
        ],
      },
    ],
    buses: [{ busId: "mixed", connectionNames: ["wide", "D0", "D1"] }],
  }
  // The huge width is intentionally beyond this board's physical capacity.
  // Global planning remains advisory and must neither loop over width² nor
  // turn a coarse result into an accepted routing claim.
  const work = planBusCorridors({
    input,
    connections: input.connections,
    fixed: [],
    widths: new Map<ConnectionName, number>([
      ["wide", 1e12],
      ["D0", 0.1],
      ["D1", 0.1],
    ]),
  })
  let state = work.next()
  let steps = 0
  while (!state.done && steps++ < 1000) state = work.next()
  expect(state.done).toBe(true)
  expect(steps).toBeLessThan(1000)
  if (!state.done) work.return(new Map<ConnectionName, BusCorridorGuide>())
})
