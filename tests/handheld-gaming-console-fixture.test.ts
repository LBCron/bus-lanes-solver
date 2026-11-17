import { test, expect } from "bun:test"
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { gunzipSync } from "node:zlib"
import type { SimpleRouteJson } from "../lib/types"
import meta from "../repros/handheld-gaming-console/provenance.json"
import pads from "./fixtures/handheld-gaming-console/pads.json"

const dir = new URL("../repros/handheld-gaming-console/", import.meta.url)
const read = (s: string) => readFileSync(new URL(s, dir))
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex")

/** Restore the original eight-layer serialization without copying pad geometry. */
function reconstructEightLayerInput(inputRaw: Buffer) {
  const allowedLayers = JSON.stringify(
    meta.source_allowed_layers,
    null,
    2,
  ).replaceAll("\n", "\n  ")
  return Buffer.from(
    inputRaw
      .toString()
      .replace('"layerCount": 6', '"layerCount": 8')
      .replace(
        /^  "allowedLayers": \[[\s\S]*?^  \]/m,
        `  "allowedLayers": ${allowedLayers}`,
      )
      .trimEnd(),
  )
}

test("handheld reproduction retains native pad positions and all 65 requested nets", () => {
  const inputRaw = read(
    "../../tests/fixtures/handheld-gaming-console/input.srj.json",
  )
  expect(sha(inputRaw)).toBe(meta.input_sha256)
  expect(
    sha(read("../../tests/fixtures/handheld-gaming-console/pads.json")),
  ).toBe(meta.source_pads_sha256)
  expect(sha(gunzipSync(read("source/board.kicad_pcb.gz")))).toBe(
    meta.source_board_sha256,
  )
  const input: SimpleRouteJson = JSON.parse(inputRaw.toString())
  const eightLayerRaw = reconstructEightLayerInput(inputRaw)
  expect(sha(eightLayerRaw)).toBe(meta.source_eight_layer_input_sha256)
  const eightLayer: SimpleRouteJson = JSON.parse(eightLayerRaw.toString())
  expect(eightLayer.layerCount).toBe(8)
  expect(input).toEqual({
    ...eightLayer,
    layerCount: 6,
    allowedLayers: ["top", "inner3", "bottom"],
  })
  expect(meta.physical_layers).toBe(6)
  expect(meta.connectivity_carrier).toBe("inner3")
  expect(meta.layer_plan.map((p) => p.layer)).toEqual([
    "top",
    "inner1",
    "inner2",
    "inner3",
    "inner4",
    "bottom",
  ])
  expect(
    meta.layer_plan.filter((p) => p.role === "signal").map((p) => p.layer),
  ).toEqual(input.allowedLayers ?? [])
  expect(meta.source_physical_layers).toBe(8)
  const validLayers = new Set([
    "top",
    "inner1",
    "inner2",
    "inner3",
    "inner4",
    "bottom",
  ])
  for (const o of input.obstacles)
    for (const layer of o.layers) expect(validLayers.has(layer)).toBe(true)
  for (const c of input.connections)
    for (const p of c.pointsToConnect)
      expect(validLayers.has(p.layer)).toBe(true)
  for (const b of input.buses ?? [])
    for (const layer of b.allowedLayers ?? [])
      expect(input.allowedLayers).toContain(layer)
  expect(input.connections).toHaveLength(65)
  expect(input.obstacles).toHaveLength(pads.length)
  expect(new Set(input.connections.map((c) => c.name)).size).toBe(65)
  expect(input.traces ?? []).toHaveLength(0)
  for (const c of input.connections) {
    const native = pads.filter((p) => p.net === c.name)
    expect(native).toHaveLength(2)
    expect(c.pointsToConnect).toHaveLength(2)
    for (const point of c.pointsToConnect) {
      const p = native.find(
        (p) => `${p.reference}_${p.number}` === point.pcb_port_id,
      )!
      expect(p).toBeDefined()
      expect(point.x).toBeCloseTo(p.position[0] - 100, 6)
      expect(point.y).toBeCloseTo(100 - p.position[1], 6)
      const obstacle = input.obstacles.find((o) =>
        o.connectedTo.includes(point.pcb_port_id!),
      )!
      expect(obstacle.center).toEqual({ x: point.x, y: point.y })
    }
  }
})
