import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import {
  validateOriginalEndpointConnectivity,
  validateRoutedCopperDrc,
} from "/workspace/core/node_modules/@tscircuit/fanout-solver/lib/index.ts"
import { getBusLanesInputFromSrj } from "/workspace/core/lib/utils/autorouting/get-bus-lanes-input-from-srj.ts"

// This is a measurement harness, outside either repository. Invoke in separate
// fresh Bun processes, with a 120-second external watchdog for each process.
// bun a64-final-paired-public-stage.ts main|head /absolute/output-prefix
const startedAt = new Date().toISOString()
const invocationStarted = performance.now()
const [label, outputPrefix] = process.argv.slice(2)
assert(label === "main" || label === "head", "label must be main or head")
assert(outputPrefix?.startsWith("/"), "absolute output prefix required")
const pins = {
  main: {
    sourceCommit: "202b034659fb96bad44d11b8190f4044b675116f",
    bundle: "/workspace/ddr-results/packages/bus-main/dist/index.js",
    bundleSha256: "fa6390c904b678f7dc197d0d3d671a28e273554369f8475457ea86374c5dad8c",
  },
  head: {
    sourceCommit: "190325da97253ad7951f9dfd3b0046b4afcb5395",
    bundle: "/workspace/ddr-results/packages/bus-head-native-inner/dist/index.js",
    bundleSha256: "940e910143a475e280ed3cdc7a0bb262daf98c0fdb075d82b95cbfb2b496f2f8",
  },
}
const pin = pins[label]
const rawPath = "/workspace/ddr-results/core-main/a64/phase-3-start.srj.json"
const referencePath = "/workspace/ddr-results/core-main/a64/phase-3-end.srj.json"
const adapterPath = "/workspace/core/lib/utils/autorouting/get-bus-lanes-input-from-srj.ts"
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")
const jsonHash = (value: unknown) => sha256(JSON.stringify(value))
const readText = (path: string) => readFileSync(path, "utf8")
const saveJson = (suffix: string, value: unknown) => writeFileSync(`${outputPrefix}.${suffix}.json`, `${JSON.stringify(value, null, 2)}\n`)
const bundleSha256 = sha256(readFileSync(pin.bundle))
assert.equal(bundleSha256, pin.bundleSha256)
const rawBytes = readFileSync(rawPath)
assert.equal(sha256(rawBytes), "3839e7492986ba5a6b5f6051446a0094b29d5dea2eadda18cd718a38a27f2938")
const referenceBytes = readFileSync(referencePath)
assert.equal(sha256(referenceBytes), "58b4af520e8c32a205296ca5181db02f3f27934dd8317b8a1bd5301137ed47a7")
const adapterSha256 = sha256(readFileSync(adapterPath))
assert.equal(adapterSha256, "fca83b4aacc128274410985896c2a0c4239e44bb4e386aaccca76b10823d1fb3")
const raw = JSON.parse(rawBytes.toString())
const reference = JSON.parse(referenceBytes.toString())
const input = getBusLanesInputFromSrj(structuredClone(raw))
const originalInputJson = JSON.stringify(input)
const originalRawJson = JSON.stringify(raw)
const originalFixedJson = JSON.stringify(input.traces)
assert.equal(input.connections.length, 8)
assert.equal(input.traces?.length, 16)
assert.deepEqual(input, raw)
const coreCommit = execFileSync("git", ["-C", "/workspace/core", "rev-parse", "HEAD"], { encoding: "utf8" }).trim()
assert.equal(coreCommit, "1a16da2f74fc2c80712d52abb17254dd2a80e2c5")
const coreTrackedChanges = execFileSync("git", ["-C", "/workspace/core", "status", "--short", "--untracked-files=no"], { encoding: "utf8" }).trim()
assert.equal(coreTrackedChanges, "")
const extractRequestedRoutes = (srj: typeof input) => Object.fromEntries(input.connections.map((connection) => {
  const matches = (srj.traces ?? []).filter((trace) => trace.connection_name === connection.name)
  assert.equal(matches.length, 1, `exactly one output route required for ${connection.name}`)
  return [connection.name, matches[0]!.route]
}))
const referenceRoutes = extractRequestedRoutes(reference)
const provenance = {
  label,
  startedAt,
  command: [process.execPath, import.meta.path, label, outputPrefix],
  cwd: process.cwd(),
  runtime: { bunVersion: Bun.version, executable: process.execPath, platform: process.platform, arch: process.arch },
  sourceCommit: pin.sourceCommit,
  bundlePath: pin.bundle,
  bundleSha256,
  coreCommit,
  coreTrackedChanges,
  benchmarkPackagePin: "24dc44c166d4258c3538f8b1f66953f1b6f58690",
  adapterPath,
  adapterSha256,
  rawInputPath: rawPath,
  rawInputSha256: sha256(rawBytes),
  adaptedInputJsonSha256: jsonHash(input),
  adapterPreservesRawInputValues: true,
  referenceOutputPath: referencePath,
  referenceOutputSha256: sha256(referenceBytes),
  referenceRequestedRoutesJsonSha256: jsonHash(referenceRoutes),
  requestCount: input.connections.length,
  fixedTraceCount: input.traces.length,
  obstacleCount: input.obstacles.length,
  physicalLayerCount: input.layerCount,
  constructor: "new BusLanesPipelineSolver(input)",
  options: "omitted; public defaults",
  solverExecution: "solver.solve(); solver.getOutput()",
  externalLimitSeconds: 120,
  cpuQuota: readText("/sys/fs/cgroup/cpu.max").trim(),
  memoryLimitBytes: readText("/sys/fs/cgroup/memory.max").trim(),
  fanoutPackageVersion: JSON.parse(readText("/workspace/core/node_modules/@tscircuit/fanout-solver/package.json")).version,
  nativeDrcSourceSha256: sha256(readFileSync("/workspace/core/node_modules/@tscircuit/fanout-solver/lib/validate-routed-copper-drc.ts")),
  nativeConnectivitySourceSha256: sha256(readFileSync("/workspace/core/node_modules/@tscircuit/fanout-solver/lib/validate-original-endpoint-connectivity.ts")),
  harnessSourceSha256: sha256(readFileSync(import.meta.path)),
}
saveJson("input.srj", input)
saveJson("result", { ...provenance, status: "started", completed: false })
const { BusLanesPipelineSolver } = await import(pin.bundle)
const solveStarted = performance.now()
const solver = new BusLanesPipelineSolver(input)
let solveSeconds: number | null = null
let output: ReturnType<typeof solver.getOutput> | undefined
try {
  solver.solve()
  solveSeconds = (performance.now() - solveStarted) / 1000
  assert.equal(solver.solved, true)
  assert.equal(solver.failed, false)
  assert.equal(solver.error, null)
  output = solver.getOutput()
  saveJson("output.srj", output)
  assert.equal(output.traces.length, 24)
  assert.deepEqual(output.connections, input.connections)
  assert.equal(JSON.stringify(output.traces.slice(0, 16)), originalFixedJson)
  const routes = extractRequestedRoutes(output)
  const endpointChecks = input.connections.map((connection) => {
    const route = routes[connection.name]!
    assert(route.length > 1)
    assert.equal(connection.pointsToConnect.length, 2)
    const endpoints = connection.pointsToConnect.map((point, index) => {
      const endpoint = index === 0 ? route[0]! : route.at(-1)!
      assert.equal(endpoint.route_type, "wire")
      assert.equal(endpoint.layer, point.layer)
      assert(Math.abs(endpoint.x - point.x) <= 1e-8)
      assert(Math.abs(endpoint.y - point.y) <= 1e-8)
      return { endpointIndex: index, valid: true, x: endpoint.x, y: endpoint.y, layer: endpoint.layer }
    })
    return { connectionName: connection.name, valid: true, endpoints }
  })
  const connectivity = validateOriginalEndpointConnectivity({ inputSrj: input, routedSrj: output })
  const fixedOwners = [...new Set(input.traces!.map((trace) => trace.connection_name!))]
  assert(fixedOwners.every(Boolean), "all fixed traces must retain electrical ownership")
  const validationConnections = [
    ...input.connections,
    ...fixedOwners.filter((name) => !input.connections.some((connection) => connection.name === name))
      .map((name) => ({ name, pointsToConnect: [] })),
  ]
  const drc = validateRoutedCopperDrc({
    inputSrj: { ...input, connections: validationConnections },
    routedSrj: { ...output, connections: validationConnections },
    clearance: input.minTraceToPadEdgeClearance ?? 0.075,
    allowBlindAndBuriedVias: input.allowBlindAndBuriedVias ?? false,
  })
  saveJson("validation", { endpointChecks, connectivity, drc, fixedOwners, validationOnlyConnections: validationConnections.filter((c) => c.pointsToConnect.length === 0) })
  assert.equal(connectivity.valid, true)
  assert.equal(connectivity.connectedConnectionCount, 8)
  assert.equal(connectivity.connectedEndpointCount, 16)
  assert.deepEqual(connectivity.issues, [])
  assert.equal(drc.valid, true)
  assert.deepEqual(drc.issues, [])
  assert.equal(JSON.stringify(raw), originalRawJson)
  assert.equal(JSON.stringify(input), originalInputJson)
  assert.deepEqual(routes, referenceRoutes)
  const result = {
    ...provenance,
    status: "completed_and_validated",
    completed: true,
    solved: solver.solved,
    failed: solver.failed,
    error: solver.error,
    solveSeconds,
    invocationSeconds: (performance.now() - invocationStarted) / 1000,
    solverIterations: solver.iterations,
    phase: solver.phase,
    outputTraceCount: output.traces.length,
    requestedRouteCount: Object.keys(routes).length,
    requestedRoutesJsonSha256: jsonHash(routes),
    requestedRouteArraysEqualOriginalMainOutput: true,
    fullOutputJsonSha256: jsonHash(output),
    fullOutputEqualOriginalMainOutput: JSON.stringify(output) === JSON.stringify(reference),
    adaptedInputUnchanged: true,
    rawInputUnchanged: true,
    fixedTracePrefixUnchanged: true,
    fixedTraceJsonSha256: sha256(originalFixedJson),
    endpointsValid: endpointChecks.every((item) => item.valid),
    connectedConnectionCount: connectivity.connectedConnectionCount,
    connectedEndpointCount: connectivity.connectedEndpointCount,
    nativeConnectivityValid: connectivity.valid,
    nativeConnectivityIssueCount: connectivity.issues.length,
    nativeDrcValid: drc.valid,
    nativeDrcIssueCount: drc.issues.length,
    nativeDrcCheckedTraceCount: drc.checkedTraceCount,
    nativeDrcCheckedSegmentCount: drc.checkedSegmentCount,
    nativeDrcCheckedViaCount: drc.checkedViaCount,
    endedAt: new Date().toISOString(),
  }
  saveJson("result", result)
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  const result = {
    ...provenance,
    status: "failed",
    completed: false,
    solved: solver.solved,
    failed: solver.failed,
    solverError: solver.error,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    solveSeconds: solveSeconds ?? (performance.now() - solveStarted) / 1000,
    invocationSeconds: (performance.now() - invocationStarted) / 1000,
    solverIterations: solver.iterations,
    phase: solver.phase,
    outputTraceCount: output?.traces?.length ?? null,
    endedAt: new Date().toISOString(),
  }
  saveJson("result", result)
  console.error(JSON.stringify(result, null, 2))
  process.exitCode = 1
}
