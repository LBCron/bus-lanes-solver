import type { Obstacle, SimpleRouteJson } from "./types"

type Box = SimpleRouteJson["bounds"]

/** A package's pad field in the package's own frame. `angle` is the frame's
 * CCW rotation from board +X in radians; `field` bounds frame coordinates in
 * mm. An axis-aligned package keeps the supplied board-frame field. */
export type PackagePadFrame = { angle: number; field: Box }

const fieldAt = (pads: Obstacle[], degrees: number): Box => {
  const angle = (degrees * Math.PI) / 180,
    cos = Math.cos(angle),
    sin = Math.sin(angle)
  const field = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
  }
  for (const pad of pads) {
    const x = pad.center.x * cos + pad.center.y * sin,
      y = -pad.center.x * sin + pad.center.y * cos
    const turn =
      pad.shape === "circle"
        ? 0
        : (((pad.ccwRotationDegrees ?? 0) - degrees) * Math.PI) / 180
    const halfX =
        (Math.abs(Math.cos(turn)) * pad.width +
          Math.abs(Math.sin(turn)) * pad.height) /
        2,
      halfY =
        (Math.abs(Math.sin(turn)) * pad.width +
          Math.abs(Math.cos(turn)) * pad.height) /
        2
    field.minX = Math.min(field.minX, x - halfX)
    field.maxX = Math.max(field.maxX, x + halfX)
    field.minY = Math.min(field.minY, y - halfY)
    field.maxY = Math.max(field.maxY, y + halfY)
  }
  return field
}

/** Measure a package's pad field along its pads' own orientation. A package
 * placed at 45 degrees has a diamond-shaped field; its board-aligned bounding
 * box also covers open board at the four corners, which is not pad field.
 * Candidate frames are the pads' rotations; the tightest field wins and the
 * board frame wins ties. */
export function getPackagePadFrame(
  pads: Obstacle[],
  boardAlignedField: Box,
): PackagePadFrame {
  const area = (field: Box) =>
    (field.maxX - field.minX) * (field.maxY - field.minY)
  let best: PackagePadFrame = { angle: 0, field: boardAlignedField }
  let bestArea = area(boardAlignedField)
  const candidates = new Set(
    pads
      .filter((pad) => pad.shape !== "circle")
      .map((pad) => (((pad.ccwRotationDegrees ?? 0) % 90) + 90) % 90),
  )
  for (const degrees of [...candidates].sort((a, b) => a - b)) {
    if (!degrees) continue
    const field = fieldAt(pads, degrees)
    if (area(field) >= bestArea - 1e-9) continue
    best = { angle: (degrees * Math.PI) / 180, field }
    bestArea = area(field)
  }
  return best
}
