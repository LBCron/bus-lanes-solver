import "./fixtures/pcb-snapshot"
import { expect, test } from "bun:test"
import { Buffer } from "node:buffer"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import { type AnyCircuitElement, pcb_trace, pcb_via } from "circuit-json"
import { getCopperLayerNames } from "@tscircuit/fanout-solver"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
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

/** Every native terminal of every connection the next phase has to route. */
function getPendingPads(input: SimpleRouteJson): PendingPad[] {
  return fixture.pendingConnections.flatMap((connection) =>
    connection.pointsToConnect.map((point, end) => ({
      pcbPortId: point.pcb_port_id!,
      escape: getPadEscape({
        input,
        connection,
        end,
        viaTargetLayer: "bottom",
      }),
    })),
  )
}

function statusNote(
  id: string,
  text: string,
  x: number,
  y: number,
  fontSize: number,
): AnyCircuitElement {
  return {
    type: "pcb_note_text",
    pcb_note_text_id: id,
    pcb_group_id: "routing_status",
    text,
    anchor_position: { x, y },
    font: "tscircuit2024",
    layer: "top",
    font_size: fontSize,
    anchor_alignment: "center",
  }
}

// Temporary exact transport of the canonical renderer output. Remove this
// helper after CI-generated goldens have been captured and committed.
async function emitCanonicalSvg(
  name: "PCB" | "CPU",
  svg: string,
): Promise<void> {
  const bytes = Buffer.from(svg, "utf8")
  const encoded = bytes.toString("base64")
  const prefix = "BUS_H3_PENDING_PAD_ESCAPES_" + name + "_SVG"
  const lines = [prefix + "_BASE64_BEGIN"]
  for (let offset = 0; offset < encoded.length; offset += 120) {
    lines.push(encoded.slice(offset, offset + 120))
  }
  lines.push(prefix + "_BASE64_END")
  lines.push(
    prefix +
      "_SHA256 " +
      createHash("sha256").update(bytes).digest("hex") +
      " bytes=" +
      bytes.length,
  )
  // One awaited write retains the complete transport before a stale-golden
  // assertion can fail; per-line console writes can be lost under CI pressure.
  await Bun.write(Bun.stdout, lines.join("\n") + "\n")
}

