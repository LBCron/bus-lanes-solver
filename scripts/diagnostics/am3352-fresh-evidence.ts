/** Temporary evidence harness. Product, fixtures, constraints and solver budgets are unchanged. */
import { execFileSync, spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

type RefName = "main" | "pr"
interface Options {
  controller: string
  main: string
  pr: string
  mainSha: string
  prSha: string
  controllerSha: string
  directory: string
  timeoutSeconds: number
  sample?: string
  prNumber: number
  runUrl: string
  signal?: AbortSignal
  writeLine?: (line: string) => Promise<void>
  renderGallery?: boolean
}

const workerMemoryEnvironment = {
  BUN_JSC_forceRAMSize: "2147483648",
  BUN_JSC_miniVMHeapGrowthFactor: "1.05",
}

async function writeEvidenceLine(common: Options, line: string) {
  if (common.writeLine) await common.writeLine(line)
  else console.log(line)
}

function optionsFromArgs(args: string[]): Options {
  const names = [
    "controller",
    "main",
    "pr",
    "main-sha",
    "pr-sha",
    "controller-sha",
    "directory",
    "timeout-seconds",
    "pr-number",
    "run-url",
  ]
  const optionalNames = ["sample"]
  const values = new Map<string, string>()
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i]?.replace(/^--/, "")
    if (
      ![...names, ...optionalNames].includes(name) ||
      !args[i + 1] ||
      values.has(name)
    )
      throw Error("Invalid measurement arguments")
    values.set(name, args[i + 1])
  }
  if (names.some((name) => !values.has(name)))
    throw Error(
      `Required arguments: ${names.map((name) => `--${name}`).join(" ")}`,
    )
  const timeoutSeconds = Number(values.get("timeout-seconds"))
  if (
    !Number.isSafeInteger(timeoutSeconds) ||
    timeoutSeconds < 1 ||
    timeoutSeconds > 3600
  )
    throw Error("Expected a per-solver budget in 1..3600 seconds")
  for (const name of ["main-sha", "pr-sha", "controller-sha"])
    if (!/^[a-f0-9]{40}$/i.test(values.get(name)!))
      throw Error("Expected pinned full commit SHAs")
  const prNumber = Number(values.get("pr-number"))
  const runUrl = values.get("run-url")!
  if (
    !Number.isSafeInteger(prNumber) ||
    prNumber <= 0 ||
    !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/actions\/runs\/\d+(?:\/attempts\/\d+)?$/.test(
      runUrl,
    )
  )
    throw Error("Expected an actual PR number and workflow run URL")
  return {
    controller: resolve(values.get("controller")!),
    main: resolve(values.get("main")!),
    pr: resolve(values.get("pr")!),
    mainSha: values.get("main-sha")!,
    prSha: values.get("pr-sha")!,
    controllerSha: values.get("controller-sha")!,
    directory: resolve(values.get("directory")!),
    timeoutSeconds,
    sample: values.get("sample"),
    prNumber,
    runUrl,
  }
}

/** GNU time reports KiB; macOS BSD time reports bytes. Never infer missing RSS. */
export function readPeakRss(options: { platform: string; stderr: string }) {
  const expression =
    options.platform === "linux"
      ? /^\s*Maximum resident set size \(kbytes\):\s*(\d+)\s*$/gm
      : options.platform === "darwin"
        ? /^\s*(\d+)\s+maximum resident set size\s*$/gm
        : undefined
  if (!expression)
    throw Error("Only GNU/Linux and macOS time formats are supported")
  const matches = [...options.stderr.matchAll(expression)]
  if (matches.length !== 1)
    throw Error("Expected exactly one explicit peak RSS measurement")
  const value = Number(matches[0][1])
  if (!Number.isSafeInteger(value) || value <= 0)
    throw Error("Invalid peak RSS measurement")
  return {
    peakRssBytes: value * (options.platform === "linux" ? 1024 : 1),
    rawValue: value,
    rawUnit: options.platform === "linux" ? "KiB" : "bytes",
    source: "/usr/bin/time",
    scope:
      "fresh canonical worker process; includes fixture loading and final validation",
  }
}

