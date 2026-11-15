import {
  applyToPoint,
  compose,
  type Matrix,
  rotate,
  rotateDEG,
  translate,
} from "transformation-matrix"
import type { Obstacle, SimpleRouteJson } from "./types"

type Box = SimpleRouteJson["bounds"]

/** A package's pad field in the package's own frame. `field` bounds
 * package-frame coordinates in mm; board coordinates are +X right, +Y up. An
 * axis-aligned package keeps the supplied board-frame field. */
export type PackagePadFrame = {
  /** CCW rotation of the package frame from board +X. */
  ccwRotationRadians: number
  field: Box
  boardToPackage: Matrix
  packageToBoard: Matrix
}

const getBoxArea = (box: Box) => (box.maxX - box.minX) * (box.maxY - box.minY)

/** Bound every pad's copper in the frame reached through `boardToPackage`. */
function getPadField(pads: Obstacle[], boardToPackage: Matrix): Box {
  const field = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
  }
  for (const pad of pads) {
    const isCircle = pad.shape === "circle"
    const padToPackage = compose(
      boardToPackage,
      translate(pad.center.x, pad.center.y),
      rotateDEG(isCircle ? 0 : (pad.ccwRotationDegrees ?? 0)),
    )
    const halfWidth = pad.width / 2,
      halfHeight = (isCircle ? pad.width : pad.height) / 2
    const center = applyToPoint(padToPackage, { x: 0, y: 0 })
    // A circle's extent is its radius in every frame; a rectangle's is the
    // bounding box of its four corners.
    const extents = isCircle
      ? [
          { x: center.x - halfWidth, y: center.y - halfWidth },
          { x: center.x + halfWidth, y: center.y + halfWidth },
        ]
      : [
          { x: -halfWidth, y: -halfHeight },
          { x: halfWidth, y: -halfHeight },
          { x: halfWidth, y: halfHeight },
          { x: -halfWidth, y: halfHeight },
        ].map((corner) => applyToPoint(padToPackage, corner))
    for (const point of extents) {
      field.minX = Math.min(field.minX, point.x)
      field.maxX = Math.max(field.maxX, point.x)
      field.minY = Math.min(field.minY, point.y)
      field.maxY = Math.max(field.maxY, point.y)
    }
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
  let best: PackagePadFrame = {
    ccwRotationRadians: 0,
    field: boardAlignedField,
    boardToPackage: rotate(0),
    packageToBoard: rotate(0),
  }
  const candidateCcwRotationDegrees = new Set(
    pads
      .filter((pad) => pad.shape !== "circle")
      .map((pad) => (((pad.ccwRotationDegrees ?? 0) % 90) + 90) % 90),
  )
  for (const ccwRotationDegrees of [...candidateCcwRotationDegrees].sort(
    (a, b) => a - b,
  )) {
    if (!ccwRotationDegrees) continue
    const ccwRotationRadians = (ccwRotationDegrees * Math.PI) / 180
    const boardToPackage = rotate(-ccwRotationRadians)
    const field = getPadField(pads, boardToPackage)
    if (getBoxArea(field) >= getBoxArea(best.field) - 1e-9) continue
    best = {
      ccwRotationRadians,
      field,
      boardToPackage,
      packageToBoard: rotate(ccwRotationRadians),
    }
  }
  return best
}
