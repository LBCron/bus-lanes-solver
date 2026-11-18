import { writeFileSync, unlinkSync, existsSync } from "node:fs"
if (process.env.CORRIDOR_BATCH_GO !== "1")
  throw Error("Prepared experiment only: root GO is required before execution")
const fixtures = process.argv.slice(2).length ? process.argv.slice(2) : ["pocket16-capacity", "pocket24-capacity", "pocket32-capacity", "seed5"]
const results: Record<string, unknown>[] = []
for (const fixture of fixtures) for (const mode of ["base", "batch"]) {
  const path = `/tmp/batch-corridor-${fixture}-${mode}.json`
  if (existsSync(path)) unlinkSync(path)
  const childStartedAt = performance.now()
  const child = Bun.spawn([process.execPath, "/tmp/batch-corridor-proposal-one.ts", fixture, mode], { stdout: "ignore", stderr: "pipe" })
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL") }, 120000)
  const exit = await child.exited
  clearTimeout(timer)
  let result: Record<string, unknown>
  if (await Bun.file(path).exists()) result = await Bun.file(path).json()
  else result = { fixture, mode, status: "startup_failed" }
  if (timedOut) { result.status = "external_timeout"; result.completed = false; result.externalTerminated = true }
  result.exitCode = exit
  result.externalElapsedSeconds = (performance.now() - childStartedAt) / 1000
  writeFileSync(path, JSON.stringify(result, null, 2))
  const { input, output, ...summary } = result
  results.push(summary)
  writeFileSync("/tmp/batch-corridor-proposal-results.json", JSON.stringify({ perRunExternalLimitSeconds: 120, results }, null, 2))
  console.log(JSON.stringify(summary))
  if (exit !== 0 && !timedOut) console.log(await new Response(child.stderr).text())
}
