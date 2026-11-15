import { expect, test } from "bun:test"
import { packageApproachRegions } from "../lib/package-approach-regions"
import { getPackagePadFrame } from "../lib/package-pad-frame"
import type { Obstacle, SimpleRouteJson } from "../lib/types"

const pad = (
  x: number,
  y: number,
  width: number,
  height: number,
  ccwRotationDegrees?: number,
): Obstacle => ({
  type: "rect",
  componentId: "U1",
  center: { x, y },
  width,
  height,
  ccwRotationDegrees,
  layers: ["top"],
  connectedTo: [],
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
  // Axis-aligned packages, including quarter-turn pads, keep the board frame.
  expect(
    getPackagePadFrame(
      [pad(-0.75, 0, 0.5, 0.3), pad(0.75, 0, 0.5, 0.3, 180)],
      aligned,
    ),
  ).toEqual({ angle: 0, field: aligned })
  expect(
    getPackagePadFrame(
      [pad(0, -0.75, 0.5, 0.3, 90), pad(0, 0.75, 0.5, 0.3, 270)],
      aligned,
    ),
  ).toEqual({ angle: 0, field: aligned })

  // A square package turned 45 degrees with three pads on each side. In the
  // package frame the pad centers lie 4 mm from the center, at -3, 0 and 3 mm
  // along each side.
  const toBoard = (u: number, v: number) => ({
    x: (u - v) / Math.SQRT2,
    y: (u + v) / Math.SQRT2,
  })
  const pads = [-3, 0, 3].flatMap((along) => [
    { ...pad(0, 0, 0.3, 1.5, 45), center: toBoard(4, along) },
    { ...pad(0, 0, 0.3, 1.5, 45), center: toBoard(-4, along) },
    { ...pad(0, 0, 1.5, 0.3, 45), center: toBoard(along, 4) },
    { ...pad(0, 0, 1.5, 0.3, 45), center: toBoard(along, -4) },
  ])
  // A square thermal pad that is not rotated does not change the frame.
  pads.push({ ...pad(0, 0, 2, 2), layers: ["top", "bottom"] })
  const original = structuredClone(pads)
  const boardAligned = packageApproachRegions(
    { ...request, obstacles: pads },
    0,
  )[0].pads
  // The board-aligned box reaches the diamond's corners, about 5.6 mm out.
  expect(boardAligned.maxX).toBeGreaterThan(5.5)
  const frame = getPackagePadFrame(pads, boardAligned)
  expect(pads).toEqual(original)
  expect(frame.angle).toBeCloseTo(Math.PI / 4, 12)
  // 4 mm to the pad centers plus half the 0.3 mm pad dimension that lies
  // across each side.
  for (const bound of [frame.field.maxX, frame.field.maxY])
    expect(bound).toBeCloseTo(4.15, 9)
  for (const bound of [frame.field.minX, frame.field.minY])
    expect(bound).toBeCloseTo(-4.15, 9)
})
