import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { gzipSync, gunzipSync } from "node:zlib"
import { Resvg } from "@resvg/resvg-js"
import type { AnyCircuitElement, PCBTrace } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import {
  applyToPoint,
  compose,
  rotate,
  scale,
  translate,
} from "transformation-matrix"

export type CaptureState = "baseline_timeout" | "completed"
type SourceTraceId = PCBTrace["source_trace_id"]

type Assessment = {
  requestedNets: number
  connectedNets: number
  unconnectedNets: string[]
  pcbTraces: number
  vias: number
  findings: Record<string, number>
  geometryErrors: string[]
}

type Progress = {
  renderCompleted: boolean
  errors: unknown[]
  phases: { phase: string; status: string; connections: number }[]
}

type BenchmarkCase = {
  circuit: string
  status: string
  wallMs: number
  progress: Progress
  assessment: Assessment
}

type BenchmarkResult = {
  coreCommit: string
  benchmarkRevision: string
  assessmentRevision: string
  fixtureHashes: Record<string, string>
  bunVersion: string
  timeoutSeconds: number
  cases: BenchmarkCase[]
}

type RunProvenance = {
  command: string
  coreCommit: string
  benchmarkPackagePin: string
  benchmarkRevision: string
  assessmentRevision: string
  busSourceCommit: string
  busDistributionSha256: string
  cpuQuota: string
  memoryLimitBytes: number
}

type CaptureProvenance = {
  state: CaptureState
  busSourceCommit: string
  busDistributionSha256: string
  coreCommit: string
  benchmarkPackagePin: string
  benchmarkRevision: string
  assessmentRevision: string
  fixtureSha256: string
  bunVersion: string
  timeoutSeconds: number
  cpuQuota: string
  memoryLimitBytes: number
  originalCommand: string
  caseStatus: string
  wallSeconds: number
  rawFileSha256: Record<string, string>
  completedByteOutputSha256: Record<string, string>
  scope: string
  interpretation: string
}

type NativeBoard = {
  parts: {
    name: string
    x: number
    y: number
    rotation: number
    pads: { x: number; y: number }[]
  }[]
}

const coreCommit = "1a16da2f74fc2c80712d52abb17254dd2a80e2c5"
const benchmarkPackagePin = "24dc44c166d4258c3538f8b1f66953f1b6f58690"
const benchmarkRevision =
  "sha256:07241d5c0af855ba5f7d0516d9cdbf62e00f0a048df8c7011165bcce697eb73c"
const fixtureSha256 =
  "d4b802885c286637ea8d7166c49ba0c8d14056d8e86eb95c483abb5fe82c5e31"
const layers = [
  "top",
  "inner1",
  "inner2",
  "inner3",
  "inner4",
  "bottom",
] as const
const viewport = { minX: -27, minY: -13, maxX: 27, maxY: 13 }

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex")
}

function readJson<T>(filename: string): T {
  return JSON.parse(readFileSync(filename, "utf8")) as T
}

function readCompressedJson<T>(filename: string): T {
  return JSON.parse(gunzipSync(readFileSync(filename)).toString()) as T
}

function getReferenceByteOutputHash({ stage }: { stage: number }): string {
  return sha256(
    gunzipSync(
      readFileSync(
        join(import.meta.dir, "source", `byte${stage}-end.srj.json.gz`),
      ),
    ),
  )
}

