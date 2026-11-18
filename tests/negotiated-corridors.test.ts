import { expect, test } from "bun:test"
import { validateRoutedCopperDrc } from "@tscircuit/fanout-solver"
import { distance } from "../lib/geometry"
import { negotiateLanes } from "../lib/negotiate-lanes"
import type { SimpleRouteJson } from "../lib/types"
import { fixedCopper } from "../lib/vector-scene"

test("negotiated lanes leave a one-track pocket backwards before approaching their targets", () => {
  const input: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.1,
    minTraceToPadEdgeClearance: 0.1,
    minBoardEdgeClearance: 0.1,
    bounds: { minX: -5, maxX: 5, minY: -4, maxY: 4 },
    connections: [-0.5, 0, 0.5].map((y, index) => ({
      name: `D${index}`,
      pointsToConnect: [
        { x: -1.5, y, layer: "top" },
        { x: 3, y, layer: "top" },
      ],
    })),
    buses: [{ busId: "BYTE", connectionNames: ["D0", "D1", "D2"] }],
    // The right-hand mouth admits one track. Two signals must first leave
    // through the left-hand opening and then pass above/below the pocket.
    obstacles: [
      {
        center: { x: -1.5, y: 1.5 },
        width: 3,
        height: 0.3,
        layers: ["top"],
        connectedTo: ["wall"],
      },
      {
        center: { x: -1.5, y: -1.5 },
        width: 3,
        height: 0.3,
        layers: ["top"],
        connectedTo: ["wall"],
      },
      {
        center: { x: 0, y: 0.9 },
        width: 0.3,
        height: 1.35,
        layers: ["top"],
        connectedTo: ["wall"],
      },
      {
        center: { x: 0, y: -0.9 },
        width: 0.3,
        height: 1.35,
        layers: ["top"],
        connectedTo: ["wall"],
      },
    ],
  }
  const original = structuredClone(input)
  const work = negotiateLanes(
    input,
    input.connections,
    fixedCopper(input),
    [],
    new Map(input.connections.map((connection) => [connection.name, 0.1])),
  )
  let result = work.next()
  try {
    for (let step = 0; !result.done && step < 20000; step++)
      result = work.next()
    expect(result.done).toBe(true)
    if (!result.done) throw Error("Corridor fixture exhausted its work budget")
    const traces = result.value
    expect(traces).toHaveLength(input.connections.length)
    if (!traces) throw Error("Corridor fixture did not complete")
    for (const connection of input.connections) {
      const trace = traces.find(
        (candidate) => candidate.connection_name === connection.name,
      )!
      expect(
        distance(trace.route[0], connection.pointsToConnect[0]),
      ).toBeLessThan(1e-8)
      expect(
        distance(trace.route.at(-1)!, connection.pointsToConnect[1]),
      ).toBeLessThan(1e-8)
    }
    const outside = traces.filter((trace) =>
      trace.route.some((point) => point.x < -3.1),
    )
    expect(outside).toHaveLength(2)
    expect(
      outside.every((trace) =>
        trace.route.some((point) => Math.abs(point.y) > 1.7),
      ),
    ).toBe(true)
    const drc = validateRoutedCopperDrc({
      inputSrj: input,
      routedSrj: { ...input, traces },
      clearance: 0.1,
      allowBlindAndBuriedVias: false,
    } as Parameters<typeof validateRoutedCopperDrc>[0])
    expect(drc.issues).toEqual([])
    expect(drc.valid).toBe(true)
    expect(input).toEqual(original)
  } finally {
    if (!result.done) work.return(null)
  }
})
