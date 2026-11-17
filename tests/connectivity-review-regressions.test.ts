import { expect, test } from "bun:test"
import { validateRoutedCopperDrc } from "@tscircuit/fanout-solver"
import { SingleLayerConnectivitySolver } from "../lib/single-layer-connectivity-solver"
import { connectivityDrillConflicts } from "../lib/connectivity-geometry"
import type {
  SimpleRouteJson,
  Connection,
  Wire,
  Via,
  Trace,
} from "../lib/types"

function wire({
  x,
  y,
  layer = "top",
}: {
  x: number
  y: number
  layer?: string
}): Wire {
  return { route_type: "wire", x, y, layer, width: 0.1 }
}

function firstViaInput() {
  const c: Connection = {
    name: "signal",
    pointsToConnect: [
      { x: -0.4, y: 0, layer: "top", pcb_port_id: "s" },
      { x: 0.4, y: 0, layer: "top", pcb_port_id: "t" },
    ],
  }
  const input: SimpleRouteJson = {
    layerCount: 4,
    allowedLayers: ["inner1"],
    minTraceWidth: 0.04,
    minTraceToPadEdgeClearance: 0.01,
    minViaPadDiameter: 0.1,
    minViaHoleDiameter: 0.05,
    minViaHoleEdgeToViaHoleEdgeClearance: 0.3,
    bounds: { minX: -1.2, maxX: 1, minY: -0.5, maxY: 0.5 },
    connections: [c],
    obstacles: c.pointsToConnect.map((p, i) => ({
      shape: "circle",
      componentId: "package" + i,
      center: { x: p.x, y: p.y },
      width: 0.08,
      height: 0.08,
      layers: [p.layer],
      connectedTo: [c.name, p.pcb_port_id!],
    })),
  }
  input.obstacles.push({
    center: { x: 0.05, y: 0 },
    width: 0.05,
    height: 2,
    layers: ["top"],
    connectedTo: [],
  })
  for (let ix = 0; ix <= 22; ix++)
    for (let iy = 0; iy <= 10; iy++) {
      const x = -1.2 + ix * 0.1,
        y = -0.5 + iy * 0.1
      if (
        Math.abs(y) < 1e-7 &&
        [-0.8, -0.1, 0.2].some((v) => Math.abs(x - v) < 1e-7)
      )
        continue
      input.obstacles.push({
        center: { x, y },
        width: 0.01,
        height: 0.01,
        layers: ["bottom"],
        connectedTo: [],
      })
    }

  return { input }
}
function sharedViaInput() {
  const via: Via = {
    route_type: "via",
    x: -2.5,
    y: 3,
    from_layer: "top",
    to_layer: "inner1",
    layers: ["top", "inner1", "inner2", "bottom"],
    via_diameter: 0.3,
    via_hole_diameter: 0.15,
  }
  const c: Connection = {
    name: "signal",
    pointsToConnect: [
      { x: -3, y: 0, layer: "top", pcb_port_id: "s" },
      { x: 3, y: 0, layer: "top", pcb_port_id: "t" },
    ],
  }
  const power: Connection = {
    name: "POWER",
    pointsToConnect: [
      { x: -3, y: 3, layer: "top", pcb_port_id: "p0" },
      { x: -2, y: 3, layer: "inner1", pcb_port_id: "p1" },
      { x: -2, y: 4, layer: "inner1", pcb_port_id: "p2" },
    ],
  }
  const input: SimpleRouteJson = {
    layerCount: 4,
    allowedLayers: ["inner1"],
    minTraceWidth: 0.1,
    minTraceToPadEdgeClearance: 0.1,
    minViaPadDiameter: 0.3,
    minViaHoleDiameter: 0.15,
    minViaHoleEdgeToViaHoleEdgeClearance: 0.25,
    bounds: { minX: -5, maxX: 5, minY: -2, maxY: 5 },
    connections: [c],
    obstacles: [c, power].flatMap((c) =>
      c.pointsToConnect.map((p, i) => ({
        shape: "circle" as const,
        componentId: "package" + i,
        center: { x: p.x, y: p.y },
        width: 0.3,
        height: 0.3,
        layers: [p.layer],
        connectedTo: [c.name, p.pcb_port_id!],
      })),
    ),
    traces: [
      {
        type: "pcb_trace",
        pcb_trace_id: "fixed_power_1",
        connection_name: "POWER",
        route: [
          wire({ x: -3, y: 3 }),
          wire({ x: -2.5, y: 3 }),
          via,
          wire({ x: -2.5, y: 3, layer: "inner1" }),
          wire({ x: -2, y: 3, layer: "inner1" }),
        ],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "fixed_power_2",
        connection_name: "POWER",
        route: [
          wire({ x: -3, y: 3 }),
          wire({ x: -2.5, y: 3 }),
          { ...via },
          wire({ x: -2.5, y: 3, layer: "inner1" }),
          wire({ x: -2, y: 4, layer: "inner1" }),
        ],
      },
    ],
  }

  return { input, power }
}

