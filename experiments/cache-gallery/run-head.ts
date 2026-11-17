import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { gzipSync } from "node:zlib"

const [sample, workspaceArg] = process.argv.slice(2)
assert(sample && workspaceArg, "Expected sample and workspace")
const workspace = resolve(workspaceArg)
const base = join(workspace, "base")
const head = join(workspace, "head")
const output = join(workspace, "results", sample)
mkdirSync(output, { recursive: true })
const { runBenchmarkProcess } = await import(pathToFileURL(join(base, "scripts/pr-benchmark/run-pair.ts")).href)
const { SAMPLE_NAMES } = await import(pathToFileURL(join(base, "scripts/pr-benchmark/report.ts")).href)
assert(SAMPLE_NAMES.includes(sample), "Unknown AM3352 sample")
assert.equal(Bun.version, "1.4.0")
const sha = (value: Uint8Array | string): string => createHash("sha256").update(value).digest("hex")
const controllerSha = "39154c9830acff7432f89fec6395f3dcb91f91fa"
const solverSha = "d47b57c26e6d173d83a76adb5147f38c81623045"
assert.equal(sha(readFileSync(join(head, "lib/board-grid.ts"))), "0bf8b997b9731cb786bc6977a0767e52f25f08341d248b9c728bb1c17a3ec0cd")
const baseLock = readFileSync(join(base, "bun.lock"))
assert(baseLock.equals(readFileSync(join(head, "bun.lock"))), "Gallery solver/controller resolved dependencies differ")
writeFileSync(join(output, "runtime.bun.lock"), baseLock)
const nativeDirectory = join(workspace, "native", sample)
const result = await runBenchmarkProcess([
  join(base, "scripts/benchmark.ts"), "--worker", sample,
  "--timeout-seconds", "3600", "--solver", join(head, "lib/index.ts"),
  "--routes-directory", nativeDirectory,
], base, 3720000)
const { stdout, stderr, ...worker } = result
writeFileSync(join(output, "stdout.log"), stdout)
writeFileSync(join(output, "stderr.log"), stderr)
const nativePath = join(nativeDirectory, `${sample}.json`)
let nativeSha256: string | null = null
let routeSha256: string | null = null
let outputSha256: string | null = null
if (existsSync(nativePath)) {
  const raw = readFileSync(nativePath)
  const native = JSON.parse(raw.toString())
  nativeSha256 = sha(raw)
  routeSha256 = sha(JSON.stringify(native.traces))
  outputSha256 = sha(JSON.stringify(native.output))
  writeFileSync(join(output, "native.json.gz"), gzipSync(raw))
  unlinkSync(nativePath)
}
const report = worker.report as Record<string, any> | null
const accepted = worker.exitCode === 0 && worker.error === null && !worker.timedOut &&
  report?.sample === sample && report.timeoutSeconds === 3600 && report.status === "solved" &&
  report.solved === true && report.requestedSignals === 47 && report.routedSignals === 47 &&
  report.inputUnchanged === true && report.fixedPowerPreserved === true && nativeSha256 !== null
const record = {
  sample, controllerSha, solverSha, diagnosticSha: process.env.GITHUB_SHA,
  timeoutSeconds: 3600, processDeadlineSeconds: 3720, accepted, worker,
  nativeSha256, routeSha256, outputSha256, lockSha256: sha(baseLock),
  runtime: { bun: Bun.version, platform: process.platform, architecture: process.arch,
    runner: process.env.RUNNER_NAME, runnerOS: process.env.RUNNER_OS,
    forceRAMSize: process.env.BUN_JSC_forceRAMSize, heapGrowthFactor: process.env.BUN_JSC_miniVMHeapGrowthFactor },
  purpose: "One fresh head solve for a success-gated native gallery. Paired PR comparison is separate.",
}
writeFileSync(join(output, "worker.json"), JSON.stringify(record, null, 2) + "\n")
console.log(`GALLERY_HEAD_RESULT ${JSON.stringify(record)}`)
if (!accepted) throw new Error(`${sample}: fresh head solve was not accepted; no gallery may be exported`)
