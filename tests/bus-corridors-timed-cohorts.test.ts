import { expect, test } from "bun:test"
import {
  planBusCorridors,
  type BusCorridorGuide,
  type ConnectionName,
} from "../lib/plan-bus-corridors"
import type { Bus, SimpleRouteJson } from "../lib/types"

function getCorridorGuides(
  input: SimpleRouteJson,
): Map<ConnectionName, BusCorridorGuide> {
  const work = planBusCorridors({
    input,
    connections: input.connections,
    fixed: [],
    widths: new Map<ConnectionName, number>(
      input.connections.map((connection) => [connection.name, 0.1]),
    ),
  })
  let state = work.next()
  while (!state.done) state = work.next()
  return state.value
}

test("corridor guides leave requests with timing constraints on their matching-aware search", () => {
  const input: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.1,
    minTraceToPadEdgeClearance: 0.1,
    bounds: { minX: -6, maxX: 6, minY: -4, maxY: 4 },
    obstacles: [],
    connections: Array.from({ length: 8 }, (_, index) => ({
      name: `D${index}`,
      pointsToConnect: [
        { x: -4, y: index * 0.02, layer: "top" },
        { x: 4, y: index * 0.02, layer: "top" },
      ],
    })),
    buses: [
      {
        busId: "data",
        connectionNames: Array.from({ length: 8 }, (_, index) => `D${index}`),
      },
    ],
  }
  expect(getCorridorGuides(input).size).toBe(8)
  const constraints: Array<Partial<Bus>> = [
    { minLength: 0 },
    { maxLength: 100 },
    { maxLengthSkew: 0 },
  ]
  for (const constraint of constraints) {
    const untimedBus = input.buses![0]
    expect(
      getCorridorGuides({
        ...input,
        buses: [{ ...untimedBus, ...constraint }],
      }).size,
    ).toBe(0)
    const overlay: Bus = {
      busId: "timed_overlap",
      connectionNames: ["D0"],
      ...constraint,
    }
    for (const buses of [
      [untimedBus, overlay],
      [overlay, untimedBus],
    ]) {
      const guides = getCorridorGuides({ ...input, buses })
      expect(guides.size).toBe(0)
    }
    const unbounded = input.connections.map((connection) => ({
      ...connection,
      name: `U${connection.name}`,
    }))
    const guides = getCorridorGuides({
      ...input,
      connections: [...input.connections, ...unbounded],
      buses: [
        { ...untimedBus, ...constraint },
        { busId: "unbounded", connectionNames: unbounded.map((c) => c.name) },
      ],
    })
    // Untimed neighbors can still occupy a timed cohort's tuning space.
    expect(guides.size).toBe(0)
  }
  for (const pair of [
    { connectionNames: ["D0", "D1"] as [string, string], lengthTolerance: 0.1 },
    {
      connectionNames: ["D0", "D1"] as [string, string],
      lengthTolerance: 0.1,
      traceGap: 0.1,
      maxUncoupledLength: 1,
    },
  ]) {
    expect(
      getCorridorGuides({ ...input, differentialPairs: [pair] }).size,
    ).toBe(0)
  }
})
