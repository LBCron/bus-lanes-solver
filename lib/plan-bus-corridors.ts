import { distance } from "./geometry"
import { MinHeap } from "./min-heap"
import { packageApproachRegions, pointInBox } from "./package-approach-regions"
import type { Connection, Point, SimpleRouteJson, Terminal } from "./types"
import { VectorScene, type Copper } from "./vector-scene"

type Bounds = SimpleRouteJson["bounds"]
export type ConnectionName = Connection["name"]
type CopperLayerName = Terminal["layer"]
type PlannedLane = {
  connection: Connection
  layer: CopperLayerName
  demand: number
  scene: VectorScene
  ends: Bounds[]
  known: Uint8Array
  blocked: Uint8Array
  path?: number[]
  occupied?: number[]
}

interface CorridorPlanningContext {
  bounds: Bounds
  step: number
  nx: number
  ny: number
  cells: number
  usage: Map<CopperLayerName, Float32Array>
  history: Map<CopperLayerName, Float32Array>
}

export interface BusCorridorGuide {
  readonly layer: CopperLayerName
  readonly path: readonly Point[]
  /** Dimensionless additive cost per routing-grid step. A guide never removes
   * a legal edge, changes connectivity, or claims its coarse path is copper. */
  costAt(point: Terminal): number
}

const directions = [-1, 0, 1].flatMap((dy) =>
  [-1, 0, 1]
    .filter((dx) => dx !== 0 || dy !== 0)
    .map((dx) => ({ dx, dy, length: Math.hypot(dx, dy) })),
)

function getCorridorGridPoint(
  { id }: { id: number },
  { bounds, nx, step }: CorridorPlanningContext,
): Point {
  return {
    x: bounds.minX + (id % nx) * step,
    y: bounds.minY + Math.floor(id / nx) * step,
  }
}

function getCorridorGridCell(
  { point }: { point: Point },
  { bounds, nx, ny, step }: CorridorPlanningContext,
): number {
  return (
    Math.max(0, Math.min(nx - 1, Math.round((point.x - bounds.minX) / step))) +
    nx *
      Math.max(0, Math.min(ny - 1, Math.round((point.y - bounds.minY) / step)))
  )
}

function getPointOnCorridorEdge({
  a,
  b,
  t,
}: {
  a: Point
  b: Point
  t: number
}): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/** Clip only endpoint escape fields; exterior portions retain exact visibility. */
function isCorridorEdgeClear({
  lane,
  a,
  b,
}: {
  lane: PlannedLane
  a: Point
  b: Point
}): boolean {
  const cuts = [0, 1]
  for (const box of lane.ends) {
    for (const [coordinate, low, high] of [
      ["x", box.minX, box.maxX],
      ["y", box.minY, box.maxY],
    ] as const) {
      const delta = b[coordinate] - a[coordinate]
      if (Math.abs(delta) < 1e-12) continue
      for (const edge of [low, high]) {
        const t = (edge - a[coordinate]) / delta
        if (t > 0 && t < 1) cuts.push(t)
      }
    }
  }
  cuts.sort((a, b) => a - b)
  for (let i = 1; i < cuts.length; i++) {
    const lo = cuts[i - 1],
      hi = cuts[i]
    if (
      lane.ends.some((box) =>
        pointInBox(getPointOnCorridorEdge({ a, b, t: (lo + hi) / 2 }), box),
      )
    )
      continue
    if (
      !lane.scene.visible(
        getPointOnCorridorEdge({ a, b, t: lo }),
        getPointOnCorridorEdge({ a, b, t: hi }),
      )
    )
      return false
  }
  return true
}

