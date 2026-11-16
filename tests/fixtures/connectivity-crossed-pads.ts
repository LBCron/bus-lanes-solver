import type { SimpleRouteJson } from "../../lib/types"

export function createCrossedPadBanks(
  permutation: number[],
  offset: number,
  { distance = 3, spacing = 0.5, maxY = 3 }: { distance?: number; spacing?: number; maxY?: number } = {},
): SimpleRouteJson {
  const connections = permutation.map((p, i) => ({
    name: "net-" + i,
    pointsToConnect: [
      {
        x: offset - distance / 2 + (i % 2) * 0.5,
        y: Math.floor(i / 2) * spacing,
        layer: "top",
        pcb_port_id: "left-" + i,
      },
      {
        x: offset + distance / 2 + (p % 2) * 0.5,
        y: Math.floor(p / 2) * spacing,
        layer: "top",
        pcb_port_id: "right-" + i,
      },
    ],
  }))
  return {
    layerCount: 4,
    allowedLayers: ["inner1"],
    minTraceWidth: 0.09,
    minTraceToPadEdgeClearance: 0.09,
    minViaPadDiameter: 0.25,
    minViaHoleDiameter: 0.15,
    minViaHoleEdgeToViaHoleEdgeClearance: 0.25,
    bounds: { minX: offset - 3, maxX: offset + 4, minY: -2, maxY },
    connections,
    obstacles: connections.flatMap((c) =>
      c.pointsToConnect.map((p, j) => ({
        shape: "circle",
        componentId: "package-" + j,
        center: { x: p.x, y: p.y },
        width: 0.23,
        height: 0.23,
        layers: ["top"],
        connectedTo: [c.name, p.pcb_port_id],
      })),
    ),
  }
}

