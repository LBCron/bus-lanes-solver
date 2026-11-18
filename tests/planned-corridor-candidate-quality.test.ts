import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { validateRoutedCopperDrc } from "@tscircuit/fanout-solver"
import { length } from "../lib/geometry"
import { negotiateLanes } from "../lib/negotiate-lanes"
import type { SimpleRouteJson } from "../lib/types"
import { fixedCopper } from "../lib/vector-scene"

test("planned corridor alternatives shorten a congested bus without replacing its ordinary search", () => {
  const input = JSON.parse(
    readFileSync(
      new URL("./fixtures/bus-corridors/three-barriers.json", import.meta.url),
      "utf8",
    ),
  ) as SimpleRouteJson
  const count = input.connections.length
  const work = negotiateLanes(
    input,
    input.connections,
    fixedCopper(input),
    [],
    new Map(input.connections.map((connection) => [connection.name, 0.1])),
  )
  let state = work.next()
  let steps = 0
  while (!state.done && steps++ < 2000) state = work.next()
  if (!state.done) work.return(null)
  expect(state.done).toBe(true)
  expect(state.value).not.toBeNull()
  const traces = state.value!
  expect(traces).toHaveLength(count)
  for (const connection of input.connections) {
    const trace = traces.find(
      (candidate) => candidate.connection_name === connection.name,
    )!
    expect(trace.route[0]).toMatchObject(connection.pointsToConnect[0])
    expect(trace.route.at(-1)).toMatchObject(connection.pointsToConnect[1])
  }
  // Main's ordinary candidates require 90.253 mm total and a 14.024 mm peak
  // here. Fresh corridor alternatives reduce both without changing pin order.
  expect(
    traces.reduce((sum, trace) => sum + length(trace.route), 0),
  ).toBeLessThan(88)
  expect(Math.max(...traces.map((trace) => length(trace.route)))).toBeLessThan(
    13.5,
  )
  const drc = validateRoutedCopperDrc({
    inputSrj: input,
    routedSrj: { ...input, traces },
    clearance: 0.1,
    allowBlindAndBuriedVias: false,
  } as Parameters<typeof validateRoutedCopperDrc>[0])
  expect(drc.valid).toBe(true)
  expect(drc.issues).toEqual([])
})
