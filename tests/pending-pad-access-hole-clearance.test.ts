import { expect, test } from "bun:test"
import { PendingPadAccess } from "../lib/pending-pad-access"
import type { Trace } from "../lib/types"
import {
  blockedPendingConnections,
  pendingPadAccessFixture,
} from "./fixtures/pending-pad-access"

test("a future trace-to-drill rule can close exits that clear the via copper", () => {
  const { input, pendingConnection } = pendingPadAccessFixture()
  const vias: Trace[] = [
    { x: -0.7, y: -0.7 },
    { x: -0.7, y: 0.7 },
    { x: 0.7, y: -0.7 },
    { x: 0.7, y: 0.7 },
  ].map((point, index) => ({
    type: "pcb_trace",
    pcb_trace_id: `foreign_via_${index}`,
    connection_name: `FOREIGN_VIA_${index}`,
    route: [
      {
        ...point,
        route_type: "via",
        from_layer: "top",
        to_layer: "bottom",
        via_diameter: 0.2,
        via_hole_diameter: 0.1,
      },
    ],
  }))
  const strict = structuredClone(input)
  strict.pendingRoutingAccess![0].minTraceToHoleEdgeClearance = 0.65

  expect(blockedPendingConnections(new PendingPadAccess(input), vias)).toEqual(
    [],
  )
  expect(
    blockedPendingConnections(new PendingPadAccess(strict), vias).map(
      (connection) => connection.name,
    ),
  ).toEqual([pendingConnection.name])
})