function* routeCorridorLane(
  { lane, negotiate }: { lane: PlannedLane; negotiate: boolean },
  context: CorridorPlanningContext,
): Generator<void, number[] | undefined> {
  const { cells, nx, ny, usage, history, step } = context
  const start = getCorridorGridCell(
    { point: lane.connection.pointsToConnect[0] },
    context,
  )
  const end = getCorridorGridCell(
    { point: lane.connection.pointsToConnect[1] },
    context,
  )
  const best = new Float64Array(cells).fill(Infinity)
  const parent = new Int32Array(cells).fill(-1)
  const heap = new MinHeap<{ id: number; f: number }>()
  const occupied = usage.get(lane.layer)!
  const accumulated = history.get(lane.layer)!
  best[start] = 0
  heap.push({ id: start, f: 0 })
  let expanded = 0
  while (heap.length) {
    const current = heap.pop()
    if (current.f > best[current.id] + 1e-9) continue
    if (current.id === end) {
      const result = [end]
      while (result[result.length - 1] !== start)
        result.push(parent[result[result.length - 1]])
      return result.reverse()
    }
    if (++expanded % 256 === 0) yield
    const x = current.id % nx,
      y = Math.floor(current.id / nx)
    for (const [direction, neighbor] of directions.entries()) {
      const xx = x + neighbor.dx,
        yy = y + neighbor.dy
      if (xx < 0 || xx >= nx || yy < 0 || yy >= ny) continue
      const id = xx + yy * nx
      const bit = 1 << direction
      if (!(lane.known[current.id] & bit)) {
        lane.known[current.id] |= bit
        if (
          !isCorridorEdgeClear({
            lane,
            a: getCorridorGridPoint({ id: current.id }, context),
            b: getCorridorGridPoint({ id }, context),
          })
        )
          lane.blocked[current.id] |= bit
      }
      if (lane.blocked[current.id] & bit) continue
      const released = lane.ends.some((box) =>
        pointInBox(getCorridorGridPoint({ id }, context), box),
      )
      const over = Math.max(0, (occupied[id] + lane.demand - step) / step)
      const congestion =
        negotiate && !released ? 4 * over * over + accumulated[id] : 0
      const cost = current.f + neighbor.length * (1 + congestion)
      if (cost >= best[id] - 1e-9) continue
      best[id] = cost
      parent[id] = current.id
      heap.push({ id, f: cost })
    }
  }
  // Coarse reachability cannot certify detailed unroutability.
  return undefined
}

function getCorridorFootprint(
  { lane, path }: { lane: PlannedLane; path: number[] },
  context: CorridorPlanningContext,
): number[] {
  const { step, nx, ny } = context
  const occupied = new Set<number>()
  const radius = Math.max(0, Math.ceil((lane.demand / step - 1) / 2))
  for (const id of path) {
    const x = id % nx,
      y = Math.floor(id / nx)
    for (
      let dy = Math.max(-radius, -y);
      dy <= Math.min(radius, ny - 1 - y);
      dy++
    )
      for (
        let dx = Math.max(-radius, -x);
        dx <= Math.min(radius, nx - 1 - x);
        dx++
      ) {
        const xx = x + dx,
          yy = y + dy
        const next = xx + yy * nx
        if (
          !lane.ends.some((box) =>
            pointInBox(getCorridorGridPoint({ id: next }, context), box),
          )
        )
          occupied.add(next)
      }
  }
  return [...occupied]
}

function updateCorridorUsage(
  { lane, sign }: { lane: PlannedLane; sign: number },
  { usage, step }: CorridorPlanningContext,
): void {
  const occupied = usage.get(lane.layer)!
  for (const id of lane.occupied ?? [])
    occupied[id] += sign * Math.min(step, lane.demand)
}

function getCorridorOverflow({ usage, step }: CorridorPlanningContext): number {
  let total = 0
  for (const layer of usage.values())
    for (const demand of layer) total += Math.max(0, demand - step - 1e-7)
  return total
}

/** Isolate guide lifetime from the planner's scenes, occupancy and history. */
function createBusCorridorGuide({
  guideLayer,
  path,
  ends,
  distances,
  bounds,
  step,
  nx,
  ny,
}: {
  guideLayer: CopperLayerName
  path: Point[]
  ends: Bounds[]
  distances: Float64Array
  bounds: Bounds
  step: number
  nx: number
  ny: number
}): BusCorridorGuide {
  return {
    layer: guideLayer,
    path,
    costAt({ x, y, layer }: Terminal): number {
      if (layer !== guideLayer) return 0
      let taper = 1
      for (const box of ends) {
        const away = Math.hypot(
          Math.max(box.minX - x, 0, x - box.maxX),
          Math.max(box.minY - y, 0, y - box.maxY),
        )
        taper = Math.min(taper, away / (2 * step))
      }
      if (taper <= 0) return 0
      const rawX = (x - bounds.minX) / step
      const rawY = (y - bounds.minY) / step
      const gx = Math.max(0, Math.min(nx - 1, rawX))
      const gy = Math.max(0, Math.min(ny - 1, rawY))
      const ix = Math.min(nx - 2, Math.floor(gx))
      const iy = Math.min(ny - 2, Math.floor(gy))
      const fx = gx - ix,
        fy = gy - iy
      const d =
        distances[ix + iy * nx] * (1 - fx) * (1 - fy) +
        distances[ix + 1 + iy * nx] * fx * (1 - fy) +
        distances[ix + (iy + 1) * nx] * (1 - fx) * fy +
        distances[ix + 1 + (iy + 1) * nx] * fx * fy
      const away = d + Math.hypot(rawX - gx, rawY - gy)
      return taper * Math.min(0.75, Math.max(0, away - 0.5) / 2)
    },
  }
}