test("carrier search retains a first via that permits the only drill-clear exit", () => {
  for (const offset of [0, 2.75]) {
    const { input } = firstViaInput()
    input.bounds.minX += offset
    input.bounds.maxX += offset
    for (const obstacle of input.obstacles) obstacle.center.x += offset
    for (const connection of input.connections)
      for (const terminal of connection.pointsToConnect) terminal.x += offset
    const before = structuredClone(input)
    const solver = new SingleLayerConnectivitySolver(input, { gridStep: 0.1 })
    solver.solve()
    expect(solver.error).toBeNull()
    expect(solver.solved).toBe(true)
    expect(input).toEqual(before)
    expect(solver.traces).toHaveLength(1)
    expect(connectivityDrillConflicts(input, solver.traces)).toEqual([])
    const vias = solver.traces[0].route.filter((p) => p.route_type === "via")
    expect(vias).toHaveLength(2)
    expect(vias[0].x).toBeCloseTo(offset - 0.8)
    expect(vias[1].x).toBeCloseTo(offset + 0.2)
    const drc = validateRoutedCopperDrc({
      inputSrj: input,
      routedSrj: solver.getOutput(),
      clearance: 0.01,
      allowBlindAndBuriedVias: false,
    } as unknown as Parameters<typeof validateRoutedCopperDrc>[0])
    expect(drc.issues).toEqual([])
  }
})
test("shared fixed branch vias represent one physical hole and remain immutable", () => {
  const { input, power } = sharedViaInput()
  const before = structuredClone(input)
  const solver = new SingleLayerConnectivitySolver(input, {
    fixedConnections: [power],
  })
  solver.solve()
  expect(solver.error).toBeNull()
  expect(solver.solved).toBe(true)
  expect(input).toEqual(before)
  expect(solver.getOutput().traces.slice(0, 2)).toEqual(before.traces!)
  expect(connectivityDrillConflicts(input, solver.getOutput().traces)).toEqual(
    [],
  )
  const drc = validateRoutedCopperDrc({
    inputSrj: { ...input, connections: [...input.connections, power] },
    routedSrj: solver.getOutput(),
    clearance: 0.1,
    allowBlindAndBuriedVias: false,
  } as unknown as Parameters<typeof validateRoutedCopperDrc>[0])
  expect(drc.issues).toEqual([])
  const differentNet = structuredClone(input.traces!)
  differentNet[1].connection_name = "other-net"
  expect(connectivityDrillConflicts(input, differentNet)).toHaveLength(1)
  const distinctHoles = structuredClone(input.traces!)
  distinctHoles[1].route.find((p) => p.route_type === "via")!.x += 0.2
  expect(connectivityDrillConflicts(input, distinctHoles)).toHaveLength(1)
})
