import { expect, test } from "bun:test"
import { validateRoutedCopperDrc } from "@tscircuit/fanout-solver"
import { SingleLayerConnectivitySolver } from "../lib/single-layer-connectivity-solver"
import { connectivityDrillConflicts } from "../lib/connectivity-geometry"
import type { SimpleRouteJson } from "../lib/types"
import fixture from "./fixtures/connectivity-crossed-banks.json"

function crossedPads(permutation: number[], offset: number): SimpleRouteJson {
  const connections = permutation.map((p, i) => ({
    name: "net-" + i,
    pointsToConnect: [
      {
        x: offset - 1.5 + (i % 2) * 0.5,
        y: Math.floor(i / 2) * 0.5,
        layer: "top",
        pcb_port_id: "left-" + i,
      },
      {
        x: offset + 1.5 + (p % 2) * 0.5,
        y: Math.floor(p / 2) * 0.5,
        layer: "top",
        pcb_port_id: "right-" + i,
      },
    ],
  }))
  return {
    layerCount: 4,
    allowedLayers: ["inner1"],
    minTraceWidth: 0.09,
    minTraceToPadEdgeClearance: 0.09,
    minViaPadDiameter: 0.25,
    minViaHoleDiameter: 0.15,
    minViaHoleEdgeToViaHoleEdgeClearance: 0.25,
    bounds: { minX: offset - 3, maxX: offset + 4, minY: -2, maxY: 3 },
    connections,
    obstacles: connections.flatMap((c) =>
      c.pointsToConnect.map((p, j) => ({
        shape: "circle",
        componentId: "package-" + j,
        center: { x: p.x, y: p.y },
        width: 0.23,
        height: 0.23,
        layers: ["top"],
        connectedTo: [c.name, p.pcb_port_id],
      })),
    ),
  }
}

test("crossed bank layouts retain all previously validated completions", () => {
  let accepted = 0
  for (const sample of fixture.cases) {
    const input = crossedPads(sample.permutation, sample.offset)
    const before = structuredClone(input)
    const solver = new SingleLayerConnectivitySolver(input, {
      gridStep: 0.3,
      maxPasses: 20,
      maxExpansionsPerRoute: 100000,
      maxRefinements: 2,
    })
    solver.solve()
    expect(input).toEqual(before)
    if (sample.previouslyValidated) expect(solver.solved).toBe(true)
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
  expect(accepted).toBeGreaterThanOrEqual(9)
}, 60000)
