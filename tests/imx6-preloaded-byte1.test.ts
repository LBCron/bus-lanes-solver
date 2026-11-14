import "bun-match-svg"
import { expect, test } from "bun:test"
import {
  getImx6BytePcbSvg,
  readImx6PreloadedByteFixture,
  validateImx6ByteRouting,
} from "./fixtures/imx6-preloaded-byte1"

// Native i.MX6 board after byte 0, before the second byte's TP27 branch.
// Show only supplied completed copper; incomplete candidate routes are excluded.
test("i.MX6 circuit at the blocked second-byte routing request", async (): Promise<void> => {
  const fixture = readImx6PreloadedByteFixture()
  const traces = fixture.input.traces!
  const connectivity = validateImx6ByteRouting({
    fixture,
    traces,
    includeSecondByte: false,
  })
  expect(connectivity.connectedConnectionCount).toBe(
    fixture.fixedConnections.length,
  )
  const svg = getImx6BytePcbSvg({
    fixture,
    traces,
    connectedConnectionCount: connectivity.connectedConnectionCount,
  })
  await expect(svg).toMatchSvgSnapshot(import.meta.path, "pcb")
  const focused = getImx6BytePcbSvg({
    fixture,
    traces,
    connectedConnectionCount: connectivity.connectedConnectionCount,
    focused: true,
  })
  await expect(focused).toMatchSvgSnapshot(import.meta.path, "ddr")
})
