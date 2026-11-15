import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import {
  getCopperLayerNames,
  getRouteViaSpanLayers,
  validateOriginalEndpointConnectivity,
  validateRoutedCopperDrc,
} from "@tscircuit/fanout-solver"
import { type AnyCircuitElement, pcb_trace, pcb_via } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { Connection, SimpleRouteJson, Trace } from "../../lib"

type Imx6PreloadedByteFixture = {
  input: SimpleRouteJson
  fixedConnections: Connection[]
  circuit: AnyCircuitElement[]
}

export function readImx6PreloadedByteFixture(): Imx6PreloadedByteFixture {
  return JSON.parse(
    gunzipSync(
      readFileSync(new URL("./imx6-preloaded-byte1.json.gz", import.meta.url)),
    ).toString("utf8"),
  ) as Imx6PreloadedByteFixture
}

/** Validate every original terminal, including TP27 and the supplied first byte. */
export function validateImx6ByteRouting({
  fixture,
  traces,
  includeSecondByte,
}: {
  fixture: Imx6PreloadedByteFixture
  traces: Trace[]
  includeSecondByte: boolean
}): ReturnType<typeof validateOriginalEndpointConnectivity> {
  const connections = includeSecondByte
    ? [...fixture.fixedConnections, ...fixture.input.connections]
    : fixture.fixedConnections
  const inputSrj = {
    ...fixture.input,
    connections,
    obstacles: fixture.input.obstacles.map((obstacle) => ({
      ...obstacle,
      type: "rect" as const,
    })),
    traces: fixture.input.traces?.map((trace) => {
      if (!trace.connection_name) throw Error("Supplied trace has no net owner")
      return { ...trace, connection_name: trace.connection_name }
    }),
  }
  const routedSrj = {
    ...inputSrj,
    traces: traces.map((trace) => {
      if (!trace.connection_name) throw Error("Routed trace has no net owner")
      return { ...trace, connection_name: trace.connection_name }
    }),
  }
  const context = { inputSrj, routedSrj }
  const connectivity = validateOriginalEndpointConnectivity(context)
  if (
    !connectivity.valid ||
    connectivity.connectedConnectionCount !== connections.length
  ) {
    throw Error("i.MX6 routing does not connect every native terminal")
  }
  const drc = validateRoutedCopperDrc({
    ...context,
    clearance: fixture.input.minTraceToPadEdgeClearance!,
    allowBlindAndBuriedVias: fixture.input.allowBlindAndBuriedVias ?? false,
  })
  if (!drc.valid)
    throw Error(`i.MX6 routed copper failed DRC: ${JSON.stringify(drc.issues)}`)
  return connectivity
}

/** Native PCB coordinates in mm, +X right/+Y up; only the camera changes. */
export function getImx6BytePcbSvg({
  fixture,
  traces,
  connectedConnectionCount,
  focused = false,
}: {
  fixture: Imx6PreloadedByteFixture
  traces: Trace[]
  connectedConnectionCount: number
  focused?: boolean
}): string {
  const circuit: AnyCircuitElement[] = [...fixture.circuit]
  const layerNames = getCopperLayerNames(fixture.input.layerCount)
  for (const trace of traces) {
    if (!trace.connection_name) throw Error("PCB trace has no native net owner")
    circuit.push(
      pcb_trace.parse({ ...trace, source_trace_id: trace.connection_name }),
    )
    for (const [index, point] of trace.route.entries()) {
      if (point.route_type !== "via") continue
      circuit.push(
        pcb_via.parse({
          type: "pcb_via",
          pcb_via_id: `${trace.pcb_trace_id}_via_${index}`,
          pcb_trace_id: trace.pcb_trace_id,
          x: point.x,
          y: point.y,
          outer_diameter: point.via_diameter ?? fixture.input.minViaPadDiameter,
          hole_diameter:
            point.via_hole_diameter ?? fixture.input.minViaHoleDiameter,
          layers: getRouteViaSpanLayers({
            fromLayer: point.from_layer,
            toLayer: point.to_layer,
            layers: point.layers,
            layerNames,
            allowBlindAndBuriedVias:
              fixture.input.allowBlindAndBuriedVias ?? false,
          }),
        }),
      )
    }
  }
  const packageNames = new Set(["U7", "U9", "TP27"])
  const packageIds = new Set(
    fixture.circuit.flatMap((element) =>
      element.type === "source_component" && packageNames.has(element.name)
        ? [element.source_component_id]
        : [],
    ),
  )
  const packages = fixture.circuit.filter(
    (element) =>
      element.type === "pcb_component" &&
      packageIds.has(element.source_component_id),
  )
  const corners = packages.flatMap((element) =>
    element.type === "pcb_component"
      ? [
          {
            x: element.center.x - element.width / 2,
            y: element.center.y - element.height / 2,
          },
          {
            x: element.center.x + element.width / 2,
            y: element.center.y + element.height / 2,
          },
        ]
      : [],
  )
  if (corners.length !== packageNames.size * 2)
    throw Error("Missing native DDR packages or TP27")
  const viewport = {
    minX: Math.min(...corners.map((point) => point.x)) - 3,
    maxX: Math.max(...corners.map((point) => point.x)) + 3,
    minY: Math.min(...corners.map((point) => point.y)) - 3,
    maxY: Math.max(...corners.map((point) => point.y)) + 3,
  }
  const svg = convertCircuitJsonToPcbSvg(circuit, {
    width: 1400,
    height: focused ? 1100 : 1400,
    ...(focused ? { viewport } : {}),
    backgroundColor: "white",
    shouldDrawErrors: false,
    shouldDrawRatsNest: false,
    showErrorsInTextOverlay: false,
    includeVersion: false,
    colorOverrides: {
      copper: {
        top: "#dc2626",
        bottom: "#2563eb",
        inner1: "#16a34a",
        inner2: "#ca8a04",
        inner3: "#9333ea",
        inner4: "#0891b2",
      },
      silkscreen: { top: "#475569", bottom: "#475569" },
    },
  })
  return svg.replace(
    "</svg>",
    `<rect x="10" y="8" width="1380" height="56" rx="4" fill="white" stroke="#334155"/><text x="700" y="32" text-anchor="middle" font-family="sans-serif" font-size="21" fill="#334155">${connectedConnectionCount}/${fixture.fixedConnections.length + fixture.input.connections.length} DDR data nets connected; accepted copper DRC passed</text><text x="700" y="55" text-anchor="middle" font-family="sans-serif" font-size="17" fill="#334155">${connectedConnectionCount === fixture.fixedConnections.length ? "Supplied first byte only; second byte requested" : "Both data bytes and TP27 connected; first byte unchanged"}. Full board remains incomplete.</text></svg>`,
  )
}
