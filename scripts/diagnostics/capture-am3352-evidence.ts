/** Temporary diagnostic branch only. Exclude this script, helper and workflow from the final PR. */
import assert from "node:assert/strict"
import { execFileSync, spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { cpus, release, tmpdir, totalmem } from "node:os"
import { join, resolve } from "node:path"
import { gzipSync } from "node:zlib"
import {
  exportSavedGallery,
  runMeasurements,
} from "./am3352-fresh-evidence"

// Root binds the official feature SHA after the final PR213 head is frozen.
const CONSUMER_SHA = "e6c3ffd80983afc3bfc570b7d9618a0001e79505"
const CONSUMER_PR_NUMBER = 213
const CONTROLLER_SHA = "cbd27db2e7de5697d24fc63928c43fb92d3431d1"
const BASE_SHA = "779b9df28e7978760daf7f96df6a2d1a65c471b6"
const PUBLIC_REPOSITORY = "https://github.com/tscircuit/bus-lanes-solver.git"
const MAX_CAPTURE_BYTES = 3 * 1024 * 1024
const SOLVE_BUDGET_SECONDS = 3600

function publicChildEnvironment() {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_CONFIG_COUNT: "0",
    GIT_TERMINAL_PROMPT: "0",
    BUN_JSC_forceRAMSize: "2147483648",
    BUN_JSC_miniVMHeapGrowthFactor: "1.05",
  }
  for (const name of [
    "GH_TOKEN",
    "GITHUB_TOKEN",
    "NODE_AUTH_TOKEN",
    "NPM_TOKEN",
    "ACTIONS_RUNTIME_TOKEN",
    "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
    "GIT_ASKPASS",
    "SSH_ASKPASS",
    "GIT_SSH_COMMAND",
  ])
    delete env[name]
  return env
}

async function setupCommand(options: {
  command: string
  args: string[]
  cwd: string
  signal: AbortSignal
}) {
  if (options.signal.aborted)
    throw Error("Setup exceeded the evidence wall deadline")
  const child = spawn(options.command, options.args, {
    cwd: options.cwd,
    env: publicChildEnvironment(),
    detached: true,
    // Do not export installation logs, environment variables or credentials.
    stdio: ["ignore", "ignore", "ignore"],
  })
  let expired = false
  const stop = () => {
    expired = true
    if (!child.pid) return
    try {
      process.kill(-child.pid, "SIGKILL")
    } catch {
      /* close event remains authoritative */
    }
  }
  const deadline = setTimeout(stop, 5 * 60 * 1000)
  options.signal.addEventListener("abort", stop, { once: true })
  let failedToStart = false
  const exitCode = await new Promise<number | null>((finish) => {
    child.on("error", () => {
      failedToStart = true
    })
    child.on("close", (code) => finish(code))
  })
  clearTimeout(deadline)
  options.signal.removeEventListener("abort", stop)
  if (expired || failedToStart || exitCode !== 0)
    throw Error(
      `Public checkout/install setup failed (${options.command}, exit ${exitCode}, expired ${expired})`,
    )
}

async function checkoutPublicRevision(options: {
  directory: string
  sha: string
  signal: AbortSignal
}) {
  const parent = resolve(options.directory, "..")
  for (const args of [
    ["init", options.directory],
    ["-C", options.directory, "remote", "add", "origin", PUBLIC_REPOSITORY],
    [
      "-C",
      options.directory,
      "-c",
      "credential.helper=",
      "-c",
      "http.extraHeader=",
      "fetch",
      "--depth=1",
      "origin",
      options.sha,
    ],
    ["-C", options.directory, "checkout", "--detach", "FETCH_HEAD"],
  ])
    await setupCommand({
      command: "git",
      args,
      cwd: parent,
      signal: options.signal,
    })
  const actual = execFileSync(
    "git",
    ["-C", options.directory, "rev-parse", "HEAD"],
    { encoding: "utf8" },
  ).trim()
  if (actual !== options.sha)
    throw Error("Public checkout did not produce its exact pinned commit")
  const frozen =
    existsSync(join(options.directory, "bun.lock")) ||
    existsSync(join(options.directory, "bun.lockb"))
  await setupCommand({
    command: process.execPath,
    args: [
      "install",
      ...(frozen ? ["--frozen-lockfile"] : []),
      "--ignore-scripts",
    ],
    cwd: options.directory,
    signal: options.signal,
  })
}