async function runWorker(options: {
  common: Options
  ref: RefName
  sample: string
}) {
  const { common, ref, sample } = options
  const routesDirectory = join(common.directory, "routes", ref)
  const workerArgs = [
    process.execPath,
    join(common.controller, "scripts/benchmark.ts"),
    "--worker",
    sample,
    "--solver",
    join(common[ref], "lib/index.ts"),
    "--timeout-seconds",
    String(common.timeoutSeconds),
    "--routes-directory",
    routesDirectory,
  ]
  const args = [process.platform === "linux" ? "-v" : "-l", ...workerArgs]
  if (!["linux", "darwin"].includes(process.platform))
    throw Error("Unsupported time implementation")
  const env: NodeJS.ProcessEnv = { ...process.env, ...workerMemoryEnvironment }
  for (const name of [
    "GH_TOKEN",
    "GITHUB_TOKEN",
    "NODE_AUTH_TOKEN",
    "NPM_TOKEN",
    "ACTIONS_RUNTIME_TOKEN",
    "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
  ])
    delete env[name]
  const started = performance.now()
  const child = spawn("/usr/bin/time", args, {
    cwd: common.controller,
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  })
  let stdout = "",
    stderr = "",
    timedOut = false,
    aborted = false,
    processError: string | null = null
  // Match the canonical controller's bounded log retention.
  child.stdout.on("data", (chunk) => {
    stdout = (stdout + String(chunk)).slice(-2_000_000)
  })
  child.stderr.on("data", (chunk) => {
    stderr = (stderr + String(chunk)).slice(-2_000_000)
  })
  const deadline = setTimeout(
    () => {
      timedOut = true
      if (!child.pid) return
      try {
        process.kill(-child.pid, "SIGKILL")
      } catch {
        /* close event remains authoritative */
      }
    },
    (common.timeoutSeconds + 120) * 1000,
  )
  const abort = () => {
    aborted = true
    if (!child.pid) return
    try {
      process.kill(-child.pid, "SIGKILL")
    } catch {
      /* close event remains authoritative */
    }
  }
  common.signal?.addEventListener("abort", abort, { once: true })
  if (common.signal?.aborted) abort()
  const exitCode = await new Promise<number | null>((finish) => {
    child.on("error", (error) => {
      processError = error.message
    })
    child.on("close", (code) => finish(code))
  })
  clearTimeout(deadline)
  common.signal?.removeEventListener("abort", abort)
  const wallMilliseconds = performance.now() - started
  const lines = stdout.split("\n").filter((line) => line.startsWith("REPORT "))
  let report: unknown = null
  if (lines.length !== 1)
    processError ??= `Worker returned ${lines.length} reports`
  else {
    try {
      report = JSON.parse(lines[0].slice(7))
    } catch {
      processError ??= "Malformed worker report"
    }
  }
  let memory: ReturnType<typeof readPeakRss> | null = null
  try {
    memory = readPeakRss({ platform: process.platform, stderr })
  } catch (error) {
    processError ??= error instanceof Error ? error.message : String(error)
  }
  if (aborted)
    processError =
      "Evidence run wall deadline ended before this sample completed; comparison incomplete"
  else if (timedOut)
    processError =
      "Worker exceeded its process deadline; peak RSS may be unavailable"
  else if (exitCode !== 0) processError ??= `Worker exited ${exitCode}`
  const stem = join(common.directory, `${sample}.${ref}`)
  await writeFile(`${stem}.stdout.log`, stdout)
  await writeFile(`${stem}.stderr.log`, stderr)
  return {
    report,
    wallMilliseconds,
    exitCode,
    error: processError,
    timedOut,
    aborted,
    memory,
    command: ["/usr/bin/time", ...args],
  }
}

