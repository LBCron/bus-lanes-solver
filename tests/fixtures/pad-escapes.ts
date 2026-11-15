import { applyToPoint } from "transformation-matrix"
import { expandedSignalSites } from "../../lib/expanded-signal-sites"
import { GridVisibilitySearch } from "../../lib/grid-visibility"
import { packageApproachRegions } from "../../lib/package-approach-regions"
import { getPackagePadFrame } from "../../lib/package-pad-frame"
import type { Connection, Obstacle, SimpleRouteJson } from "../../lib/types"
import { VectorScene, fixedCopper } from "../../lib/vector-scene"

type PcbPortId = string
type NativePad = Obstacle & {
  circuitJsonMetadata?: { pcb_port_id?: PcbPortId }
}

/** How a pad can still be reached: through a legal via site, or by leaving
 * its package's pad field on its own layer. `null` means neither. */
export type PadEscape = "via_site" | "surface_exit" | null

/** What one pad of a not-yet-routed connection can still do beside the copper
 * in `input`. Uses the solver's own site and visibility searches; the surface
 * search runs only when no via site is left. Board coordinates in mm, +X
 * right, +Y up. */
export function getPadEscape(params: {
  input: SimpleRouteJson
  connection: Connection
  end: 0 | 1
  viaTargetLayer: string
}): PadEscape {
  const { input, connection, end, viaTargetLayer } = params
  const start = connection.pointsToConnect[end]
  const pcbPortId = start.pcb_port_id
  if (!pcbPortId) throw Error(`${connection.name} end ${end} has no pcb port`)
  const sites = expandedSignalSites({
    input: { ...input, connections: [connection] },
    connection,
    targetLayer: viaTargetLayer,
    allowPadEdgeSites: true,
  })
  let siteStep = sites.next()
  while (!siteStep.done) siteStep = sites.next()
  if (siteStep.value[end].length > 0) return "via_site"

  const pads: NativePad[] = input.obstacles.filter((pad) => pad.componentId)
  const pad = pads.find(
    (candidate) => candidate.circuitJsonMetadata?.pcb_port_id === pcbPortId,
  )
  if (!pad) throw Error(`No native pad for ${pcbPortId}`)
  const componentIds = [...new Set(pads.map((candidate) => candidate.componentId))]
  const { field, boardToPackage, packageToBoard } = getPackagePadFrame(
    pads.filter((candidate) => candidate.componentId === pad.componentId),
    packageApproachRegions(input, 0)[componentIds.indexOf(pad.componentId)]
      .pads,
  )
  const width = input.minTraceWidth
  const clearance =
    input.minTraceToPadEdgeClearance ?? input.defaultObstacleMargin ?? 0.075
  const extension = (input.minViaPadDiameter ?? 0.6) / 2 + width / 2 + clearance
  const padCenterInPackage = applyToPoint(boardToPackage, pad.center)
  const copper = fixedCopper(input)
  for (const exitInPackage of [
    { x: field.minX - extension, y: padCenterInPackage.y },
    { x: field.maxX + extension, y: padCenterInPackage.y },
    { x: padCenterInPackage.x, y: field.minY - extension },
    { x: padCenterInPackage.x, y: field.maxY + extension },
  ]) {
    const exit = {
      ...applyToPoint(packageToBoard, exitInPackage),
      layer: start.layer,
    }
    const search = new GridVisibilitySearch(
      new VectorScene(
        input,
        { ...connection, pointsToConnect: [start, exit] },
        width,
        copper,
      ),
      start,
      exit,
      [],
      0,
    )
    while (!search.solved && !search.failed) search.step()
    if (search.solved) return "surface_exit"
  }
  return null
}
