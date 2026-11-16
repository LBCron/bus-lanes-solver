import { expect, test } from "bun:test"
import { applyToPoint, rotate, rotateDEG } from "transformation-matrix"
import { packageApproachRegions } from "../lib/package-approach-regions"
import { getPackagePadFrame } from "../lib/package-pad-frame"
import type { Obstacle, Point, SimpleRouteJson } from "../lib/types"

const pad = (params: {
  center: Point
  width: number
  height: number
  ccwRotationDegrees?: number
}): Obstacle => ({
  type: "rect",
  componentId: "U1",
  layers: ["top"],
  connectedTo: [],
  ...params,
})

const request: SimpleRouteJson = {
  layerCount: 2,
  minTraceWidth: 0.1,
  bounds: { minX: -10, maxX: 10, minY: -10, maxY: 10 },
  obstacles: [],
  connections: [],
}

// Board coordinates in mm, +X right, +Y up.
test("a package placed at 45 degrees gets a pad field in its own frame", (): void => {
  const aligned = { minX: -1, maxX: 1, minY: -1, maxY: 1 }
  const boardFrame = {
    ccwRotationRadians: 0,
    field: aligned,
    boardToPackage: rotate(0),
    packageToBoard: rotate(0),
  }
  // Axis-aligned packages, including quarter-turn pads, keep the board frame.
  expect(
    getPackagePadFrame(
      [
        pad({ center: { x: -0.75, y: 0 }, width: 0.5, height: 0.3 }),
        pad({
          center: { x: 0.75, y: 0 },
          width: 0.5,
          height: 0.3,
          ccwRotationDegrees: 180,
        }),
      ],
      aligned,
    ),
  ).toEqual(boardFrame)
  expect(
    getPackagePadFrame(
      [
        pad({
          center: { x: 0, y: -0.75 },
          width: 0.5,
          height: 0.3,
          ccwRotationDegrees: 90,
        }),
        pad({
          center: { x: 0, y: 0.75 },
          width: 0.5,
          height: 0.3,
          ccwRotationDegrees: 270,
        }),
      ],
      aligned,
    ),
  ).toEqual(boardFrame)

  // A square package turned 45 degrees with three pads on each side. In the
  // package frame the pad centers lie 4 mm from the center, at -3, 0 and 3 mm
  // along each side.
  const packageToBoard = rotateDEG(45)
  const pads = [-3, 0, 3].flatMap((along) => [
    pad({
      center: applyToPoint(packageToBoard, { x: 4, y: along }),
      width: 0.3,
      height: 1.5,
      ccwRotationDegrees: 45,
    }),
    pad({
      center: applyToPoint(packageToBoard, { x: -4, y: along }),
      width: 0.3,
      height: 1.5,
      ccwRotationDegrees: 45,
    }),
    pad({
      center: applyToPoint(packageToBoard, { x: along, y: 4 }),
      width: 1.5,
      height: 0.3,
      ccwRotationDegrees: 45,
    }),
    pad({
      center: applyToPoint(packageToBoard, { x: along, y: -4 }),
      width: 1.5,
      height: 0.3,
      ccwRotationDegrees: 45,
    }),
  ])
  // A square thermal pad that is not rotated does not change the frame.
  pads.push({
    ...pad({ center: { x: 0, y: 0 }, width: 2, height: 2 }),
    layers: ["top", "bottom"],
  })
  const original = structuredClone(pads)
  const boardAligned = packageApproachRegions(
    { ...request, obstacles: pads },
    0,
  )[0].pads
  // The board-aligned box reaches the diamond's corners, about 5.6 mm out.
  expect(boardAligned.maxX).toBeGreaterThan(5.5)
  const frame = getPackagePadFrame(pads, boardAligned)
  expect(pads).toEqual(original)
  expect(frame.ccwRotationRadians).toBeCloseTo(Math.PI / 4, 12)
  // 4 mm to the pad centers plus half the 0.3 mm pad dimension that lies
  // across each side.
  for (const bound of [frame.field.maxX, frame.field.maxY])
    expect(bound).toBeCloseTo(4.15, 9)
  for (const bound of [frame.field.minX, frame.field.minY])
    expect(bound).toBeCloseTo(-4.15, 9)
  // A pad center on the package's +X side maps onto that side and back.
  const sidePad = applyToPoint(frame.boardToPackage, pads[0].center)
  expect(sidePad.x).toBeCloseTo(4, 9)
  expect(sidePad.y).toBeCloseTo(-3, 9)
  const roundTrip = applyToPoint(frame.packageToBoard, sidePad)
  expect(roundTrip.x).toBeCloseTo(pads[0].center.x, 9)
  expect(roundTrip.y).toBeCloseTo(pads[0].center.y, 9)
})
