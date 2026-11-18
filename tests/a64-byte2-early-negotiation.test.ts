import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import { validateRoutedCopperDrc } from "@tscircuit/fanout-solver"
import {
  BusLanesPipelineSolver,
  type SimpleRouteJson,
  type Trace,
} from "../lib"

const fixtureDirectory = new URL(
  "./fixtures/a64-byte2-early-negotiation/",
  import.meta.url,
)

test("routes A64 byte2 with the default pipeline and preserves the supplied two bytes", () => {
  const input: SimpleRouteJson = JSON.parse(
    gunzipSync(
      readFileSync(new URL("input.srj.json.gz", fixtureDirectory)),
    ).toString(),
  )
  const expectedRoutes: Record<string, Trace["route"]> = JSON.parse(
    gunzipSync(
      readFileSync(new URL("expected-routes.json.gz", fixtureDirectory)),
    ).toString(),
  )
  const originalInput = JSON.stringify(input)
  const originalFixed = JSON.stringify(input.traces)
  expect(input.connections).toHaveLength(8)
  expect(input.traces).toHaveLength(16)

  const solver = new BusLanesPipelineSolver(input)
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.error).toBeNull()

  const output = solver.getOutput()
  const traces = output.traces
  expect(output.connections).toEqual(input.connections)
  expect(traces).toHaveLength(24)
  expect(JSON.stringify(traces.slice(0, 16))).toBe(originalFixed)
  const requestedRoutes = Object.fromEntries(
    input.connections.map((connection) => {
      const matches = traces.filter(
        (trace) => trace.connection_name === connection.name,
      )
      expect(matches).toHaveLength(1)
      const route = matches[0]!.route
      expect(route.length).toBeGreaterThan(1)
      for (const [index, point] of connection.pointsToConnect.entries()) {
        const endpoint = index === 0 ? route[0]! : route.at(-1)!
        expect(endpoint).toMatchObject({
          route_type: "wire",
          layer: point.layer,
        })
        expect(endpoint.x).toBeCloseTo(point.x, 8)
        expect(endpoint.y).toBeCloseTo(point.y, 8)
      }
      return [connection.name, route]
    }),
  )
  expect(requestedRoutes).toEqual(expectedRoutes)

  // The fixed traces belong to earlier byte requests absent from this SRJ.
  // Give the independent DRC validator their ownership without requesting routes.
  const fixedOwners = [
    ...new Set(input.traces!.map((trace) => trace.connection_name!)),
  ]
  const validationInput = {
    ...input,
    connections: [
      ...input.connections,
      ...fixedOwners
        .filter(
          (name) =>
            !input.connections.some((connection) => connection.name === name),
        )
        .map((name) => ({ name, pointsToConnect: [] })),
    ],
  }
  const drc = validateRoutedCopperDrc({
    inputSrj: validationInput as Parameters<
      typeof validateRoutedCopperDrc
    >[0]["inputSrj"],
    routedSrj: {
      ...output,
      connections: validationInput.connections,
    } as Parameters<typeof validateRoutedCopperDrc>[0]["routedSrj"],
    clearance: input.minTraceToPadEdgeClearance ?? 0.075,
    allowBlindAndBuriedVias: input.allowBlindAndBuriedVias ?? false,
  })
  expect(drc.issues).toEqual([])
  expect(drc.valid).toBe(true)
  expect(JSON.stringify(input)).toBe(originalInput)
})
