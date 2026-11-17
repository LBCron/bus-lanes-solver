import { getCopperLayerNames } from "@tscircuit/fanout-solver"
import { getPackagePadFrame, type PackagePadFrame } from "./package-pad-frame"
import { packageApproachRegions } from "./package-approach-regions"
import { PendingOwnedCarrierAccess } from "./pending-owned-carrier-access"
import { pendingViaDimensions } from "./pending-via-dimensions"
import type { Connection, Obstacle, Point, SimpleRouteJson, Via } from "./types"
import { fixedCopper, type Copper } from "./vector-scene"

type ComponentId = string

const capturedInputFields = [
  "layerCount",
  "minTraceWidth",
  "minViaPadDiameter",
  "minViaHoleDiameter",
  "minViaHoleEdgeToViaHoleEdgeClearance",
  "minViaEdgeToPadEdgeClearance",
  "minTraceToHoleEdgeClearance",
  "minPlatedHoleDrillEdgeToDrillEdgeClearance",
  "minPadEdgeToPadEdgeClearance",
  "allowViaInPad",
  "allowBlindAndBuriedVias",
  "defaultObstacleMargin",
  "minTraceToPadEdgeClearance",
  "minBoardEdgeClearance",
  "bounds",
  "outline",
  "obstacles",
  "traces",
  "allowedLayers",
  "buses",
  "connections",
  "differentialPairs",
  "pendingRoutingAccess",
] as const satisfies readonly (keyof SimpleRouteJson)[]

function isViaPad(shape: Copper, viaPoints: ReadonlySet<Point>): boolean {
  return shape.a === shape.b && viaPoints.has(shape.a)
}

/** Physical copper and package metadata for one immutable candidate union.
 * Width, terminal ownership, and native-layer filtering remain in each scene.
 * Callers own the union lease: this context must not survive its input changing.
 * Obstacles and captured trace geometry are immutable within that lease. */
export class PendingPadGeometry {
  readonly physical: string[]
  readonly copper: Copper[]
  readonly traceCopper: Copper[]
  readonly traceSceneCopper: Copper[]
  readonly padCopper: Copper[]
  readonly wireCopper: Copper[]
  readonly padsAndVias: Copper[]
  readonly oldVias: Via[]
  readonly viaDiameter: number
  readonly holeDiameter: number
  readonly landingInput: SimpleRouteJson
  readonly holeInput?: SimpleRouteJson
  readonly componentPads: Obstacle[]
  readonly frameByComponent: ReadonlyMap<ComponentId, PackagePadFrame>
  private readonly captured: SimpleRouteJson
  private readonly ownedAccess = new Map<Connection, PendingOwnedCarrierAccess>()

  constructor(private readonly input: SimpleRouteJson) {
    this.captured = { ...input }
    this.physical = getCopperLayerNames(input.layerCount)
    const padClearance =
      input.minTraceToPadEdgeClearance ?? input.defaultObstacleMargin ?? 0.075
    const holes: Copper[] = (input.traces ?? []).flatMap((trace) =>
      trace.route.flatMap((point) => {
        if (point.route_type !== "via") return []
        const from = this.physical.indexOf(point.from_layer)
        const to = this.physical.indexOf(point.to_layer)
        const layers =
          point.layers ??
          this.physical.slice(Math.min(from, to), Math.max(from, to) + 1)
        return layers.map((layer) => ({
          a: point,
          b: point,
          layer,
          radius:
            (point.via_hole_diameter ?? input.minViaHoleDiameter ?? 0.15) / 2 +
            Math.max(
              0,
              (input.minTraceToHoleEdgeClearance ?? 0) - padClearance,
            ),
          owners: [trace.connection_name, trace.source_trace_id].filter(
            (owner): owner is string => !!owner,
          ),
        }))
      }),
    )
    this.copper = fixedCopper(input)
    this.traceSceneCopper = [...this.copper, ...holes]
    this.padCopper = fixedCopper({ ...input, traces: [] })
    const dimensions = pendingViaDimensions(input)
    this.viaDiameter = dimensions.padDiameter
    this.holeDiameter = dimensions.holeDiameter
    this.oldVias = (input.traces ?? []).flatMap((trace) =>
      trace.route.filter((point): point is Via => point.route_type === "via"),
    )
    const viaPoints = new Set<Point>(this.oldVias)
    this.traceCopper = fixedCopper({ ...input, obstacles: [] })
    this.wireCopper = this.traceCopper.filter((shape) => !isViaPad(shape, viaPoints))
    this.padsAndVias = [
      ...this.padCopper,
      ...this.traceCopper.filter((shape) => isViaPad(shape, viaPoints)),
    ]
    this.landingInput = {
      ...input,
      minTraceToPadEdgeClearance: Math.max(
        input.minViaEdgeToPadEdgeClearance ??
          input.minTraceToPadEdgeClearance ??
          input.defaultObstacleMargin ??
          0.075,
        input.minPadEdgeToPadEdgeClearance ?? 0,
      ),
    }
    if (
      (input.minTraceToHoleEdgeClearance ?? 0) + this.holeDiameter / 2 >
      padClearance + this.viaDiameter / 2
    )
      this.holeInput = {
        ...input,
        minTraceToPadEdgeClearance: input.minTraceToHoleEdgeClearance,
      }
    this.componentPads = input.obstacles.filter((pad) => pad.componentId)
    const components = new Map<ComponentId, Obstacle[]>()
    for (const pad of this.componentPads) {
      const componentId = pad.componentId!
      const pads = components.get(componentId) ?? []
      pads.push(pad)
      components.set(componentId, pads)
    }
    const regions = packageApproachRegions(input, 0)
    const frames = new Map<ComponentId, PackagePadFrame>()
    for (const [index, [componentId, pads]] of [...components].entries())
      frames.set(componentId, getPackagePadFrame(pads, regions[index].pads))
    this.frameByComponent = frames
  }

  /** Reuse physical owned topology only within this immutable union lease.
   * Terminal frames and future-width carrier targets remain scene-local. */
  ownedCarrierAccess(connection: Connection): PendingOwnedCarrierAccess {
    this.assertMatches(this.input)
    let access = this.ownedAccess.get(connection)
    if (!access) {
      access = new PendingOwnedCarrierAccess({
        input: this.input,
        connection,
        ownedCopper: this.copper,
        ownedTraceCopper: this.traceCopper,
        ownedVias: this.oldVias,
      })
      this.ownedAccess.set(connection, access)
    }
    return access
  }

  /** Constant-size identity/rule validation. Copper was prepared once;
   * serializing it here would repeat the terminal-times-board preparation. */
  assertMatches(input: SimpleRouteJson): void {
    if (input !== this.input)
      throw Error("Pending pad geometry belongs to a different input")
    for (const field of capturedInputFields)
      if (input[field] !== this.captured[field])
        throw Error(`Pending pad geometry input changed: ${field}`)
  }
}