export function captureBenchmarkResult({
  captureRoot,
  directory,
  state,
}: {
  captureRoot: string
  directory: string
  state: CaptureState
}): void {
  const run = readJson<BenchmarkResult>(join(captureRoot, "results.json"))
  const source = readJson<RunProvenance>(join(captureRoot, "provenance.json"))
  const measured = run.cases.find((item) => item.circuit === "orangecrab")
  assert(measured, "Missing OrangeCrab benchmark case")
  assert.equal(run.coreCommit, coreCommit)
  assert.equal(run.fixtureHashes.orangecrab, fixtureSha256)
  assert.equal(run.timeoutSeconds, 120)
  assert.equal(run.benchmarkRevision, benchmarkRevision)
  assert.equal(run.assessmentRevision, benchmarkRevision)
  assert.equal(source.coreCommit, coreCommit)
  assert.equal(source.benchmarkPackagePin, benchmarkPackagePin)
  assert.equal(source.benchmarkRevision, benchmarkRevision)
  assert.equal(source.assessmentRevision, benchmarkRevision)
  assert.match(source.busSourceCommit, /^[a-f0-9]{40}$/)
  assert.match(source.busDistributionSha256, /^[a-f0-9]{64}$/)
  assert.equal(measured.status, state === "completed" ? "passed" : "timeout")
  if (state === "baseline_timeout")
    assert.equal(
      source.busSourceCommit,
      "202b034659fb96bad44d11b8190f4044b675116f",
    )

  const caseDirectory = join(captureRoot, "orangecrab")
  const rawFiles = ["circuit.json", "assessment.json", "progress.json"]
  const rawFileSha256: Record<string, string> = {}
  const completedByteOutputSha256: Record<string, string> = {}
  const captureDirectory = join(directory, "capture")
  mkdirSync(captureDirectory, { recursive: true })
  assert.deepEqual(
    readJson<Assessment>(join(caseDirectory, "assessment.json")),
    measured.assessment,
  )
  assert.deepEqual(
    readJson<Progress>(join(caseDirectory, "progress.json")),
    measured.progress,
  )
  for (const filename of rawFiles) {
    const bytes = readFileSync(join(caseDirectory, filename))
    rawFileSha256[filename] = sha256(bytes)
    writeFileSync(join(captureDirectory, `${filename}.gz`), gzipSync(bytes))
  }
  for (const stage of [1, 2]) {
    const bytes = readFileSync(
      join(caseDirectory, `phase-${stage}-end.srj.json`),
    )
    completedByteOutputSha256[`byte${stage}`] = sha256(bytes)
    assert.equal(sha256(bytes), getReferenceByteOutputHash({ stage }))
  }
  const provenance: CaptureProvenance = {
    state,
    busSourceCommit: source.busSourceCommit,
    busDistributionSha256: source.busDistributionSha256,
    coreCommit,
    benchmarkPackagePin,
    benchmarkRevision: run.benchmarkRevision,
    assessmentRevision: run.assessmentRevision,
    fixtureSha256,
    bunVersion: run.bunVersion,
    timeoutSeconds: run.timeoutSeconds,
    cpuQuota: source.cpuQuota,
    memoryLimitBytes: source.memoryLimitBytes,
    originalCommand: source.command,
    caseStatus: measured.status,
    wallSeconds: measured.wallMs / 1000,
    rawFileSha256,
    completedByteOutputSha256,
    scope:
      "Retained fresh core benchmark output, revalidated for snapshot export; this script performs no fresh routing.",
    interpretation:
      "The 16 DQ routes are unchanged. The additional 34 nets are the remaining capacity-autorouter output. Main also completed OrangeCrab in a repeat; this is a deadline-sensitive captured completion, not a deterministic bus-lanes geometry fix.",
  }
  writeFileSync(
    join(captureDirectory, "provenance.json"),
    `${JSON.stringify(provenance, null, 2)}\n`,
  )
}

function getRouteGeometry({ route }: { route: PCBTrace["route"] }) {
  return route.map((point) =>
    Object.fromEntries(
      Object.entries(point).filter(
        ([name]) =>
          name !== "start_pcb_port_id" &&
          name !== "end_pcb_port_id" &&
          name !== "layers",
      ),
    ),
  )
}

function assertNativePadsPreserved({
  circuit,
}: {
  circuit: AnyCircuitElement[]
}): void {
  const source = readCompressedJson<NativeBoard>(
    join(import.meta.dir, "source", "orangecrab.json.gz"),
  )
  const sourceComponents = circuit.filter(
    (item) => item.type === "source_component",
  )
  const pcbComponents = circuit.filter((item) => item.type === "pcb_component")
  const pads = circuit.filter((item) => item.type === "pcb_smtpad")
  assert.equal(pads.length, 385)
  assert.equal(
    source.parts.reduce((count, part) => count + part.pads.length, 0),
    385,
  )
  for (const part of source.parts) {
    const component = sourceComponents.find((item) => item.name === part.name)
    const pcbComponent = pcbComponents.find(
      (item) => item.source_component_id === component?.source_component_id,
    )
    assert(pcbComponent, `Missing native component ${part.name}`)
    const angle = (part.rotation * Math.PI) / 180
    const padLocalToBoard = compose(
      translate(part.x, part.y),
      rotate(angle),
      scale(1, -1),
    )
    for (const pad of part.pads) {
      const { x, y } = applyToPoint(padLocalToBoard, pad)
      assert(
        pads.some(
          (item) =>
            item.pcb_component_id === pcbComponent.pcb_component_id &&
            Math.hypot(item.x - x, item.y - y) < 1e-5,
        ),
        `Missing native pad center in ${part.name}`,
      )
    }
  }
}