async function captureEvidence() {
  if (
    !/^[a-f0-9]{40}$/.test(CONSUMER_SHA) ||
    !Number.isSafeInteger(CONSUMER_PR_NUMBER) ||
    CONSUMER_PR_NUMBER <= 0
  )
    throw Error(
      "Root must bind the diagnostic capture to the official feature SHA and PR before publishing",
    )
  assert.equal(Bun.version, "1.4.0")
  assert.equal(process.platform, "linux")
  assert.equal(process.env.GITHUB_REPOSITORY, "tscircuit/bus-lanes-solver")
  assert.equal(process.env.GITHUB_EVENT_NAME, "push")
  assert.equal(existsSync("/usr/bin/time"), true)
  if (!/^\d+$/.test(process.env.GITHUB_RUN_ID ?? ""))
    throw Error("An actual GitHub Actions run is required")
  const diagnosticHead = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim()
  const pushSha = process.env.GITHUB_SHA
  if (typeof pushSha !== "string" || !/^[a-f0-9]{40}$/.test(pushSha))
    throw Error("The exact diagnostic push SHA is required")
  assert.equal(diagnosticHead, pushSha)
  const rawHead = execFileSync("git", ["cat-file", "-p", "HEAD"], {
    encoding: "utf8",
  })
  const parents = rawHead
    .split("\n")
    .filter((line) => line.startsWith("parent "))
    .map((line) => line.slice(7))
  assert.deepEqual(parents, [CONSUMER_SHA])

  const directory = await mkdtemp(join(tmpdir(), "am3352-public-evidence-"))
  const abort = new AbortController()
  const wallDeadline = setTimeout(() => abort.abort(), 175 * 60 * 1000)
  let emittedBytes = 0
  const writeLine = async (line: string) => {
    const text = line + "\n"
    const nextBytes = emittedBytes + Buffer.byteLength(text)
    if (nextBytes > MAX_CAPTURE_BYTES)
      throw Error(
        "Public evidence exceeds its 3 MiB transport budget; no complete capture can be claimed",
      )
    emittedBytes = nextBytes
    await new Promise<void>((finish, reject) => {
      process.stdout.write(text, (error) =>
        error ? reject(error) : finish(),
      )
    })
  }
  const emitCapture = async (options: {
    kind: string
    bytes: Buffer
    sample?: string
    ref?: string
    retainedRouteSha256?: string
  }) => {
    const compressed = gzipSync(options.bytes, { level: 9 })
    const encoded = compressed.toString("base64")
    const metadata = {
      kind: options.kind,
      sample: options.sample,
      ref: options.ref,
      encoding: "gzip+base64",
      decodedBytes: options.bytes.length,
      decodedSha256: createHash("sha256").update(options.bytes).digest("hex"),
      gzipBytes: compressed.length,
      gzipSha256: createHash("sha256").update(compressed).digest("hex"),
      retainedRouteSha256: options.retainedRouteSha256,
    }
    const lines = encoded.match(/.{1,120}/g)?.join("\n") ?? ""
    await writeLine(
      "AM3352_PUBLIC_CAPTURE_BEGIN " +
        JSON.stringify(metadata) +
        "\n" +
        lines +
        "\nAM3352_PUBLIC_CAPTURE_END " +
        options.kind,
    )
  }
  const streamMeasurement = async (line: string) => {
    const prefix = [
      "MEASURED_AM3352_WORKER ",
      "MEASURED_AM3352_PAIR ",
      "MEASURED_AM3352_SUMMARY ",
    ].find((candidate) => line.startsWith(candidate))
    if (!prefix) return writeLine(line)
    const payload = line.slice(prefix.length)
    const parsed = JSON.parse(payload)
    if (prefix === "MEASURED_AM3352_WORKER ")
      await writeLine(
        "AM3352_PUBLIC_WORKER_METRICS " +
          JSON.stringify({
            sample: parsed.sample,
            ref: parsed.ref,
            workerStatus: parsed.report?.status ?? "missing",
            requestedSignals: parsed.report?.requestedSignals ?? null,
            routedSignals: parsed.report?.routedSignals ?? null,
            solveMilliseconds: parsed.report?.solveMilliseconds ?? null,
            wallMilliseconds: parsed.wallMilliseconds,
            peakRssBytes: parsed.memory?.peakRssBytes ?? null,
            error: parsed.error,
            timedOut: parsed.timedOut,
            acceptance:
              "worker report; full canonical paired acceptance follows",
          }),
      )
    if (prefix === "MEASURED_AM3352_PAIR ")
      await writeLine(
        "AM3352_PUBLIC_NO_INTENT_PARITY " +
          JSON.stringify({
            sample: parsed.sample,
            noIntentParity: parsed.noIntentParity ?? null,
            retainedRouteProvenance: parsed.retainedRouteProvenance ?? null,
          }),
      )
    if (prefix === "MEASURED_AM3352_SUMMARY ")
      await writeLine(
        "AM3352_PUBLIC_ACCEPTANCE_SUMMARY " +
          JSON.stringify({
            main: parsed.main,
            pr: parsed.pr,
            lost: parsed.lost,
            gained: parsed.gained,
            artifactComplete: parsed.artifactComplete,
            inputComparable: parsed.inputComparable,
            metadataComparable: parsed.metadataComparable,
            matched: parsed.matched,
          }),
      )
    await emitCapture({
      kind: prefix.trim(),
      bytes: Buffer.from(payload),
      sample: parsed.sample,
      ref: parsed.ref,
    })
  }
  try {
    await writeLine(
      "AM3352_PUBLIC_ENVIRONMENT " +
        JSON.stringify({
          diagnosticHead,
          controllerSha: CONTROLLER_SHA,
          baseSha: BASE_SHA,
          consumerSha: CONSUMER_SHA,
          consumerPr: CONSUMER_PR_NUMBER,
          runId: process.env.GITHUB_RUN_ID,
          bunVersion: Bun.version,
          executable: process.execPath,
          platform: process.platform,
          architecture: process.arch,
          osRelease: release(),
          cpuCount: cpus().length,
          cpuModels: [...new Set(cpus().map((cpu) => cpu.model))],
          totalMemoryBytes: totalmem(),
          runnerName: process.env.RUNNER_NAME,
          runnerOs: process.env.RUNNER_OS,
          configuredRunner:
            "standard GitHub ubuntu-latest; actual CPU and memory reported above",
          comparableRunner:
            "Blacksmith AM3352 acceptance is separate; do not compare absolute times across these runner classes",
          timeoutSecondsPerSolverSample: SOLVE_BUDGET_SECONDS,
          evidenceWallLimitSeconds: 175 * 60,
          workerJsc: {
            forceRamSize: 2147483648,
            miniVMHeapGrowthFactor: 1.05,
          },
          processOrder:
            "canonical sample index: even main/pr, odd pr/main; sequential fresh workers",
          publicDataOnly: true,
        }),
    )
    const controller = join(directory, "controller")
    const main = join(directory, "base")
    const pr = join(directory, "consumer")
    for (const [name, path, sha] of [
      ["controller", controller, CONTROLLER_SHA],
      ["base", main, BASE_SHA],
      ["consumer", pr, CONSUMER_SHA],
    ]) {
      await writeLine(`AM3352_PUBLIC_SETUP ${name} ${sha}`)
      await checkoutPublicRevision({
        directory: path,
        sha,
        signal: abort.signal,
      })
    }
    const common = {
      controller,
      main,
      pr,
      controllerSha: CONTROLLER_SHA,
      mainSha: BASE_SHA,
      prSha: CONSUMER_SHA,
      directory: join(directory, "measured"),
      timeoutSeconds: SOLVE_BUDGET_SECONDS,
      prNumber: CONSUMER_PR_NUMBER,
      runUrl: `https://github.com/tscircuit/bus-lanes-solver/actions/runs/${process.env.GITHUB_RUN_ID}`,
      signal: abort.signal,
      writeLine: streamMeasurement,
      renderGallery: false,
    }
    const { pairs, summary } = await runMeasurements(common)
    if (!summary) throw Error("The all-eleven comparison summary is missing")
    assert.equal(summary.artifactComplete, true)
    assert.equal(summary.inputComparable, true)
    assert.equal(summary.metadataComparable, true)
    assert.equal(summary.main.accepted, 11)
    assert.equal(summary.pr.accepted, 11)
    assert.deepEqual(summary.lost, [])
    assert.equal(pairs.length, 11)
    for (const pair of pairs) {
      assert.deepEqual(pair.noIntentParity, {
        pendingRoutingAccessAbsentOnBoth: true,
        exactInputEqual: true,
        exactRoutedCopperEqual: true,
        exactNativeOutputEqual: true,
      })
      for (const ref of ["main", "pr"] as const) {
        const worker = pair[ref] as {
          memory: { peakRssBytes: number }
          error: string | null
          exitCode: number
        }
        assert.equal(worker.error, null)
        assert.equal(worker.exitCode, 0)
        assert.ok(worker.memory.peakRssBytes > 0)
      }
    }
    // Every fresh run, physical validation, fixed-copper audit and no-intent parity gate passed.
    // Only now revalidate retained outputs and render either revision's gallery.
    for (const ref of ["main", "pr"] as const) {
      if (abort.signal.aborted)
        throw Error("Evidence wall deadline reached before gallery export")
      await exportSavedGallery({ common, ref })
    }
    const samples = JSON.parse(
      await readFile(
        join(controller, "scripts/pr-benchmark/samples.json"),
        "utf8",
      ),
    ) as string[]
    for (const ref of ["main", "pr"] as const) {
      for (const sample of samples) {
        if (abort.signal.aborted)
          throw Error("Evidence wall deadline reached during gallery capture")
        const sourceRoute = await readFile(
          join(common.directory, "routes", ref, `${sample}.json`),
        )
        await emitCapture({
          kind: "ROUTED_SVG",
          sample,
          ref,
          bytes: await readFile(
            join(common.directory, "gallery", ref, `${sample}-solved.svg`),
          ),
          retainedRouteSha256: createHash("sha256")
            .update(sourceRoute)
            .digest("hex"),
        })
      }
    }
    if (abort.signal.aborted)
      throw Error("Evidence wall deadline reached; capture is incomplete")
    await writeLine(
      "AM3352_PUBLIC_EVIDENCE_COMPLETE " +
        JSON.stringify({
          acceptedMain: 11,
          acceptedConsumer: 11,
          galleries: 22,
          noIntentExactParity: 11,
          captureBytes: emittedBytes,
          consumerSha: CONSUMER_SHA,
          baseSha: BASE_SHA,
          productionChanges: false,
          freshSolves: 22,
        }),
    )
  } catch (error) {
    // Failure is visible and remains a failing test; never call a partial capture complete.
    const line =
      "AM3352_PUBLIC_EVIDENCE_INCOMPLETE " +
      JSON.stringify({
        consumerSha: CONSUMER_SHA,
        aborted: abort.signal.aborted,
        reason:
          error instanceof Error ? error.message : "Unknown evidence failure",
      }) +
      "\n"
    await new Promise<void>((finish) => {
      process.stdout.write(line, () => finish())
    })
    throw error
  } finally {
    clearTimeout(wallDeadline)
    abort.abort()
    await rm(directory, { recursive: true, force: true })
  }
}

await captureEvidence()
