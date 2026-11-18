import { expect, test } from "bun:test"
import { validateRoutedCopperDrc } from "@tscircuit/fanout-solver"
import { negotiateLanes } from "../lib/negotiate-lanes"
import {
  planBusCorridors,
  type ConnectionName,
} from "../lib/plan-bus-corridors"
import type { SimpleRouteJson } from "../lib/types"
import { fixedCopper } from "../lib/vector-scene"

test("coarse overload preserves a legal one-sweep detailed route", () => {
  const input: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.1,
    minTraceToPadEdgeClearance: 0.1,
    minBoardEdgeClearance: 0.1,
    bounds: { minX: -5, maxX: 5, minY: -4, maxY: 4 },
    connections: [-0.6, -0.3, 0, 0.3, 0.6].map((y, index) => ({
      name: `D${index}`,
      pointsToConnect: [
        { x: -3, y, layer: "top" },
        { x: 3, y, layer: "top" },
      ],
    })),
    buses: [{ busId: "byte", connectionNames: ["D0", "D1", "D2", "D3", "D4"] }],
    obstacles: [
      {
        center: { x: 0, y: 1.1 },
        width: 0.3,
        height: 1.4,
        layers: ["top"],
        connectedTo: ["wall"],
      },
      {
        center: { x: 0, y: -1.1 },
        width: 0.3,
        height: 1.4,
        layers: ["top"],
        connectedTo: ["wall"],
      },
    ],
  }
  const widths = new Map<ConnectionName, number>(
    input.connections.map((connection) => [connection.name, 0.1]),
  )
  const copper = fixedCopper(input)
  const planning = planBusCorridors({
    input,
    connections: input.connections,
    fixed: copper,
    widths,
  })
  let plan = planning.next()
  while (!plan.done) plan = planning.next()
  expect(plan.value.size).toBe(5)
  let reportedIterations = 0
  const work = negotiateLanes(
    input,
    input.connections,
    copper,
    [],
    widths,
    (iteration) => {
      reportedIterations = Math.max(reportedIterations, iteration)
    },
  )
  let state = work.next()
  while (!state.done) state = work.next()
  expect(state.value).not.toBeNull()
  const traces = state.value!
  expect(traces).toHaveLength(input.connections.length)
  expect(reportedIterations).toBe(input.connections.length)
  for (const connection of input.connections) {
    const trace = traces.find(
      (candidate) => candidate.connection_name === connection.name,
    )!
    expect(trace.route[0]).toMatchObject(connection.pointsToConnect[0])
    expect(trace.route.at(-1)).toMatchObject(connection.pointsToConnect[1])
  }
  expect(
    traces.some((trace) =>
      trace.route.some((point) => Math.abs(point.y) > 1.8),
    ),
  ).toBe(true)
  const drc = validateRoutedCopperDrc({
    inputSrj: input,
    routedSrj: { ...input, traces },
    clearance: 0.1,
    allowBlindAndBuriedVias: false,
  } as Parameters<typeof validateRoutedCopperDrc>[0])
  expect(drc.valid).toBe(true)
  expect(drc.issues).toEqual([])
})
