import { expect, test } from "bun:test"
import { getConnectedPadGroups } from "../lib/connected-pad-groups"
import type { Obstacle } from "../lib/types"

test("merges transitive pad aliases while preserving group and pad order", (): void => {
  const pads: Obstacle[] = [
    { componentId: "left", connectedTo: ["left"] },
    { componentId: "right", connectedTo: ["right"] },
    { componentId: "independent", connectedTo: ["other"] },
    { componentId: "bridge", connectedTo: ["right", "left", "right"] },
  ].map((pad) => ({
    ...pad,
    type: "rect",
    center: { x: 0, y: 0 },
    width: 1,
    height: 1,
    layers: ["top"],
  }))
  const originalPads = structuredClone(pads)
  expect(
    getConnectedPadGroups(pads).map((group) =>
      [...group].map((pad) => pad.componentId),
    ),
  ).toEqual([["bridge", "right", "left"], ["independent"]])
  expect(pads).toEqual(originalPads)
})