export async function exportSavedGallery(options: {
  common: Options
  ref: RefName
}) {
  const { common, ref } = options
  const samplesModule = await import(
    pathToFileURL(join(common.controller, "scripts/am3352-samples.ts")).href
  )
  const exporter = await import(
    pathToFileURL(join(common.controller, "scripts/snapshot-routed-am3352.ts"))
      .href
  )
  const candidates = []
  for (const placement of samplesModule.am3352SamplePlacements) {
    const { input, metadata } = await samplesModule.loadAm3352Sample(
      placement.name,
    )
    const saved = JSON.parse(
      await readFile(
        join(common.directory, "routes", ref, `${placement.name}.json`),
        "utf8",
      ),
    )
    if (
      samplesModule.am3352Hash(input) !== samplesModule.am3352Hash(saved.input)
    )
      throw Error("Saved route input differs from the pinned canonical fixture")
    candidates.push({
      solver: {
        solved: saved.solved,
        failed: saved.failed,
        error: saved.error,
        input: saved.input,
        traces: saved.traces,
        getOutput: () => saved.output,
      },
      metadata,
    })
  }
  // The existing exporter validates every declared sample before writing any image.
  return exporter.exportAm3352RoutedSnapshots(
    candidates,
    join(common.directory, "gallery", ref),
  )
}

