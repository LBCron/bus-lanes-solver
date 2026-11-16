import "bun-match-svg"
import { expect, test } from "bun:test"
import { BusLanesPipelineSolver } from "../lib"
import {
  getImx6BytePcbSvg,
  readImx6PreloadedByteFixture,
  validateImx6ByteRouting,
} from "./fixtures/imx6-preloaded-byte1"

const nativeByteTestTimeoutMs = 900_000

test(
  "i.MX6 second byte connects TP27 and preserves the first byte",
  async (): Promise<void> => {
    const fixture = readImx6PreloadedByteFixture()
    const original = structuredClone(fixture.input)
    const solver = new BusLanesPipelineSolver(fixture.input)
    solver.solve()
    expect(solver.solved).toBe(true)
    expect(solver.failed).toBe(false)
    expect(solver.error).toBeNull()
    expect(fixture.input).toEqual(original)
    const traces = solver.getOutput().traces
    expect(traces.slice(0, original.traces!.length)).toEqual(original.traces!)
    const connectivity = validateImx6ByteRouting({
      fixture,
      traces,
      includeSecondByte: true,
    })
    expect(connectivity.connectedConnectionCount).toBe(
      fixture.fixedConnections.length + fixture.input.connections.length,
    )
    expect(connectivity.connectedEndpointCount).toBe(33)
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
  },
  nativeByteTestTimeoutMs,
)
