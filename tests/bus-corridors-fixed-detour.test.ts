import { expect, test } from "bun:test"
import { planBusCorridors } from "../lib/plan-bus-corridors"
import type { SimpleRouteJson } from "../lib/types"
import { fixedCopper, VectorScene } from "../lib/vector-scene"

test("coarse guides account for fixed copper and can initially travel away from their destination", () => {
  const input: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.1,
    minTraceToPadEdgeClearance: 0.1,
    bounds: { minX: -4, maxX: 7, minY: -4, maxY: 4 },
    obstacles: [
      {
        center: { x: 0.5, y: -1.5 },
        width: 3,
        height: 0.2,
        layers: ["top"],
        connectedTo: [],
      },
      {
        center: { x: 0.5, y: 1.5 },
        width: 3,
        height: 0.2,
        layers: ["top"],
        connectedTo: [],
      },
      {
        center: { x: 2, y: 0 },
        width: 0.2,
        height: 3.2,
        layers: ["top"],
        connectedTo: [],
      },
    ],
    connections: Array.from({ length: 8 }, (_, index) => ({
      name: `D${index}`,
      pointsToConnect: [
        { x: 0, y: 0.01 * index, layer: "top" },
        { x: 5, y: 0.01 * index, layer: "top" },
      ],
    })),
    buses: [
      {
        busId: "byte",
        connectionNames: Array.from({ length: 8 }, (_, i) => `D${i}`),
      },
    ],
  }
  const copper = fixedCopper(input)
  const work = planBusCorridors(
    input,
    input.connections,
    copper,
    new Map(input.connections.map((connection) => [connection.name, 0.1])),
  )
  let state = work.next()
  while (!state.done) state = work.next()
  expect(state.value.size).toBe(8)
  for (const connection of input.connections) {
    const guide = state.value.get(connection.name)!
    expect(Math.min(...guide.path.map((point) => point.x))).toBeLessThan(-1)
    expect(
      new VectorScene(input, connection, 0.1, copper).pathVisible([
        ...guide.path,
      ]),
    ).toBe(true)
  }
})