function validateCapture({ directory }: { directory: string }) {
  const captureDirectory = join(directory, "capture")
  const provenance = readJson<CaptureProvenance>(
    join(captureDirectory, "provenance.json"),
  )
  const circuitBytes = gunzipSync(
    readFileSync(join(captureDirectory, "circuit.json.gz")),
  )
  assert.equal(sha256(circuitBytes), provenance.rawFileSha256["circuit.json"])
  for (const filename of ["assessment.json", "progress.json"])
    assert.equal(
      sha256(
        gunzipSync(readFileSync(join(captureDirectory, `${filename}.gz`))),
      ),
      provenance.rawFileSha256[filename],
    )
  assert.equal(provenance.coreCommit, coreCommit)
  assert.equal(provenance.benchmarkPackagePin, benchmarkPackagePin)
  assert.equal(provenance.benchmarkRevision, benchmarkRevision)
  assert.equal(provenance.assessmentRevision, benchmarkRevision)
  assert.equal(provenance.fixtureSha256, fixtureSha256)
  assert.equal(
    sha256(readFileSync(join(import.meta.dir, "source", "orangecrab.json.gz"))),
    fixtureSha256,
  )
  for (const stage of [1, 2])
    assert.equal(
      provenance.completedByteOutputSha256[`byte${stage}`],
      getReferenceByteOutputHash({ stage }),
    )
  const circuit = JSON.parse(circuitBytes.toString()) as AnyCircuitElement[]
  const assessment = readCompressedJson<Assessment>(
    join(captureDirectory, "assessment.json.gz"),
  )
  const progress = readCompressedJson<Progress>(
    join(captureDirectory, "progress.json.gz"),
  )
  assert.equal(assessment.requestedNets, 50)
  assert.deepEqual(assessment.geometryErrors, [])
  assert.deepEqual(progress.errors, [])
  assert.equal(progress.phases.length, 3)
  assert(
    progress.phases.slice(0, 2).every((phase) => phase.status === "completed"),
  )
  const traces = circuit.filter((item) => item.type === "pcb_trace")
  const vias = circuit.filter((item) => item.type === "pcb_via")
  assert.equal(traces.length, assessment.pcbTraces)
  assert.equal(vias.length, assessment.vias)
  const reference = readCompressedJson<{
    traces: { connection_name: string; route: PCBTrace["route"] }[]
  }>(join(import.meta.dir, "source", "byte2-end.srj.json.gz"))
  assert.equal(reference.traces.length, 16)
  const tracesBySourceTraceId = new Map<SourceTraceId, PCBTrace>(
    traces.map((trace) => [trace.source_trace_id, trace]),
  )
  for (const trace of reference.traces) {
    const captured = tracesBySourceTraceId.get(trace.connection_name)
    assert(captured, `Missing accepted DQ route ${trace.connection_name}`)
    assert.deepEqual(
      getRouteGeometry({ route: captured.route }),
      getRouteGeometry({ route: trace.route }),
    )
    // Core stores the manufactured span on pcb_via, not the route's via point.
    for (const point of trace.route) {
      if (point.route_type !== "via") continue
      const via = vias.find(
        (item) =>
          item.pcb_trace_id === captured.pcb_trace_id &&
          Math.hypot(item.x - point.x, item.y - point.y) < 1e-8,
      )
      assert(via, `Missing supplied via in ${trace.connection_name}`)
      assert.deepEqual(via.layers, [...layers])
      assert.equal(via.outer_diameter, point.via_diameter)
      assert.equal(via.hole_diameter, point.via_hole_diameter)
    }
  }
  if (provenance.state === "completed") {
    assert.equal(provenance.caseStatus, "passed")
    assert.equal(progress.renderCompleted, true)
    assert(progress.phases.every((phase) => phase.status === "completed"))
    assert.equal(assessment.connectedNets, 50)
    assert.deepEqual(assessment.unconnectedNets, [])
    assert(Object.values(assessment.findings).every((count) => count === 0))
    assert.equal(traces.length, 52)
    assert.equal(vias.length, 109)
  } else {
    assert.equal(provenance.state, "baseline_timeout")
    assert.equal(provenance.caseStatus, "timeout")
    assert.equal(progress.renderCompleted, false)
    assert.equal(progress.phases[2].status, "running")
    assert.equal(assessment.connectedNets, 16)
    assert.equal(assessment.unconnectedNets.length, 34)
    assert.equal(traces.length, 16)
    assert.equal(vias.length, 32)
    assert.equal(assessment.findings.disconnected_ports, 70)
    assert(
      Object.entries(assessment.findings).every(
        ([name, count]) => name === "disconnected_ports" || count === 0,
      ),
    )
    const acceptedTraceIds = new Set(traces.map((trace) => trace.pcb_trace_id))
    assert(
      vias.every(
        (via) => via.pcb_trace_id && acceptedTraceIds.has(via.pcb_trace_id),
      ),
    )
  }
  assertNativePadsPreserved({ circuit })
  return { circuit, assessment, provenance }
}