const svgOptions = {
  backgroundColor: "white",
  colorOverrides: { boardOutline: "#475569" },
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

  // A terminal is newly trapped only if it had an escape before byte 1.
  // Keep terminals that were already inaccessible separate in both views.
  const beforeByPortId = new Map(before.map((pad) => [pad.pcbPortId, pad]))
  expect(beforeByPortId.size).toBe(76)
  const after = getPendingPads({ ...input, traces })
  expect(after).toHaveLength(76)
  const trappedPorts = after
    .filter((pad) => beforeByPortId.get(pad.pcbPortId)!.escape && !pad.escape)
    .map((pad) => pad.pcbPortId)
  const alreadyInaccessiblePorts = after
    .filter((pad) => !beforeByPortId.get(pad.pcbPortId)!.escape && !pad.escape)
    .map((pad) => pad.pcbPortId)
  const initiallyInaccessiblePorts = before
    .filter((pad) => !pad.escape)
    .map((pad) => pad.pcbPortId)
  const recoveredPorts = after
    .filter((pad) => !beforeByPortId.get(pad.pcbPortId)!.escape && pad.escape)
    .map((pad) => pad.pcbPortId)

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

  // All 16 routes drawn are completed and validated. Boxes mark unavailable
  // native terminals; dashed lines are pending requests, never routed copper.
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
  const newlyTrapped = new Set(trappedPorts)
  const alreadyInaccessible = new Set(alreadyInaccessiblePorts)
  const newColor = "#1d4ed8"
  const existingColor = "#b45309"
  for (const connection of fixture.pendingConnections) {
    const unavailablePads = connection.pointsToConnect.filter(
      (pad) =>
        newlyTrapped.has(pad.pcb_port_id!) ||
        alreadyInaccessible.has(pad.pcb_port_id!),
    )
    if (!unavailablePads.length) continue
    const guideColor = unavailablePads.some((pad) =>
      newlyTrapped.has(pad.pcb_port_id!),
    )
      ? newColor
      : existingColor
    const first = connection.pointsToConnect[0]
    // Include every branch of native multi-terminal nets, including their
    // bottom-layer resistor terminals.
    for (const [index, point] of connection.pointsToConnect.entries()) {
      if (!index) continue
      circuit.push({
        type: "pcb_note_line",
        pcb_note_line_id: "pending_" + connection.name + "_" + index,
        layer: "top",
        x1: first.x,
        y1: first.y,
        x2: point.x,
        y2: point.y,
        stroke_width: 0.06,
        color: guideColor,
        is_dashed: true,
      })
    }
    for (const pad of unavailablePads) {
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
          pcb_note_line_id: "unavailable_" + pad.pcb_port_id + "_" + index,
          layer: "top",
          x1: corner.x,
          y1: corner.y,
          x2: next.x,
          y2: next.y,
          stroke_width: 0.06,
          color: newlyTrapped.has(pad.pcb_port_id!) ? newColor : existingColor,
        })
      }
    }
  }

  // Label native top-side packages at their actual component bounds.
  for (const element of fixture.circuit) {
    if (element.type !== "pcb_component" || element.layer !== "top") continue
    const source = fixture.circuit.find(
      (candidate) =>
        candidate.type === "source_component" &&
        candidate.source_component_id === element.source_component_id,
    )
    if (!source || source.type !== "source_component") continue
    circuit.push(
      statusNote(
        "package_" + element.pcb_component_id,
        [source.name, source.manufacturer_part_number]
          .filter(Boolean)
          .join(" / "),
        element.center.x,
        element.center.y + element.height / 2 + 0.7,
        0.45,
      ),
    )
  }

  const board = fixture.circuit.find((element) => element.type === "pcb_board")
  if (!board) throw Error("The native fixture has no PCB board")
  const boardBounds = {
    minX: board.center.x - board.width / 2,
    maxX: board.center.x + board.width / 2,
    minY: board.center.y - board.height / 2,
    maxY: board.center.y + board.height / 2,
  }
  const title =
    "FAILED future access: " +
    trappedPorts.length +
    " newly trapped pads (blue); " +
    alreadyInaccessiblePorts.length +
    " already inaccessible (amber)"
  const scope =
    "16 completed routes validated; 37 later connections remain unrouted. " +
    "All 76 native terminals checked; dashed lines are requests."
  const fullCircuit = [
    ...circuit,
    statusNote(
      "routing_status_board",
      title,
      board.center.x,
      boardBounds.maxY + 2.2,
      0.47,
    ),
    statusNote(
      "routing_scope_board",
      scope,
      board.center.x,
      boardBounds.maxY + 1.25,
      0.32,
    ),
  ]
  const fullOptions = {
    ...svgOptions,
    width: 1600,
    height: 1100,
    viewport: {
      minX: boardBounds.minX - 1.5,
      maxX: boardBounds.maxX + 1.5,
      minY: boardBounds.minY - 1.5,
      maxY: boardBounds.maxY + 3.3,
    },
  }
  const cpuCircuit = [
    ...circuit,
    statusNote(
      "routing_status_cpu",
      "FAILED: " + trappedPorts.length + " newly trapped pads (blue)",
      -4.2,
      6.45,
      0.115,
    ),
    statusNote(
      "routing_scope_cpu",
      alreadyInaccessiblePorts.length +
        " already inaccessible (amber); only 16 completed routes",
      -4.2,
      6.2,
      0.095,
    ),
  ]
  const cpuOptions = {
    ...svgOptions,
    width: 1400,
    height: 1400,
    viewport: { minX: -7.8, maxX: -0.6, minY: -0.6, maxY: 6.6 },
  }

  // All solver, connectivity, DRC, copper-preservation and regression
  // assertions precede diagnostic emission. Goldens are canonical output.
  console.log(
    "BUS_H3_PENDING_PAD_ESCAPES_ACCESS_REPORT " +
      JSON.stringify({
        completedRoutes: traces.length,
        pendingConnections: fixture.pendingConnections.length,
        terminalsChecked: after.length,
        initiallyInaccessiblePorts,
        alreadyInaccessiblePorts,
        newlyTrappedPorts: trappedPorts,
        recoveredPorts,
      }),
  )
  await emitCanonicalSvg(
    "PCB",
    convertCircuitJsonToPcbSvg(fullCircuit, {
      showDebugObjects: true,
      ...fullOptions,
    }),
  )
  await emitCanonicalSvg(
    "CPU",
    convertCircuitJsonToPcbSvg(cpuCircuit, {
      showDebugObjects: true,
      ...cpuOptions,
    }),
  )
  await expect(fullCircuit).toMatchPcbSnapshot({
    testPath: import.meta.path,
    svgOptions: fullOptions,
  })
  await expect(cpuCircuit).toMatchPcbSnapshot({
    testPath: import.meta.path,
    snapshotName: "cpu",
    svgOptions: cpuOptions,
  })
}, 900_000)
