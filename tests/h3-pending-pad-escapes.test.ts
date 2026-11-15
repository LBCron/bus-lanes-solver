import "./fixtures/pcb-snapshot"
import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import { type AnyCircuitElement, pcb_trace, pcb_via } from "circuit-json"
import { getCopperLayerNames } from "@tscircuit/fanout-solver"
import {
  BusLanesPipelineSolver,
  type Connection,
  type SimpleRouteJson,
} from "../lib"
import { expectConnectedAndClear } from "./fixtures/expect-connected-and-clear"
import { type PadEscape, getPadEscape } from "./fixtures/pad-escapes"

type Fixture = {
  byte1Request: SimpleRouteJson
  fixedConnections: Connection[]
  pendingConnections: Connection[]
  circuit: AnyCircuitElement[]
}

const fixture = JSON.parse(
  gunzipSync(
    readFileSync(
      new URL(
        "./fixtures/h3-pending-pad-escapes/input.json.gz",
        import.meta.url,
      ),
    ),
  ).toString("utf8"),
) as Fixture

type PendingPad = { pcbPortId: string; escape: PadEscape }

/** Both pads of every connection the next phase has to route. */
function getPendingPads(input: SimpleRouteJson): PendingPad[] {
  return fixture.pendingConnections.flatMap((connection) =>
    ([0, 1] as const).map((end) => ({
      pcbPortId: connection.pointsToConnect[end].pcb_port_id!,
      escape: getPadEscape({
        input,
        connection,
        end,
        viaTargetLayer: "bottom",
      }),
    })),
  )
}

const svgOptions = {
  backgroundColor: "white",
  shouldDrawErrors: false,
  shouldDrawRatsNest: false,
  showErrorsInTextOverlay: false,
}

// Board coordinates in mm, +X right, +Y up. The H3 CPU is on the left and the
// DDR3 RAM on the right of this two-layer board.
test("H3 byte 1 leaves pads of later connections without an escape", async (): Promise<void> => {
  // Core hands each phase request to the solver without options.
  const input = fixture.byte1Request
  const original = structuredClone(input)
  const before = getPendingPads(input)
  const solver = new BusLanesPipelineSolver(input)
  solver.solve()
  expect(input).toEqual(original)
  expect(solver.error).toBeNull()
  expect(solver.solved).toBe(true)
  const traces = solver.getOutput().traces
  expect(traces).toHaveLength(16)
  expect(traces.slice(0, 8)).toEqual(original.traces!)
  expectConnectedAndClear({
    request: input,
    connections: [...fixture.fixedConnections, ...input.connections],
    traces,
  })

  // A pad is trapped when it had a via site or a surface exit before this
  // request and has neither afterwards. Via sites are those within the
  // solver's own escape reach.
  const after = getPendingPads({ ...input, traces })
  const trappedPorts = after
    .filter((pad, index) => before[index].escape && !pad.escape)
    .map((pad) => pad.pcbPortId)

  // All 16 routes drawn are completed and validated. Each trapped pad is
  // boxed, with a dashed guide to the pad its connection still has to reach.
  const circuit = [...fixture.circuit]
  const layers = getCopperLayerNames(input.layerCount)
  for (const trace of traces) {
    circuit.push(pcb_trace.parse(trace))
    for (const [index, point] of trace.route.entries()) {
      if (point.route_type !== "via") continue
      circuit.push(
        pcb_via.parse({
          type: "pcb_via",
          pcb_via_id: `${trace.pcb_trace_id}_via_${index}`,
          pcb_trace_id: trace.pcb_trace_id,
          x: point.x,
          y: point.y,
          outer_diameter: point.via_diameter ?? input.minViaPadDiameter,
          hole_diameter: point.via_hole_diameter ?? input.minViaHoleDiameter,
          layers,
        }),
      )
    }
  }
  for (const connection of fixture.pendingConnections) {
    const [first, second] = connection.pointsToConnect
    const trappedPads = [first, second].filter((pad) =>
      trappedPorts.includes(pad.pcb_port_id!),
    )
    if (!trappedPads.length) continue
    circuit.push({
      type: "pcb_note_line",
      pcb_note_line_id: `pending_${connection.name}`,
      layer: "top",
      x1: first.x,
      y1: first.y,
      x2: second.x,
      y2: second.y,
      stroke_width: 0.06,
      color: "#1d4ed8",
      is_dashed: true,
    })
    for (const pad of trappedPads) {
      const half = 0.26
      const corners = [
        { x: pad.x - half, y: pad.y - half },
        { x: pad.x + half, y: pad.y - half },
        { x: pad.x + half, y: pad.y + half },
        { x: pad.x - half, y: pad.y + half },
      ]
      for (const [index, corner] of corners.entries()) {
        const next = corners[(index + 1) % corners.length]
        circuit.push({
          type: "pcb_note_line",
          pcb_note_line_id: `trapped_${pad.pcb_port_id}_${index}`,
          layer: "top",
          x1: corner.x,
          y1: corner.y,
          x2: next.x,
          y2: next.y,
          stroke_width: 0.06,
          color: "#1d4ed8",
        })
      }
    }
  }
  const caption = `FAILED: byte 1 routed 8/8 beside byte 0, but ${trappedPorts.length} pads of later connections are left with no reachable via site and no surface exit (boxed)`
  await expect([
    ...circuit,
    {
      type: "pcb_note_text",
      pcb_note_text_id: "routing_status_board",
      pcb_group_id: "routing_status",
      text: caption,
      anchor_position: { x: 0, y: 9.3 },
      font: "tscircuit2024",
      layer: "top",
      font_size: 0.38,
      anchor_alignment: "center",
    },
  ]).toMatchPcbSnapshot({
    testPath: import.meta.path,
    svgOptions: {
      ...svgOptions,
      width: 1500,
      height: 1100,
      viewport: { minX: -14, maxX: 14, minY: -10.3, maxY: 10.3 },
    },
  })
  await expect([
    ...circuit,
    {
      type: "pcb_note_text",
      pcb_note_text_id: "routing_status_cpu",
      pcb_group_id: "routing_status",
      text: caption,
      anchor_position: { x: -4.2, y: 6.45 },
      font: "tscircuit2024",
      layer: "top",
      font_size: 0.115,
      anchor_alignment: "center",
    },
  ]).toMatchPcbSnapshot({
    testPath: import.meta.path,
    snapshotName: "cpu",
    svgOptions: {
      ...svgOptions,
      width: 1400,
      height: 1400,
      viewport: { minX: -7.8, maxX: -0.6, minY: -0.6, maxY: 6.6 },
    },
  })

  expect(trappedPorts).toEqual([
    "pcb_port_391",
    "pcb_port_345",
    "pcb_port_329",
    "pcb_port_361",
    "pcb_port_69",
    "pcb_port_407",
    "pcb_port_408",
    "pcb_port_409",
    "pcb_port_381",
    "pcb_port_51",
    "pcb_port_27",
    "pcb_port_20",
    "pcb_port_226",
    "pcb_port_364",
    "pcb_port_32",
    "pcb_port_363",
    "pcb_port_260",
  ])
}, 900_000)
