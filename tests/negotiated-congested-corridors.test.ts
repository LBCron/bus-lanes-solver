import { expect, test } from "bun:test"
import { validateRoutedCopperDrc } from "@tscircuit/fanout-solver"
import { negotiateLanes } from "../lib/negotiate-lanes"
import { planBusCorridors } from "../lib/plan-bus-corridors"
import type { SimpleRouteJson } from "../lib/types"
import { fixedCopper } from "../lib/vector-scene"

test("global corridor candidates retain complete routing of a congested sixteen-lane bus", () => {
  const count = 16
  const outer = ((count - 1) * 0.3) / 2 + 1.2
  const gap = 0.4
  const input: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.1,
    minTraceToPadEdgeClearance: 0.1,
    minBoardEdgeClearance: 0.1,
    bounds: { minX: -5, maxX: 5, minY: -outer - 2.2, maxY: outer + 2.2 },
    connections: Array.from({ length: count }, (_, index) => ({
      name: `D${index}`,
      pointsToConnect: [
        { x: -3, y: (index - (count - 1) / 2) * 0.3, layer: "top" },
        { x: 3, y: (index - (count - 1) / 2) * 0.3, layer: "top" },
      ],
    })),
    buses: [
      {
        busId: "data",
        connectionNames: Array.from(
          { length: count },
          (_, index) => `D${index}`,
        ),
      },
    ],
    obstacles: [-1, 1].map((sign) => ({
      center: { x: 0, y: (sign * (outer + gap)) / 2 },
      width: 0.3,
      height: outer - gap,
      layers: ["top"],
      connectedTo: ["wall"],
    })),
  }
  const widths = new Map(
    input.connections.map((connection) => [connection.name, 0.1]),
  )
  const copper = fixedCopper(input)
  const planning = planBusCorridors(input, input.connections, copper, widths)
  let plan = planning.next()
  while (!plan.done) plan = planning.next()
  expect(plan.value.size).toBe(count)
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
  let steps = 0
  while (!state.done && steps++ < 10000) state = work.next()
  if (!state.done) {
    work.return(null)
    throw Error("Congested corridor solve exhausted its work budget")
  }
  expect(state.done).toBe(true)
  expect(state.value).not.toBeNull()
  const traces = state.value!
  expect(traces).toHaveLength(count)
  // This fixture needs retries, so the lazy global planner is exercised. Keep
  // a loose work bound rather than pinning the baseline's exact retry count.
  expect(reportedIterations).toBeGreaterThan(count)
  expect(reportedIterations).toBeLessThan(400)
  for (const connection of input.connections) {
    const trace = traces.find(
      (candidate) => candidate.connection_name === connection.name,
    )!
    expect(trace.route[0]).toMatchObject(connection.pointsToConnect[0])
    expect(trace.route.at(-1)).toMatchObject(connection.pointsToConnect[1])
  }
  const drc = validateRoutedCopperDrc({
    inputSrj: input,
    routedSrj: { ...input, traces },
    clearance: 0.1,
    allowBlindAndBuriedVias: false,
  } as Parameters<typeof validateRoutedCopperDrc>[0])
  expect(drc.valid).toBe(true)
  expect(drc.issues).toEqual([])
})
