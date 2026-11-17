import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { validateRoutedCopperDrc } from "@tscircuit/fanout-solver"
import { SingleLayerConnectivitySolver } from "../lib/single-layer-connectivity-solver"
import {
  connectivityDrillConflicts,
  connectivityViaShortcuts,
} from "../lib/connectivity-geometry"
import { joinedSignalGeometryIsValid } from "../lib/joined-signal-geometry"
import { createCrossedPadBanks } from "./fixtures/connectivity-crossed-pads"
import fixture from "./fixtures/connectivity-escape-planning.json"

test("legal escape planning retains layouts needing provisional terminal vias", () => {
  for (const sample of fixture.cases) {
    const input = createCrossedPadBanks({
      ...sample,
      maxY:
        Math.floor((sample.permutation.length - 1) / 2) * sample.spacing + 1,
    })
    const before = structuredClone(input)
    expect(
      createHash("sha256").update(JSON.stringify(input)).digest("hex"),
    ).toBe(sample.inputSha256)
    const solver = new SingleLayerConnectivitySolver(input, sample.options)
    solver.solve()
    expect(solver.error).toBeNull()
    expect(solver.solved).toBe(true)
    expect(input).toEqual(before)
    expect(solver.traces).toHaveLength(input.connections.length)
    expect(connectivityDrillConflicts(input, solver.traces)).toEqual([])
    for (const connection of input.connections) {
      const trace = solver.traces.find(
        (trace) => trace.connection_name === connection.name,
      )!
      for (const [point, terminal] of [
        [trace.route[0], connection.pointsToConnect[0]],
        [trace.route.at(-1)!, connection.pointsToConnect[1]],
      ] as const)
        expect(point).toMatchObject({
          route_type: "wire",
          x: terminal.x,
          y: terminal.y,
          layer: terminal.layer,
        })
      expect(connectivityViaShortcuts(input, trace)).toBe(false)
      expect(
        joinedSignalGeometryIsValid({ input, trace, smoothTuning: false }),
      ).toBe(true)
    }
    const drc = validateRoutedCopperDrc({
      inputSrj: input,
      routedSrj: solver.getOutput(),
      clearance: 0.09,
      allowBlindAndBuriedVias: false,
    } as unknown as Parameters<typeof validateRoutedCopperDrc>[0])
    expect(drc.issues).toEqual([])
  }
}, 30000)
