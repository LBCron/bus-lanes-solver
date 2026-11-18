import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import {
  type CaptureState,
  captureBenchmarkResult,
  renderSnapshot,
} from "./orangecrab-snapshot"

let directory = import.meta.dir
let captureRoot: string | undefined
let state: CaptureState | undefined
for (let index = 2; index < process.argv.length; index++) {
  const argument = process.argv[index]
  if (argument === "--output") directory = resolve(process.argv[++index])
  else if (argument === "--capture")
    captureRoot = resolve(process.argv[++index])
  else if (argument === "--state") {
    const captureState = process.argv[++index]
    assert(captureState === "baseline_timeout" || captureState === "completed")
    state = captureState
  } else throw new Error(`Unknown snapshot option: ${argument}`)
}

if (captureRoot) {
  assert(state, "--capture requires --state baseline_timeout|completed")
  captureBenchmarkResult({ captureRoot, directory, state })
} else {
  assert(!state, "--state is used with --capture")
  assert(existsSync(join(directory, "capture", "provenance.json")))
}
renderSnapshot({ directory })
