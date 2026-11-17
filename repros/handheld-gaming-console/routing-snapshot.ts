import { mkdirSync, writeFileSync } from "node:fs"
import { applyToPoint, compose, scale, translate } from "transformation-matrix"
import { validateRoutedCopperDrc } from "@tscircuit/fanout-solver"
import { SingleLayerConnectivitySolver } from "../../lib/single-layer-connectivity-solver"
import { joinedSignalGeometryIsValid } from "../../lib/joined-signal-geometry"
import { busLengthReports } from "../../lib/route-lengths"
import type { SimpleRouteJson, Trace } from "../../lib/types"
import { loadInput } from "./input"
import provenance from "./provenance.json"

const dir = new URL("./", import.meta.url)

/** Board XY in mm (+Y up) to SVG pixels (+Y down); positions include translation. */
const boardToSvgTransform = compose(
  translate(30, 110),
  scale(21, -21),
  translate(10, -21),
)
const boardLengthToSvgTransform = scale(21)

function getSvgX(x: number) {
  return applyToPoint(boardToSvgTransform, { x, y: 0 }).x
}
function getSvgY(y: number) {
  return applyToPoint(boardToSvgTransform, { x: 0, y }).y
}
/** Lengths in mm become pixel lengths without translation. */
function getSvgLength(lengthMm: number) {
  return applyToPoint(boardLengthToSvgTransform, { x: lengthMm, y: 0 }).x
}
function formatCoordinate(coordinate: number) {
  return coordinate.toFixed(4)
}
function escapeXml(label: string) {
  return label.replace(
    /[<>&"]/g,
    (character) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[character]!,
  )
}
function renderSnapshotText({
  x,
  y,
  label,
  fontSize = 17,
  color = "#e0e8f4",
}: {
  x: number
  y: number
  label: string
  fontSize?: number
  color?: string
}) {
  return `<text x="${x}" y="${y}" fill="${color}" font-size="${fontSize}">${escapeXml(label)}</text>`
}

export function validateConnectivitySnapshot(
  input: SimpleRouteJson,
  traces: Trace[],
) {
  if (
    traces.length !== input.connections.length ||
    new Set(traces.map((t) => t.connection_name)).size !==
      input.connections.length
  )
    throw Error("Snapshot requires every requested signal exactly once")
  for (const c of input.connections) {
    const t = traces.find((t) => t.connection_name === c.name)
    if (!t) throw Error("Snapshot missing requested signal")
    for (const side of [0, 1]) {
      const p = side ? t.route.at(-1)! : t.route[0]
      const q = c.pointsToConnect[side]
      if (
        p.route_type !== "wire" ||
        p.layer !== q.layer ||
        Math.hypot(p.x - q.x, p.y - q.y) > 1e-8
      )
        throw Error("Snapshot endpoint mismatch")
    }
    if (!joinedSignalGeometryIsValid({ input, trace: t, smoothTuning: false }))
      throw Error("Snapshot self-clearance failed")
  }
  const vias = traces.flatMap((t) =>
    t.route.filter((p) => p.route_type === "via"),
  )
  for (let i = 0; i < vias.length; i++)
    for (let j = 0; j < i; j++) {
      const a = vias[i],
        b = vias[j],
        required =
          (input.minViaHoleEdgeToViaHoleEdgeClearance ?? 0) +
          ((a.via_hole_diameter ?? input.minViaHoleDiameter ?? 0.15) +
            (b.via_hole_diameter ?? input.minViaHoleDiameter ?? 0.15)) /
            2
      if (Math.hypot(a.x - b.x, a.y - b.y) < required - 1e-8)
        throw Error("Snapshot drill clearance failed")
    }
  const drc = validateRoutedCopperDrc({
    inputSrj: input,
    routedSrj: { ...input, traces },
    clearance: input.minTraceToPadEdgeClearance ?? 0.09,
    allowBlindAndBuriedVias: false,
  } as never)
  if (!drc.valid) throw Error("Snapshot copper DRC failed")
}

export function renderRoutingSnapshot({
  input,
  traces,
}: {
  input: SimpleRouteJson
  traces: Trace[]
}) {
  validateConnectivitySnapshot(input, traces)
  const color = "#66dfb6"
  const colors: Record<string, string> = {
    top: "#f5af53",
    inner3: "#56c9b2",
    bottom: "#b593f6",
  }
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="830" viewBox="0 0 1120 830"><rect width="1120" height="830" fill="#101a29"/><g font-family="Arial,sans-serif">`,
    renderSnapshotText({
      x: 28,
      y: 38,
      label: "Handheld Gaming Console — same six-layer routing fixture",
      fontSize: 25,
    }),
    renderSnapshotText({
      x: 28,
      y: 72,
      label: "PASS: 65 / 65 connected — geometry checks passed",
      fontSize: 22,
      color,
    }),
    '<rect x="25" y="105" width="430" height="660" fill="#19283c"/>',
  ]
  for (const p of input.obstacles) {
    if (!p.layers.includes("top")) continue
    if (p.shape === "circle")
      parts.push(
        `<circle cx="${formatCoordinate(getSvgX(p.center.x))}" cy="${formatCoordinate(getSvgY(p.center.y))}" r="${formatCoordinate(getSvgLength(p.width) / 2)}" fill="#6c8097"/>`,
      )
    else
      parts.push(
        `<rect x="${formatCoordinate(getSvgX(p.center.x - p.width / 2))}" y="${formatCoordinate(getSvgY(p.center.y + p.height / 2))}" width="${formatCoordinate(getSvgLength(p.width))}" height="${formatCoordinate(getSvgLength(p.height))}" fill="#6c8097"/>`,
      )
  }
  for (const t of traces)
    for (let i = 0; i < t.route.length; i++) {
      const a = t.route[i],
        b = t.route[i + 1]
      if (a.route_type === "via")
        parts.push(
          `<circle cx="${formatCoordinate(getSvgX(a.x))}" cy="${formatCoordinate(getSvgY(a.y))}" r="${formatCoordinate(getSvgLength(a.via_diameter ?? 0.25) / 2)}" fill="#eee0a9"/><circle cx="${formatCoordinate(getSvgX(a.x))}" cy="${formatCoordinate(getSvgY(a.y))}" r="${formatCoordinate(getSvgLength(a.via_hole_diameter ?? 0.15) / 2)}" fill="#19283c"/>`,
        )
      if (
        b &&
        a.route_type === "wire" &&
        b.route_type === "wire" &&
        a.layer === b.layer &&
        Math.hypot(a.x - b.x, a.y - b.y) > 1e-7
      )
        parts.push(
          `<path d="M ${formatCoordinate(getSvgX(a.x))} ${formatCoordinate(getSvgY(a.y))} L ${formatCoordinate(getSvgX(b.x))} ${formatCoordinate(getSvgY(b.y))}" stroke="${colors[a.layer] ?? "#fff"}" stroke-width="${formatCoordinate(getSvgLength(a.width))}" fill="none"/>`,
        )
    }
  const labels = [
    "Fresh solve with general connectivity fix",
    "65 requested signals / 65 accepted",
    "No saved routes supplied to solver",
    "Copper clearance: PASS",
    "Drill spacing: PASS",
    "Endpoints and self-clearance: PASS",
    "Original pads, placements and widths preserved",
    "Length matching: still failing",
    "Differential coupling: not approved",
  ]
  labels.forEach((label, i) =>
    parts.push(
      renderSnapshotText({
        x: 490,
        y: 150 + i * 48,
        label,
        fontSize: 18,
        color: i === 0 ? color : "#e0e8f4",
      }),
    ),
  )
  parts.push(
    renderSnapshotText({
      x: 490,
      y: 650,
      label: "Orange: top · Green: L4 signal",
      fontSize: 17,
    }),
    renderSnapshotText({
      x: 490,
      y: 690,
      label: "Other copper layers reserved or unused.",
      fontSize: 17,
    }),
    renderSnapshotText({
      x: 28,
      y: 797,
      label:
        "Connectivity-only regression. Not DDR timing, impedance or manufacturing approval.",
      fontSize: 17,
      color: "#ffcb75",
    }),
    "</g></svg>\n",
  )
  return parts.join("")
}

