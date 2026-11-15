import "./fixtures/pcb-snapshot"
import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import {
  getCopperLayerNames,
  validateOriginalEndpointConnectivity,
  validateRoutedCopperDrc,
} from "@tscircuit/fanout-solver"
import { type AnyCircuitElement, pcb_trace, pcb_via } from "circuit-json"
import {
  BusLanesPipelineSolver,
  type Connection,
  type SimpleRouteJson,
  type Trace,
} from "../lib"

type Fixture = {
  ramByte0Request: SimpleRouteJson
  ramByte1Connections: Connection[]
  ramByte1Buses: NonNullable<SimpleRouteJson["buses"]>
  fixedConnections: Connection[]
  circuit: AnyCircuitElement[]
}

/** Every listed connection reaches both native pads and all copper passes DRC. */
function expectConnectedAndClear(
  request: SimpleRouteJson,
  connections: Connection[],
  traces: Trace[],
): void {
  const owned = (trace: Trace) => {
    if (!trace.connection_name) throw Error("Trace has no net owner")
    return { ...trace, connection_name: trace.connection_name }
  }
  const inputSrj = {
    ...request,
    connections,
    obstacles: request.obstacles.map((obstacle) => ({
      ...obstacle,
      type: "rect" as const,
    })),
    traces: request.traces?.map(owned),
  }
  const context = {
    inputSrj,
    routedSrj: { ...inputSrj, traces: traces.map(owned) },
  }
  const connectivity = validateOriginalEndpointConnectivity(context)
  expect(connectivity.valid).toBe(true)
  expect(connectivity.connectedConnectionCount).toBe(connections.length)
  expect(
    validateRoutedCopperDrc({
      ...context,
      clearance: request.minTraceToPadEdgeClearance!,
      allowBlindAndBuriedVias: request.allowBlindAndBuriedVias ?? false,
    }).valid,
  ).toBe(true)
}

// Board coordinates in mm, +X right, +Y up. RAM U200 is on the left, the
// series resistor networks in the middle and CPU U100 on the right.
test("A13 RAM byte 1 routes after RAM byte 0", async (): Promise<void> => {
  const fixture = JSON.parse(
    gunzipSync(
      readFileSync(
        new URL(
          "./fixtures/a13-ram-bytes-sequence/input.json.gz",
          import.meta.url,
        ),
      ),
    ).toString("utf8"),
  ) as Fixture

  // Core hands each phase request to the solver without options.
  const first = fixture.ramByte0Request
  const originalFirst = structuredClone(first)
  const byte0 = new BusLanesPipelineSolver(first)
  byte0.solve()
  expect(first).toEqual(originalFirst)
  expect(byte0.error).toBeNull()
  expect(byte0.solved).toBe(true)
  const afterByte0 = byte0.getOutput().traces
  expect(afterByte0).toHaveLength(24)
  expect(afterByte0.slice(0, 16)).toEqual(originalFirst.traces!)
  expectConnectedAndClear(
    first,
    [...fixture.fixedConnections, ...first.connections],
    afterByte0,
  )

  // Core's next request: the same board, the copper completed so far and the
  // next byte. Its supplied copper is the solver's own RAM byte 0 output.
  const second: SimpleRouteJson = {
    ...first,
    connections: fixture.ramByte1Connections,
    buses: fixture.ramByte1Buses,
    traces: afterByte0,
  }
  const originalSecond = structuredClone(second)
  const byte1 = new BusLanesPipelineSolver(second)
  byte1.solve()
  expect(second).toEqual(originalSecond)

  expect(byte1.error).toBeNull()
  expect(byte1.solved).toBe(true)
  const traces = byte1.getOutput().traces
  expect(traces).toHaveLength(32)
  expect(traces.slice(0, 24)).toEqual(afterByte0)
  expectConnectedAndClear(
    second,
    [...fixture.fixedConnections, ...first.connections, ...second.connections],
    traces,
  )

  const caption =
    "COMPLETED: RAM byte 1 8/8 after RAM byte 0 8/8; 32/32 routes connected; earlier copper unchanged; DRC passed"
  const circuit = [...fixture.circuit]
  const layers = getCopperLayerNames(second.layerCount)
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
          outer_diameter: point.via_diameter ?? second.minViaPadDiameter,
          hole_diameter: point.via_hole_diameter ?? second.minViaHoleDiameter,
          layers,
        }),
      )
    }
  }
  const svgOptions = {
    backgroundColor: "white",
    shouldDrawErrors: false,
    shouldDrawRatsNest: false,
    showErrorsInTextOverlay: false,
  }
  const status = (
    x: number,
    y: number,
    fontSize: number,
  ): AnyCircuitElement => ({
    type: "pcb_note_text",
    pcb_note_text_id: `routing_status_${x}_${y}`,
    pcb_group_id: "routing_status",
    text: caption,
    anchor_position: { x, y },
    font: "tscircuit2024",
    layer: "top",
    font_size: fontSize,
    anchor_alignment: "center",
  })
  await expect([...circuit, status(12, 15.5, 0.5)]).toMatchPcbSnapshot({
    testPath: import.meta.path,
    svgOptions: {
      ...svgOptions,
      width: 1400,
      height: 1000,
      viewport: { minX: -10, maxX: 38, minY: -19, maxY: 18 },
    },
  })
  await expect([...circuit, status(0, 12.6, 0.27)]).toMatchPcbSnapshot({
    testPath: import.meta.path,
    snapshotName: "ram",
    svgOptions: {
      ...svgOptions,
      width: 1300,
      height: 1400,
      viewport: { minX: -9.5, maxX: 9.5, minY: -7.5, maxY: 13 },
    },
  })
}, 900_000)
