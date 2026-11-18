import { createHash } from "node:crypto"
import { readFile, mkdir } from "node:fs/promises"
import { arch, platform } from "node:os"
import { join } from "node:path"
import {
  validateRoutedCopperDrc,
} from "/workspace/bus-lanes-work/node_modules/@tscircuit/fanout-solver"
import {
  getPngBufferFromGraphicsObject,
  getSvgFromGraphicsObject,
} from "/workspace/bus-lanes-work/node_modules/graphics-debug"
import { BusLanesSolver } from "/workspace/bus-lanes-work/lib/bus-lanes-solver"
import { distance, length } from "/workspace/bus-lanes-work/lib/geometry"
import type { SimpleRouteJson, Trace } from "/workspace/bus-lanes-work/lib/types"

const directory = "/workspace/ddr-results/quality-gallery"
const fixture = "/workspace/bus-lanes-work/tests/fixtures/bus-corridors/three-barriers.json"
const expectedRevisions: Record<string, string> = {
  base: "202b034659fb96bad44d11b8190f4044b675116f",
  head: "190325da97253ad7951f9dfd3b0046b4afcb5395",
}
// This fixture measures negotiated bus-stage candidates before optional
// smooth-corner cleanup; validate that exact geometry without enabling cleanup.
const validationOptions = { denseSearch: true, smoothTuning: false }
const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex")
const initial = await readFile(fixture)
const source = JSON.parse(initial.toString()) as SimpleRouteJson
async function identity(repository: string): Promise<{ commit: string; sourceHashes: Record<string, string> }> {
  const revision = Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: repository })
  if (revision.exitCode !== 0) throw Error("Could not identify solver source")
  const files = [...new Bun.Glob("lib/**/*.ts").scanSync(repository)].sort()
  const sourceHashes: Record<string, string> = {}
  for (const filename of files)
    sourceHashes[filename] = sha256(await readFile(join(repository, filename)))
  return { commit: revision.stdout.toString().trim(), sourceHashes }
}
const retained: Array<{
  name: string
  identity: Awaited<ReturnType<typeof identity>>
  input: SimpleRouteJson
  traces: Trace[]
  yields: number
  solveMilliseconds: number
  totalCopperLengthMm: number
  longestCopperLengthMm: number
  drc: ReturnType<typeof validateRoutedCopperDrc>
  validator: BusLanesSolver
  publicDefaultValidatorSolved: boolean
}> = []
for (const [name, repository] of [
  ["base", "/workspace/bus-lanes-solver"],
  ["head", "/workspace/bus-lanes-work"],
]) {
  const beforeSource = await identity(repository)
  if (beforeSource.commit !== expectedRevisions[name])
    throw Error(`${name}: source revision does not match the pinned comparison`)
  const { negotiateLanes } = await import(join(repository, "lib/negotiate-lanes.ts"))
  const { fixedCopper } = await import(join(repository, "lib/vector-scene.ts"))
  const input = structuredClone(source)
  const original = JSON.stringify(input)
  const work = negotiateLanes(input, input.connections, fixedCopper(input), [],
    new Map(input.connections.map((connection) => [connection.name, 0.1])))
  const start = performance.now()
  let state = work.next(), yields = 0
  try {
    while (!state.done && yields++ < 10000) state = work.next()
    if (!state.done || !state.value) throw Error(`${name}: refusing incomplete routes`)
    const traces: Trace[] = state.value
    if (JSON.stringify(input) !== original) throw Error(`${name}: input mutation`)
    if (traces.length !== source.connections.length ||
        new Set(traces.map((trace) => trace.connection_name)).size !== source.connections.length)
      throw Error(`${name}: incomplete signal set`)
    for (const connection of source.connections) {
      const trace = traces.find((candidate) => candidate.connection_name === connection.name)
      if (!trace || trace.route.length < 2 ||
          distance(trace.route[0], connection.pointsToConnect[0]) >= 1e-8 ||
          distance(trace.route.at(-1)!, connection.pointsToConnect[1]) >= 1e-8 ||
          trace.route[0].layer !== connection.pointsToConnect[0].layer ||
          trace.route.at(-1)!.layer !== connection.pointsToConnect[1].layer)
        throw Error(`${name}: disconnected endpoint`)
    }
    const solveMilliseconds = performance.now() - start
    const drc = validateRoutedCopperDrc({ inputSrj: input,
      routedSrj: { ...input, traces }, clearance: 0.1,
      allowBlindAndBuriedVias: false } as Parameters<typeof validateRoutedCopperDrc>[0])
    if (!drc.valid || drc.issues.length) throw Error(`${name}: refusing DRC failures`)
    const validator = BusLanesSolver.forValidation(input, traces, validationOptions)
    while (!validator.solved && !validator.failed) validator.step()
    if (!validator.solved || validator.failed)
      throw Error(`${name}: canonical output validator rejected completion: ${validator.error}`)
    const output = validator.getOutput()
    if (output.traces.length !== source.connections.length)
      throw Error(`${name}: validated output is incomplete`)
    const publicDefaultValidator = BusLanesSolver.forValidation(input, traces)
    while (!publicDefaultValidator.solved && !publicDefaultValidator.failed)
      publicDefaultValidator.step()
    if (!publicDefaultValidator.solved || publicDefaultValidator.failed ||
        JSON.stringify(publicDefaultValidator.getOutput()) !== JSON.stringify(output))
      throw Error(`${name}: public default output validation did not accept the exact same output`)
    if (JSON.stringify(beforeSource) !== JSON.stringify(await identity(repository)))
      throw Error(`${name}: solver source changed during fresh solve`)
    retained.push({ name, identity: beforeSource, input, traces, yields,
      solveMilliseconds, totalCopperLengthMm: traces.reduce((sum, trace) => sum + length(trace.route), 0),
      longestCopperLengthMm: Math.max(...traces.map((trace) => length(trace.route))),
      drc, validator, publicDefaultValidatorSolved: publicDefaultValidator.solved })
  } finally {
    if (!state.done) work.return(null)
  }
}
if (retained.length !== 2) throw Error("Both fresh candidates must validate before rendering")
const artifacts = []
for (const result of retained) {
  const graphics = result.validator.visualize()
  const completed = `${result.traces.length}/${source.connections.length}`
  const { minX, maxX, minY, maxY } = source.bounds
  graphics.coordinateSystem = "cartesian"
  graphics.title = `${result.name} — untimed bus-stage geometry, ${completed} connected, copper DRC passed`
  // Explicit viewport padding keeps title glyphs inside both render formats.
  graphics.rects!.push({ center: { x: (minX + maxX) / 2, y: (minY + maxY + 3.5) / 2 },
    width: maxX - minX, height: maxY + 3.5 - minY, fill: "none", stroke: "none" })
  graphics.rects!.push({ center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    width: maxX - minX, height: maxY - minY,
    fill: "none", stroke: "#94a3b8" })
  graphics.texts = [{ x: minX, y: maxY + 2.4, fontSize: 0.32,
    anchorSide: "bottom_left", color: "#17212d",
    text: `${result.name} ${result.identity.commit.slice(0, 7)} — ${completed} connected, DRC passed` },
    { x: minX, y: maxY + 1.8, fontSize: 0.25, anchorSide: "bottom_left", color: "#17212d",
      text: "Untimed bus-stage geometry; before optional smooth-corner cleanup" },
    { x: minX, y: maxY + 1.2, fontSize: 0.28, anchorSide: "bottom_left", color: "#17212d",
      text: `Total ${result.totalCopperLengthMm.toFixed(3)} mm · longest ${result.longestCopperLengthMm.toFixed(3)} mm` }]
  const png = await getPngBufferFromGraphicsObject(graphics, { backgroundColor: "#ffffff",
    includeTextLabels: false, pngWidth: 1800, pngHeight: 1900, yFlip: true })
  const svg = getSvgFromGraphicsObject(graphics, { backgroundColor: "#ffffff",
    includeTextLabels: false, svgWidth: 1800, svgHeight: 1900 })
  artifacts.push({ result, png, svg })
}
await mkdir(directory, { recursive: true })
const reports = []
for (const { result, png, svg } of artifacts) {
  await Bun.write(join(directory, `${result.name}-completed.png`), png)
  await Bun.write(join(directory, `${result.name}-completed.svg`), svg)
  await Bun.write(join(directory, `${result.name}-routes.json`), JSON.stringify({
    input: result.input, traces: result.traces, output: result.validator.getOutput(),
    solved: result.validator.solved, failed: result.validator.failed,
    drc: result.drc }, null, 2) + "\n")
  reports.push({ source: result.name, solverIdentity: result.identity,
    requestedSignals: source.connections.length, routedSignals: result.traces.length,
    inputUnchanged: true, continuousCopperDrc: result.drc,
    canonicalValidatorSolved: result.validator.solved,
    canonicalValidatorOptions: validationOptions,
    publicDefaultValidatorSolved: result.publicDefaultValidatorSolved,
    publicDefaultValidatorOptions: {},
    yields: result.yields, solveMilliseconds: result.solveMilliseconds,
    totalCopperLengthMm: result.totalCopperLengthMm,
    longestCopperLengthMm: result.longestCopperLengthMm,
    traceSha256: sha256(JSON.stringify(result.traces)),
    validatedOutputSha256: sha256(JSON.stringify(result.validator.getOutput())),
    pngSha256: sha256(png), svgSha256: sha256(svg) })
  console.log(`${result.name}: ${result.traces.length}/${source.connections.length} complete, DRC passed, total ${result.totalCopperLengthMm.toFixed(3)} mm, longest ${result.longestCopperLengthMm.toFixed(3)} mm`)
}
await Bun.write(join(directory, "fresh-comparison.json"), JSON.stringify({
  generatedAt: new Date().toISOString(), bun: Bun.version, platform: platform(), architecture: arch(),
  fixture, fixtureSha256: sha256(initial), exporterSha256: sha256(await readFile(import.meta.path)),
  canonicalValidatorSource: retained.find((result) => result.name === "head")!.identity,
  nativeCopperDrcDependency: JSON.parse(await readFile("/workspace/bus-lanes-work/package.json", "utf8")).devDependencies["@tscircuit/fanout-solver"],
  acceptance: "Both fresh base/head routes passed all endpoints, continuous copper DRC and canonical solved/getOutput validation before rendering or writing any image.",
  timingScope: "One fresh serial correctness run per revision; no speedup claim.",
  geometryScope: "Exact fresh negotiateLanes bus-stage output; no optional smooth-corner cleanup or length-matching solve is claimed. Canonical output validation uses smoothTuning=false and checks complete endpoints, octilinear copper, self-clearance, fixed/combined clearance, and all declared length/pair constraints.",
  reports }, null, 2) + "\n")