export function freshRoutingSnapshot() {
  const input = loadInput()
  input.allowedLayers = ["inner3"]
  const before = JSON.stringify(input)
  const solver = new SingleLayerConnectivitySolver(input, {
    gridStep: 0.1,
    maxPasses: 300,
    maxExpansionsPerRoute: 300000,
  })
  const start = performance.now()
  while (!solver.solved && !solver.failed && performance.now() - start < 600000)
    solver.step()
  if (JSON.stringify(input) !== before)
    throw Error("Snapshot solve mutated its fixture")
  if (!solver.solved)
    throw Error(solver.error ?? "Fresh connectivity solve exceeded its budget")
  const svg = renderRoutingSnapshot({ input, traces: solver.traces })
  return {
    svg,
    report: {
      solved: solver.solved,
      failed: solver.failed,
      error: solver.error,
      stats: solver.stats,
      acceptedRoutes: solver.traces.length,
      displayedCandidates: 0,
      fixtureSha256: provenance.input_sha256,
      busReports: busLengthReports(input, solver.traces),
      elapsedMs: performance.now() - start,
      scope: "connectivity-only; DDR matching remains unapproved",
    },
  }
}
if (import.meta.main) {
  mkdirSync(new URL("results/", dir), { recursive: true })
  const result = freshRoutingSnapshot()
  writeFileSync(new URL("board.snap.svg", dir), result.svg)
  writeFileSync(
    new URL("results/routing-snapshot.json", dir),
    JSON.stringify(result.report, null, 2) + "\n",
  )
  console.log({
    solved: result.report.solved,
    acceptedRoutes: result.report.acceptedRoutes,
  })
}
