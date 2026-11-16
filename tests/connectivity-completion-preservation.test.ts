import { expect, test } from "bun:test"
import { validateRoutedCopperDrc } from "@tscircuit/fanout-solver"
import { SingleLayerConnectivitySolver } from "../lib/single-layer-connectivity-solver"
import { connectivityDrillConflicts } from "../lib/connectivity-geometry"
import { createCrossedPadBanks } from "./fixtures/connectivity-crossed-pads"
import fixture from "./fixtures/connectivity-crossed-banks.json"

test("crossed bank layouts complete without changing their native inputs", () => {
  let accepted = 0
  for (const sample of fixture.cases) {
    const input = createCrossedPadBanks(sample.permutation, sample.offset)
    const before = structuredClone(input)
    const solver = new SingleLayerConnectivitySolver(input, {
      gridStep: 0.3,
      maxPasses: 20,
      maxExpansionsPerRoute: 100000,
      maxRefinements: 2,
    })
    solver.solve()
    expect(input).toEqual(before)
    expect(solver.solved).toBe(true)
    if (!solver.solved) {
      expect(solver.traces).toEqual([])
      continue
    }
    accepted++
    expect(solver.traces).toHaveLength(10)
    expect(connectivityDrillConflicts(input, solver.traces)).toEqual([])
    for (const connection of input.connections) {
      const trace = solver.traces.find(
        (t) => t.connection_name === connection.name,
      )!
      for (const side of [0, 1]) {
        const point = side ? trace.route.at(-1)! : trace.route[0]
        const terminal = connection.pointsToConnect[side]
        expect(point).toMatchObject({
          route_type: "wire",
          x: terminal.x,
          y: terminal.y,
          layer: terminal.layer,
        })
      }
    }
    const drc = validateRoutedCopperDrc({
      inputSrj: input,
      routedSrj: solver.getOutput(),
      clearance: 0.09,
      allowBlindAndBuriedVias: false,
    } as unknown as Parameters<typeof validateRoutedCopperDrc>[0])
    expect(drc.issues).toEqual([])
  }
  expect(accepted).toBe(12)
}, 60000)