/** Plan physical lane demand before detailed routing, including lanes within a
 * single bus. A small coarse negotiation spreads overloaded corridors; exact
 * copper routing remains responsible for escape geometry and acceptance.
 * Uncongested or unimproved coarse plans deliberately produce no guidance.
 */
export function* planBusCorridors({
  input,
  connections,
  fixed,
  widths,
  terminalLayers = new Map(),
}: {
  input: SimpleRouteJson
  connections: Connection[]
  fixed: Copper[]
  widths: ReadonlyMap<ConnectionName, number>
  terminalLayers?: ReadonlyMap<ConnectionName, CopperLayerName[]>
}): Generator<void, Map<ConnectionName, BusCorridorGuide>> {
  const guides = new Map<ConnectionName, BusCorridorGuide>()
  const members = new Set(input.buses?.flatMap((bus) => bus.connectionNames))
  // Coarse lane demand does not yet include space for length-tuning banks.
  // Keep matched cohorts on their existing matching-aware search objective.
  if (
    input.differentialPairs?.length ||
    input.buses?.some(
      (bus) =>
        bus.minLength !== undefined ||
        bus.maxLength !== undefined ||
        bus.maxLengthSkew !== undefined,
    )
  )
    return guides
  const pending = connections.filter((connection) =>
    members.has(connection.name),
  )
  if (pending.length < 2) return guides
  const clearance =
    input.minTraceToPadEdgeClearance ?? input.defaultObstacleMargin ?? 0.075
  const pitches = pending.map((connection) => {
    const width = widths.get(connection.name)
    if (width === undefined || !Number.isFinite(width) || width <= 0)
      throw Error(`Missing corridor width for ${connection.name}`)
    return width + clearance
  })
  const terminals = pending.flatMap((connection) => connection.pointsToConnect)
  const minX = Math.min(...terminals.map((point) => point.x))
  const maxX = Math.max(...terminals.map((point) => point.x))
  const minY = Math.min(...terminals.map((point) => point.y))
  const maxY = Math.max(...terminals.map((point) => point.y))
  const margin = Math.max(
    2,
    pitches.reduce((sum, pitch) => sum + pitch, 0),
    Math.max(maxX - minX, maxY - minY) / 4,
  )
  const bounds = {
    minX: Math.max(input.bounds.minX, minX - margin),
    maxX: Math.min(input.bounds.maxX, maxX + margin),
    minY: Math.max(input.bounds.minY, minY - margin),
    maxY: Math.min(input.bounds.maxY, maxY + margin),
  }
  const spanX = bounds.maxX - bounds.minX
  const spanY = bounds.maxY - bounds.minY
  if (spanX <= 0 || spanY <= 0) return guides
  // The planning graph is bounded independently of the detailed grid. Wide
  // boards increase tile size, rather than multiplying fine-grid searches.
  let step = Math.max(0.5, 4 * Math.min(...pitches))
  while ((Math.floor(spanX / step) + 1) * (Math.floor(spanY / step) + 1) > 4096)
    step *= 1.25
  const nx = Math.floor(spanX / step) + 1
  const ny = Math.floor(spanY / step) + 1
  if (nx < 2 || ny < 2) return guides
  const cells = nx * ny
  const packages = packageApproachRegions(input, step)
  const lanes: PlannedLane[] = pending.map((connection, index) => {
    const layer = connection.pointsToConnect[0].layer
    const available = terminalLayers.get(connection.name)
    if (available && !available.includes(layer))
      throw Error(`Initial corridor layer is forbidden for ${connection.name}`)
    const ends = connection.pointsToConnect.map((terminal) => {
      const region = packages.find((candidate) =>
        pointInBox(terminal, candidate.copper),
      )
      return (
        region?.copper ?? {
          minX: terminal.x - step,
          maxX: terminal.x + step,
          minY: terminal.y - step,
          maxY: terminal.y + step,
        }
      )
    })
    return {
      connection,
      layer,
      demand: pitches[index],
      scene: new VectorScene(
        input,
        connection,
        widths.get(connection.name)!,
        fixed,
      ),
      ends,
      known: new Uint8Array(cells),
      blocked: new Uint8Array(cells),
    }
  })
  const usage = new Map<CopperLayerName, Float32Array>()
  const history = new Map<CopperLayerName, Float32Array>()
  const context: CorridorPlanningContext = {
    bounds,
    step,
    nx,
    ny,
    cells,
    usage,
    history,
  }
  for (const lane of lanes) {
    if (usage.has(lane.layer)) continue
    usage.set(lane.layer, new Float32Array(cells))
    history.set(lane.layer, new Float32Array(cells))
  }
  for (const lane of lanes) {
    lane.path = yield* routeCorridorLane({ lane, negotiate: false }, context)
    if (!lane.path) continue
    lane.occupied = getCorridorFootprint({ lane, path: lane.path }, context)
    updateCorridorUsage({ lane, sign: 1 }, context)
  }
  const initialOverflow = getCorridorOverflow(context)
  if (initialOverflow < 1e-6) return guides
  let bestOverflow = initialOverflow
  let bestPaths = new Map<PlannedLane, number[]>()
  // Four coarse sweeps bound work independently of fine search retries. Wider
  // lanes have fewer available channels and receive their allocation first.
  const order = [...lanes].sort(
    (a, b) =>
      b.demand - a.demand ||
      distance(
        b.connection.pointsToConnect[0],
        b.connection.pointsToConnect[1],
      ) -
        distance(
          a.connection.pointsToConnect[0],
          a.connection.pointsToConnect[1],
        ),
  )
  for (let pass = 0; pass < 4; pass++) {
    for (const lane of order) {
      if (!lane.path) continue
      updateCorridorUsage({ lane, sign: -1 }, context)
      const path = yield* routeCorridorLane({ lane, negotiate: true }, context)
      if (!path)
        throw Error(
          `Previously reachable coarse corridor disappeared for ${lane.connection.name}`,
        )
      lane.path = path
      lane.occupied = getCorridorFootprint({ lane, path }, context)
      updateCorridorUsage({ lane, sign: 1 }, context)
    }
    const total = getCorridorOverflow(context)
    if (total < bestOverflow - 1e-6) {
      bestOverflow = total
      bestPaths = new Map(
        lanes.filter((lane) => lane.path).map((lane) => [lane, lane.path!]),
      )
    }
    if (bestOverflow < 1e-6) break
    for (const [layer, occupied] of usage) {
      const accumulated = history.get(layer)!
      for (let id = 0; id < cells; id++)
        accumulated[id] += Math.max(0, (occupied[id] - step) / step) / 2
    }
    yield
  }
  for (const [lane, path] of bestPaths) {
    const distances = new Float64Array(cells).fill(Infinity)
    const heap = new MinHeap<{ id: number; f: number }>()
    for (const id of path) {
      distances[id] = 0
      heap.push({ id, f: 0 })
    }
    let expanded = 0
    while (heap.length) {
      const current = heap.pop()
      if (current.f > distances[current.id] + 1e-5) continue
      if (++expanded % 1024 === 0) yield
      const x = current.id % nx,
        y = Math.floor(current.id / nx)
      for (const neighbor of directions) {
        const xx = x + neighbor.dx,
          yy = y + neighbor.dy
        if (xx < 0 || xx >= nx || yy < 0 || yy >= ny) continue
        const id = xx + yy * nx
        const next = current.f + neighbor.length
        if (next >= distances[id] - 1e-5) continue
        distances[id] = next
        heap.push({ id, f: next })
      }
    }
    guides.set(
      lane.connection.name,
      createBusCorridorGuide({
        guideLayer: lane.layer,
        path: path.map((id) => getCorridorGridPoint({ id }, context)),
        ends: lane.ends,
        distances,
        bounds,
        step,
        nx,
        ny,
      }),
    )
    yield
  }
  return guides
}
