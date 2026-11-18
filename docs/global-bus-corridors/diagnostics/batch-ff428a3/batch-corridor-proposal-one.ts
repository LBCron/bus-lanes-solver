import { readFileSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { negotiateLanes as negotiateBase } from "/workspace/bus-lanes-solver/lib/negotiate-lanes"
import { GridVisibilitySearch as BaseGridSearch } from "/workspace/bus-lanes-solver/lib/grid-visibility"
import { GridVisibilitySearch } from "/workspace/bus-lanes-work/lib/grid-visibility"
import { planBusCorridors } from "/workspace/bus-lanes-work/lib/plan-bus-corridors"
import { fixedCopper, routeCopper, VectorScene, type Copper } from "/workspace/bus-lanes-work/lib/vector-scene"
import { length, distance } from "/workspace/bus-lanes-work/lib/geometry"
import { validateRoutedCopperDrc } from "/workspace/bus-lanes-work/node_modules/@tscircuit/fanout-solver"
import type { Connection, SimpleRouteJson, Trace } from "/workspace/bus-lanes-work/lib/types"

if (process.env.CORRIDOR_BATCH_GO !== "1")
  throw Error("Prepared experiment only: root GO is required before execution")

const fixtureName = process.argv[2], mode = process.argv[3]
if (mode !== "base" && mode !== "batch") throw Error("mode must be base or batch")
const yieldBudget = 5000, maxExpansionsPerRoute = 64000, maximumOrders = 4
const launchedAt = new Date().toISOString()
const hash = (contents: string | Buffer): string => createHash("sha256").update(contents).digest("hex")
let cutTrackUpperBound: number | null = null
let input: SimpleRouteJson
if (fixtureName === "seed5") {
  input = JSON.parse(readFileSync("/workspace/bus-lanes-work/tests/fixtures/bus-corridors/three-barriers.json", "utf8"))
} else {
  const match = /^pocket(16|24|32)-(original|capacity)$/.exec(fixtureName)
  if (!match) throw Error("Unknown fixture")
  const count = Number(match[1]), outer = (count - 1) * 0.3 / 2 + 1.2, gap = 0.4
  const padding = match[2] === "capacity" ? Math.max(2.2, count * 0.15 + 0.4) : 2.2
  const pitch = 0.2
  // A cut across x=0 has one central aperture and two exterior bypasses.
  // The bound is necessary, not a proof of sufficient geometric routability.
  cutTrackUpperBound = Math.max(0, Math.floor((2 * gap - 0.3) / pitch + 1e-9) + 1) +
    2 * Math.max(0, Math.floor((padding - 0.3) / pitch + 1e-9) + 1)
  input = {
    layerCount: 2, minTraceWidth: 0.1, minTraceToPadEdgeClearance: 0.1, minBoardEdgeClearance: 0.1,
    bounds: { minX: -5, maxX: 5, minY: -outer - padding, maxY: outer + padding },
    connections: Array.from({ length: count }, (_, index) => ({ name: `D${index}`, pointsToConnect: [
      { x: -3, y: (index - (count - 1) / 2) * 0.3, layer: "top" },
      { x: 3, y: (index - (count - 1) / 2) * 0.3, layer: "top" },
    ] })),
    buses: [{ busId: "data", connectionNames: Array.from({ length: count }, (_, index) => `D${index}`) }],
    obstacles: [-1, 1].map((sign) => ({ center: { x: 0, y: sign * (outer + gap) / 2 }, width: 0.3,
      height: outer - gap, layers: ["top"], connectedTo: ["wall"] })),
  }
}

const metadata = {
  fixture: fixtureName, mode, baseRevision: "202b034659fb96bad44d11b8190f4044b675116f",
  headSourceHashes: Object.fromEntries(["negotiate-lanes.ts", "grid-visibility.ts", "plan-bus-corridors.ts"].map((name) => [name,
    createHash("sha256").update(readFileSync(`/workspace/bus-lanes-work/lib/${name}`)).digest("hex")])),
  runtime: Bun.version, yieldBudget, maxExpansionsPerRoute: mode === "batch" ? maxExpansionsPerRoute : null,
  maximumOrders: mode === "batch" ? maximumOrders : null, cutTrackUpperBound,
  cutProvesInsufficientCapacity: cutTrackUpperBound !== null && cutTrackUpperBound < input.connections.length,
  timingValidated: false,
  launchedAt,
  inputSha256: hash(JSON.stringify(input)),
  harnessSha256: hash(readFileSync(import.meta.path)),
  baseSourceHashes: Object.fromEntries(["negotiate-lanes.ts", "grid-visibility.ts"].map((name) => [name,
    hash(readFileSync(`/workspace/bus-lanes-solver/lib/${name}`))])),
}
const reportPath = `/tmp/batch-corridor-${fixtureName}-${mode}.json`
const width = (connection: Connection): number => connection.width ?? connection.nominalTraceWidth ?? input.minTraceWidth
const widths = new Map(input.connections.map((connection) => [connection.name, width(connection)]))
const immutable = fixedCopper(input)
const terminalCopper: Copper[] = input.connections.flatMap((connection) => connection.pointsToConnect.map((terminal) => ({
  a: terminal, b: terminal, layer: terminal.layer, radius: width(connection) / 2, owners: [connection.name],
})))
let totalExpansions = 0, searches = 0, routeAttempts = 0, coarsePlanningYields = 0
let yields = 0, bestPartial = 0, reportedIterations = 0
const solveStartedAt = performance.now()
const orderReports: Array<Record<string, unknown>> = []
const seenSearches = new WeakSet<object>()
const searchType = mode === "base" ? BaseGridSearch : GridVisibilitySearch
const rawStep = searchType.prototype.step
searchType.prototype.step = function (): void {
  if (!seenSearches.has(this)) { seenSearches.add(this); searches++ }
  const before = this.expanded
  rawStep.call(this)
  totalExpansions += this.expanded - before
}
const save = (extra: Record<string, unknown> = {}): void => writeFileSync(reportPath, JSON.stringify({
  ...metadata, yields, bestPartial, reportedIterations, searches, totalExpansions, routeAttempts, coarsePlanningYields,
  status: "running", input, orderReports, ...extra,
  elapsedSeconds: (performance.now() - solveStartedAt) / 1000,
}, null, 2))

function* batchProposal(): Generator<Trace[], Trace[] | null> {
  if (input.differentialPairs?.length || input.connections.some((connection) => connection.pointsToConnect.length !== 2 ||
    connection.pointsToConnect[0].layer !== connection.pointsToConnect[1].layer) ||
    input.buses?.some((bus) => bus.minLength !== undefined || bus.maxLength !== undefined || bus.maxLengthSkew !== undefined))
    throw Error("This standalone proposal handles untimed, single-layer ordinary lanes only")
  const planning = planBusCorridors(input, input.connections, [...immutable, ...terminalCopper], widths)
  let planned = planning.next()
  try {
    while (!planned.done) { coarsePlanningYields++; yield []; planned = planning.next() }
  } finally {
    if (!planned.done) planning.return(new Map())
  }
  const guides = planned.value!
  const flow = input.connections.reduce((sum, connection) => ({
    x: sum.x + connection.pointsToConnect[1].x - connection.pointsToConnect[0].x,
    y: sum.y + connection.pointsToConnect[1].y - connection.pointsToConnect[0].y,
  }), { x: 0, y: 0 })
  const span = Math.hypot(flow.x, flow.y)
  if (span <= 1e-8) throw Error("Fixture has no coherent bus direction")
  const normal = { x: -flow.y / span, y: flow.x / span }
  const project = (point: { x: number; y: number }): number => point.x * normal.x + point.y * normal.y
  const center = input.connections.flatMap((connection) => connection.pointsToConnect)
    .reduce((sum, point) => sum + project(point), 0) / (2 * input.connections.length)
  const score = new Map(input.connections.map((connection) => {
    const guide = guides.get(connection.name)
    const pins = connection.pointsToConnect
    return [connection.name, {
      guideLength: guide ? length([...guide.path]) : distance(pins[0], pins[1]),
      guideExterior: Math.max(...(guide?.path ?? pins).map((point) => Math.abs(project(point) - center))),
      terminalExterior: Math.max(...pins.map((point) => Math.abs(project(point) - center))),
      signed: (project(pins[0]) + project(pins[1])) / 2 - center,
    }]
  }))
  const orders = [
    { name: "guide_exterior", compare: (a: Connection, b: Connection): number => score.get(b.name)!.guideExterior - score.get(a.name)!.guideExterior || score.get(b.name)!.guideLength - score.get(a.name)!.guideLength },
    { name: "guide_length", compare: (a: Connection, b: Connection): number => score.get(b.name)!.guideLength - score.get(a.name)!.guideLength || score.get(b.name)!.terminalExterior - score.get(a.name)!.terminalExterior },
    { name: "terminal_exterior_positive_first", compare: (a: Connection, b: Connection): number => score.get(b.name)!.terminalExterior - score.get(a.name)!.terminalExterior || score.get(b.name)!.signed - score.get(a.name)!.signed },
    { name: "terminal_exterior_negative_first", compare: (a: Connection, b: Connection): number => score.get(b.name)!.terminalExterior - score.get(a.name)!.terminalExterior || score.get(a.name)!.signed - score.get(b.name)!.signed },
  ]
  const tried = new Set<string>()
  for (const order of orders.slice(0, maximumOrders)) {
    const pending = [...input.connections].sort(order.compare)
    const key = pending.map((connection) => connection.name).join("\0")
    if (tried.has(key)) continue
    tried.add(key)
    const completed: Trace[] = []
    const occupied: Copper[] = []
    const report: Record<string, unknown> = { order: order.name, connections: pending.map((connection) => connection.name), status: "running", completedTraces: completed }
    orderReports.push(report)
    for (const connection of pending) {
      routeAttempts++
      report.currentConnection = connection.name
      report.completedPrefix = completed.length
      const layer = connection.pointsToConnect[0].layer
      const guide = guides.get(connection.name)
      const scene = new VectorScene(input, connection, width(connection), [...immutable, ...terminalCopper, ...occupied])
      const search = new GridVisibilitySearch(scene, connection.pointsToConnect[0], connection.pointsToConnect[1], [], 0, undefined, {
        checkReachability: true,
        costAt: guide ? (x: number, y: number): number => guide.costAt(x, y, layer) : undefined,
      })
      try {
        while (!search.solved && !search.failed && search.expanded + 500 <= maxExpansionsPerRoute) {
          search.step()
          yield completed
        }
        if (!search.solved) {
          report.status = search.failed ? "blocked" : "route_expansion_budget"
          report.failedConnection = connection.name
          report.completedPrefix = completed.length
          report.failedRouteExpansions = search.expanded
          break
        }
        const trace: Trace = {
          type: "pcb_trace", pcb_trace_id: `batch_${connection.name}`, connection_name: connection.name,
          source_trace_id: connection.source_trace_id ?? connection.name,
          route: search.result.map((point) => ({ ...point, route_type: "wire", layer, width: width(connection) })),
        }
        completed.push(trace)
        occupied.push(...routeCopper(trace))
        report.completedPrefix = completed.length
      } finally { search.cancel() }
    }
    bestPartial = Math.max(bestPartial, completed.length)
    if (completed.length !== input.connections.length) continue
    const connected = input.connections.every((connection) => {
      const matches = completed.filter((trace) => trace.connection_name === connection.name)
      return matches.length === 1 && [matches[0].route[0], matches[0].route.at(-1)!].every((point, side) =>
        distance(point, connection.pointsToConnect[side]) < 1e-8 && "layer" in point && point.layer === connection.pointsToConnect[side].layer)
    })
    const drc = validateRoutedCopperDrc({ inputSrj: input, routedSrj: { ...input, traces: completed }, clearance: 0.1,
      allowBlindAndBuriedVias: false } as Parameters<typeof validateRoutedCopperDrc>[0])
    report.status = connected && drc.valid ? "accepted" : "complete_but_rejected"
    report.connected = connected
    report.drcValid = drc.valid
    report.drcIssueCount = drc.issues.length
    report.drcIssues = drc.issues
    if (connected && drc.valid) return completed
  }
  return null
}

save()
const work = mode === "base" ? negotiateBase(input, input.connections, [...immutable, ...terminalCopper], [], widths,
  (iteration) => { reportedIterations = Math.max(reportedIterations, iteration) }) : batchProposal()
let state = work.next()
try {
  while (!state.done && yields < yieldBudget) {
    bestPartial = Math.max(bestPartial, state.value.length)
    yields++
    if (yields % 50 === 0) save()
    state = work.next()
  }
} finally { if (!state.done) work.return(null) }
const output = state.done ? state.value : null
const connected = !!output && output.length === input.connections.length && input.connections.every((connection) => {
  const matches = output.filter((trace) => trace.connection_name === connection.name)
  return matches.length === 1 && [matches[0].route[0], matches[0].route.at(-1)!].every((point, side) =>
    distance(point, connection.pointsToConnect[side]) < 1e-8 && "layer" in point && point.layer === connection.pointsToConnect[side].layer)
})
const drc = output ? validateRoutedCopperDrc({ inputSrj: input, routedSrj: { ...input, traces: output }, clearance: 0.1,
  allowBlindAndBuriedVias: false } as Parameters<typeof validateRoutedCopperDrc>[0]) : null
save({ status: !state.done ? "yield_budget_exhausted" : !output ? "no_complete_proposal" : connected && drc?.valid ? "completed" : "rejected_output",
  completed: connected && !!drc?.valid, connections: output?.length ?? 0, connected, drcValid: drc?.valid ?? null,
  drcIssues: drc?.issues ?? null,
  totalCopperLengthMm: output?.reduce((sum, trace) => sum + length(trace.route), 0) ?? null,
  longestRouteMm: output ? Math.max(...output.map((trace) => length(trace.route))) : null,
  input, output })
