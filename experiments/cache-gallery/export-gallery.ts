import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { gunzipSync } from "node:zlib"

const [workspaceArg] = process.argv.slice(2)
assert(workspaceArg, "Expected workspace")
const workspace = resolve(workspaceArg)
const base = join(workspace, "base")
const inputRoot = join(workspace, "native-artifacts")
const output = join(workspace, "gallery")
const { am3352Hash, am3352SamplePlacements, loadAm3352Sample } = await import(pathToFileURL(join(base, "scripts/am3352-samples.ts")).href)
const { exportAm3352RoutedSnapshots } = await import(pathToFileURL(join(base, "scripts/snapshot-routed-am3352.ts")).href)
const sha = (value: Uint8Array | string): string => createHash("sha256").update(value).digest("hex")
const controllerSha = "39154c9830acff7432f89fec6395f3dcb91f91fa"
const solverSha = "d47b57c26e6d173d83a76adb5147f38c81623045"
assert.equal(Bun.version, "1.4.0")
assert.equal(am3352SamplePlacements.length, 11)
const directories = readdirSync(inputRoot).sort()
const expectedDirectories = am3352SamplePlacements.map((placement: { name: string }) => `am3352-cache-head-native-${placement.name}`).sort()
assert.deepEqual(directories, expectedDirectories, "Exactly eleven native sample artifacts required")
const candidates = []
const samples = []
const lockHash = sha(readFileSync(join(base, "bun.lock")))
for (const placement of am3352SamplePlacements) {
  const directory = join(inputRoot, `am3352-cache-head-native-${placement.name}`)
  const record = JSON.parse(readFileSync(join(directory, "worker.json"), "utf8"))
  assert.equal(record.sample, placement.name)
  assert.equal(record.controllerSha, controllerSha)
  assert.equal(record.solverSha, solverSha)
  assert.equal(record.diagnosticSha, process.env.GITHUB_SHA)
  assert.equal(record.accepted, true, `${placement.name}: native worker did not pass`)
  assert.equal(record.lockSha256, lockHash)
  assert.equal(sha(readFileSync(join(directory, "runtime.bun.lock"))), lockHash)
  const raw = gunzipSync(readFileSync(join(directory, "native.json.gz")))
  assert.equal(sha(raw), record.nativeSha256)
  const native = JSON.parse(raw.toString())
  assert.equal(native.sample, placement.name)
  assert.equal(native.solved, true)
  assert.equal(native.failed, false)
  assert.equal(native.error, null)
  assert.equal(sha(JSON.stringify(native.traces)), record.routeSha256)
  assert.equal(sha(JSON.stringify(native.output)), record.outputSha256)
  const { input, metadata } = await loadAm3352Sample(placement.name)
  assert.equal(am3352Hash(input), record.worker.report.inputSha256)
  assert.equal(am3352Hash(native.input), record.worker.report.inputSha256)
  assert.equal(native.traces.length, 47)
  candidates.push({ solver: {
    solved: native.solved, failed: native.failed, error: native.error,
    input: native.input, traces: native.traces, getOutput: () => native.output,
  }, metadata })
  samples.push({ name: placement.name, inputSha256: am3352Hash(input),
    nativeSha256: record.nativeSha256, routeSha256: record.routeSha256,
    outputSha256: record.outputSha256, freshWorker: record.worker, runtime: record.runtime })
}
// This unchanged exporter validates all eleven native outputs before rendering or writing any image.
const validations = await exportAm3352RoutedSnapshots(candidates, output)
assert.equal(validations.length, 11)
const imageFiles = readdirSync(output).filter((name) => name.endsWith(".svg") || name.endsWith(".png")).sort()
assert.equal(imageFiles.length, 22)
const files = imageFiles.map((name) => {
  const bytes = readFileSync(join(output, name))
  return { name, bytes: bytes.length, sha256: sha(bytes) }
})
const proof = { controllerSha, solverSha, diagnosticSha: process.env.GITHUB_SHA,
  fixPullRequest: "https://github.com/tscircuit/bus-lanes-solver/pull/210",
  runUrl: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  accepted: 11, samples, validations, files, lockSha256: lockHash,
  purpose: "Fresh head-only gallery with retained native outputs; not a paired performance comparison or replacement for the required PR benchmark.",
}
writeFileSync(join(output, "gallery-proof.json"), JSON.stringify(proof, null, 2) + "\n")
const markdown = ["AM3352 cache fix gallery", "", `Solver: ${solverSha}`, "",
  "All 11 fresh head solves passed complete connectivity, fixed-power preservation, DRC, bus matching and pair coupling before image export.", "",
  "| Sample | Completed native route |", "|---|---|",
  ...samples.map(({ name }) => `| ${name} | ![${name} completed native routing](${name}-solved.svg) |`), "",
  "These head-only gallery solves are separate from the required paired PR benchmark; no timing comparison is claimed here.", "",
].join("\n")
writeFileSync(join(output, "README.md"), markdown)
console.log(`GALLERY_EXPORT_RESULT ${JSON.stringify({ accepted: 11, files, lockSha256: lockHash })}`)
