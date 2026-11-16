import { boardSegmentIsClear } from "./board-outline"
import type { SimpleRouteJson } from "./types"

// Retain board rasters across search bounds, independently of copper.
// Oversized rasters are used by their caller without retaining another copy.
const boardGrids = new WeakMap<SimpleRouteJson, Map<string, Uint8Array>>()
const maxBoardGridBytes = 16 * 1024 * 1024

/** Read-only board occupancy in board-world mm; callers copy it before marking copper. */
export function getBoardGrid({
  input,
  copperRadiusMm,
  xs,
  ys,
  step,
}: {
  input: SimpleRouteJson
  copperRadiusMm: number
  xs: Float64Array
  ys: Float64Array
  step: number
}): Uint8Array {
  const key = JSON.stringify([
    xs[0],
    ys[0],
    xs.length,
    ys.length,
    step,
    copperRadiusMm,
    input.bounds,
    input.outline,
    input.minBoardEdgeClearance,
  ])
  const grids = boardGrids.get(input) ?? new Map<string, Uint8Array>()
  const previous = grids.get(key)
  if (previous) {
    grids.delete(key)
    grids.set(key, previous)
    return previous
  }
  const blocked = new Uint8Array(xs.length * ys.length)
  for (let y = 0; y < ys.length; y++)
    for (let x = 0; x < xs.length; x++) {
      const point = { x: xs[x], y: ys[y] }
      if (
        !boardSegmentIsClear({
          input,
          start: point,
          end: point,
          copperRadiusMm,
        })
      )
        blocked[x + y * xs.length] = 1
    }
  if (blocked.byteLength <= maxBoardGridBytes) {
    let retained = [...grids.values()].reduce(
      (sum, grid) => sum + grid.byteLength,
      0,
    )
    while (retained + blocked.byteLength > maxBoardGridBytes && grids.size) {
      const oldest = grids.keys().next().value!
      retained -= grids.get(oldest)!.byteLength
      grids.delete(oldest)
    }
    grids.set(key, blocked)
    boardGrids.set(input, grids)
  }
  return blocked
}