export async function runMeasurements(common: Options) {
  for (const ref of ["controller", "main", "pr"] as const) {
    const actual = execFileSync(
      "git",
      ["-C", common[ref], "rev-parse", "HEAD"],
      { encoding: "utf8" },
    ).trim()
    if (actual !== common[`${ref}Sha`])
      throw Error(`The ${ref} checkout differs from its pinned revision`)
    execFileSync("git", [
      "-C",
      common[ref],
      "diff",
      "--quiet",
      "HEAD",
      "--",
      "lib",
      "scripts",
      "package.json",
    ])
  }
  // A new directory prevents old route files from becoming evidence for a failed fresh solve.
  await mkdir(common.directory)
  const samples = JSON.parse(
    await readFile(
      join(common.controller, "scripts/pr-benchmark/samples.json"),
      "utf8",
    ),
  ) as string[]
  if (samples.length !== 11 || new Set(samples).size !== 11)
    throw Error("Expected all eleven canonical samples")
  if (common.sample && !samples.includes(common.sample))
    throw Error("Unknown canonical sample")
  const pairs = []
  const report = await import(
    pathToFileURL(join(common.controller, "scripts/pr-benchmark/report.ts"))
      .href
  )
  for (const [index, sample] of samples.entries()) {
    if (common.sample && common.sample !== sample) continue
    const order: RefName[] = index % 2 ? ["pr", "main"] : ["main", "pr"]
    const pair: Record<string, unknown> = {
      sample,
      timeoutSeconds: common.timeoutSeconds,
      metadata: {
        order,
        mainSha: common.mainSha,
        prSha: common.prSha,
        controllerSha: common.controllerSha,
        bunVersion: Bun.version,
        platform: process.platform,
        architecture: process.arch,
        runnerName: process.env.RUNNER_NAME ?? "local",
        runnerOS: process.env.RUNNER_OS ?? process.platform,
        forceRamSize: workerMemoryEnvironment.BUN_JSC_forceRAMSize,
        heapGrowthFactor:
          workerMemoryEnvironment.BUN_JSC_miniVMHeapGrowthFactor,
      },
    }
    for (const ref of order) {
      if (common.signal?.aborted)
        throw Error(
          "Evidence wall deadline reached; remaining fresh solves are missing",
        )
      await writeEvidenceLine(
        common,
        `${sample}: fresh ${ref} (${common[`${ref}Sha`]})`,
      )
      const worker = await runWorker({ common, ref, sample })
      pair[ref] = worker
      await writeFile(
        join(common.directory, `${sample}.json`),
        JSON.stringify(pair, null, 2) + "\n",
      )
      await writeEvidenceLine(
        common,
        "MEASURED_AM3352_WORKER " + JSON.stringify({ sample, ref, ...worker }),
      )
    }
    const oneSampleSummary = report
      .summarizeComparison({
        samples: [pair],
        mainSha: common.mainSha,
        prSha: common.prSha,
        controllerSha: common.controllerSha,
        prNumber: common.prNumber,
        timeoutSeconds: common.timeoutSeconds,
        runUrl: common.runUrl,
      })
      .samples.find((item: { sample: string }) => item.sample === sample)
    if (oneSampleSummary?.main.accepted && oneSampleSummary.pr.accepted) {
      const saved = await Promise.all(
        (["main", "pr"] as RefName[]).map(async (ref) =>
          JSON.parse(
            await readFile(
              join(common.directory, "routes", ref, `${sample}.json`),
              "utf8",
            ),
          ),
        ),
      )
      pair.retainedRouteProvenance = await Promise.all(
        (["main", "pr"] as RefName[]).map(async (ref, index) => ({
          ref,
          sourceFileSha256: createHash("sha256")
            .update(
              await readFile(
                join(common.directory, "routes", ref, `${sample}.json`),
              ),
            )
            .digest("hex"),
          serializedInputSha256: createHash("sha256")
            .update(JSON.stringify(saved[index].input))
            .digest("hex"),
          routedCopperSha256: createHash("sha256")
            .update(JSON.stringify(saved[index].traces))
            .digest("hex"),
          nativeOutputSha256: createHash("sha256")
            .update(JSON.stringify(saved[index].output))
            .digest("hex"),
        })),
      )
      pair.noIntentParity = {
        pendingRoutingAccessAbsentOnBoth: saved.every(
          (result) => result.input.pendingRoutingAccess === undefined,
        ),
        exactInputEqual:
          JSON.stringify(saved[0].input) === JSON.stringify(saved[1].input),
        exactRoutedCopperEqual:
          JSON.stringify(saved[0].traces) === JSON.stringify(saved[1].traces),
        exactNativeOutputEqual:
          JSON.stringify(saved[0].output) === JSON.stringify(saved[1].output),
      }
      await writeFile(
        join(common.directory, `${sample}.json`),
        JSON.stringify(pair, null, 2) + "\n",
      )
    }
    pairs.push(pair)
    await writeEvidenceLine(
      common,
      "MEASURED_AM3352_PAIR " + JSON.stringify(pair),
    )
  }
  if (common.sample) return { pairs, summary: null }
  await writeFile(
    join(common.directory, "measurement-pairs.json"),
    JSON.stringify(pairs, null, 2) + "\n",
  )
  const comparisonOptions = {
    samples: pairs,
    mainSha: common.mainSha,
    prSha: common.prSha,
    controllerSha: common.controllerSha,
    prNumber: common.prNumber,
    timeoutSeconds: common.timeoutSeconds,
    runUrl: common.runUrl,
  }
  const summary = report.summarizeComparison(comparisonOptions)
  await writeFile(
    join(common.directory, "comparison.md"),
    report.renderComparison(comparisonOptions),
  )
  await writeFile(
    join(common.directory, "summary.json"),
    JSON.stringify(summary, null, 2) + "\n",
  )
  await writeEvidenceLine(
    common,
    "MEASURED_AM3352_SUMMARY " + JSON.stringify(summary),
  )
  // Failed/incomplete routes remain local diagnostic data. Never render them.
  if (
    !summary.artifactComplete ||
    !summary.inputComparable ||
    !summary.metadataComparable
  )
    throw Error("The paired comparison is incomplete or inputs/metadata differ")
  if (
    summary.main.accepted !== samples.length ||
    summary.pr.accepted !== samples.length
  )
    throw Error(
      "Both revisions must freshly accept all eleven samples before any gallery is exported",
    )
  if (common.renderGallery !== false)
    for (const ref of ["main", "pr"] as RefName[])
      await exportSavedGallery({ common, ref })
  return { pairs, summary }
}

if (import.meta.main) {
  if (process.argv.includes("--help"))
    console.log(
      "bun am3352-parent61-measure.ts --controller PATH --main PATH --pr PATH --main-sha SHA --pr-sha SHA --controller-sha SHA --directory PATH --timeout-seconds 3600 --pr-number NUMBER --run-url ACTUAL_CI_RUN_URL [--sample NAME]",
    )
  else await runMeasurements(optionsFromArgs(process.argv.slice(2)))
}