export function renderSnapshot({ directory }: { directory: string }): void {
  const { circuit, assessment, provenance } = validateCapture({ directory })
  const completed = provenance.state === "completed"
  const title = completed
    ? "COMPLETED CAPTURE: 50/50 requested DDR nets; physical/native geometry checks passed"
    : "TIMEOUT BASELINE: 16/50 requested DDR nets; 34 remain unconnected after 120 seconds"
  const subtitle =
    "16 DQ routes unchanged; added 34 nets belong to the remaining capacity autorouter"
  const note =
    "Deadline-sensitive retained capture; main also completed a repeat. No DDR timing or SI acceptance claimed."
  const width = 2040
  const panelWidth = 1000
  const panelHeight = 480
  const panelStrideY = 530
  const height = 1760
  const panels = layers.map((layer, index) => {
    const x = 20 + (index % 2) * 1010
    const y = 165 + Math.floor(index / 2) * panelStrideY
    const source = convertCircuitJsonToPcbSvg(circuit, {
      layer,
      width: panelWidth,
      height: panelHeight,
      viewport,
      backgroundColor: "white",
      colorOverrides: { boardOutline: "#94a3b8" },
      shouldDrawRatsNest: false,
      shouldDrawErrors: false,
      shouldDrawWarnings: false,
      showErrorsInTextOverlay: false,
      showDebugObjects: false,
      includeVersion: false,
    })
    const prefixed = source
      .replace(/id="([^"]+)"/g, `id="panel-${index}-$1"`)
      .replace(/url\(#([^)]+)\)/g, `url(#panel-${index}-$1)`)
      .replace(/href="#([^"]+)"/g, `href="#panel-${index}-$1"`)
      .replace(/<svg\b/, `<svg x="${x}" y="${y}"`)
    return `<text x="${x}" y="${y - 10}" font-family="monospace" font-size="22">${layer}</text>${prefixed}`
  })
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><title>${title}</title><rect width="100%" height="100%" fill="white"/><text x="20" y="34" font-family="monospace" font-size="24" fill="${completed ? "#166534" : "#b91c1c"}">${title}</text><text x="20" y="68" font-family="monospace" font-size="22">${subtitle}</text><text x="20" y="100" font-family="monospace" font-size="20">${note}</text><text x="20" y="132" font-family="monospace" font-size="20">${provenance.busSourceCommit.slice(0, 7)}; ${assessment.pcbTraces} PCB traces; ${assessment.vias} vias; 385 native pads; six physical layers</text>${panels.join("")}</svg>`
      .replace(/></g, ">\n<")
      .trimEnd() + "\n"
  const png = new Resvg(svg).render().asPng()
  const resultsDirectory = join(directory, "results")
  mkdirSync(resultsDirectory, { recursive: true })
  writeFileSync(join(directory, "board.snap.svg"), svg)
  writeFileSync(join(resultsDirectory, "board.png"), png)
  writeFileSync(
    join(directory, "snapshot-report.json"),
    `${JSON.stringify(
      {
        state: provenance.state,
        scope: provenance.scope,
        busSourceCommit: provenance.busSourceCommit,
        circuitSha256: provenance.rawFileSha256["circuit.json"],
        connectedNets: assessment.connectedNets,
        requestedNets: assessment.requestedNets,
        traceCount: assessment.pcbTraces,
        viaCount: assessment.vias,
        nativePadCount: 385,
        unchangedDataByteRoutes: 16,
        capacityRouterRequestedNets: 34,
        physicalLayers: layers.join(", "),
        viewport,
        physicalFindings: assessment.findings,
        nativeGeometryErrorCount: assessment.geometryErrors.length,
        svgSha256: sha256(svg),
        pngSha256: sha256(png),
        exporterSha256: sha256(readFileSync(import.meta.path)),
        entrypointSha256: sha256(
          readFileSync(join(import.meta.dir, "snapshot.ts")),
        ),
      },
      null,
      2,
    )}\n`,
  )
  console.log(
    `${provenance.state}: ${assessment.connectedNets}/50; ${assessment.pcbTraces} traces; all six layers exported`,
  )
}
