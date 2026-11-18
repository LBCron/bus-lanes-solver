import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import { length } from "../../lib/geometry.ts"

const root = import.meta.dir
const comparison = JSON.parse(readFileSync(`${root}/core-comparison.json`, "utf8"))
const readPhase = (path: string, circuit: string, phase: string, kind: string, expectedSha256: string) => {
  const compressed = `${root}/core-completed-phases/${circuit}/${phase}-${kind}.srj.json.gz`
  const bytes = existsSync(compressed)
    ? gunzipSync(readFileSync(compressed))
    : readFileSync(path)
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expectedSha256)
  return JSON.parse(bytes.toString())
}
const rows = []
for (const item of comparison.cases) {
  for (const phase of item.completedByteGeometryComparison) {
    assert(phase.allRawFilesPresent && phase.startSrjEqual && phase.endSrjEqual)
    const measurements: Record<string, unknown> = {}
    for (const label of ["main", "head"]) {
      const input = readPhase(phase[`${label}StartPath`], item.circuit, phase.phase, "start", phase[`${label}StartSha256`])
      const output = readPhase(phase[`${label}EndPath`], item.circuit, phase.phase, "end", phase[`${label}EndSha256`])
      const requested = new Set(input.connections.map((c: any) => c.name))
      measurements[label] = input.buses.map((bus: any) => {
        const names = bus.connectionNames.filter((name: string) => requested.has(name))
        assert(names.length > 0)
        const signals = names.map((name: string) => {
          const traces = output.traces.filter((trace: any) => trace.connection_name === name)
          assert(traces.length > 0)
          const copperMm = traces.reduce((sum: number, trace: any) => sum + length(trace.route), 0)
          assert(Number.isFinite(copperMm) && copperMm > 0)
          return { connectionName: name, traceCount: traces.length, copperMm }
        })
        const lengths = signals.map((signal: any) => signal.copperMm)
        return {
          busId: bus.busId,
          signals,
          totalCopperMm: lengths.reduce((sum: number, value: number) => sum + value, 0),
          minimumSignalMm: Math.min(...lengths),
          maximumSignalMm: Math.max(...lengths),
          maxMinSkewMm: Math.max(...lengths) - Math.min(...lengths),
          declaredMinLengthMm: bus.minLength ?? null,
          declaredMaxLengthMm: bus.maxLength ?? null,
          declaredMaxLengthSkewMm: bus.maxLengthSkew ?? null,
          differentialPairCount: input.differentialPairs?.length ?? 0,
        }
      })
    }
    assert.deepEqual(measurements.main, measurements.head)
    rows.push({ circuit: item.circuit, phase: phase.phase, unchanged: true, ...measurements })
  }
}
assert.equal(rows.length, 25)
const report = {
  sourceHead: comparison.headBusSourceCommit,
  sourceMain: comparison.mainSourceCommit,
  scope: "Postprocessing fresh completed core byte-stage outputs; XY route-polyline lengths include supplied fanout portions belonging to each current requested signal and exclude vertical via barrel delay. No matching tolerance or pair acceptance is inferred.",
  allTwentyFiveCompletedByteMetricsUnchanged: true,
  scriptSha256: createHash("sha256").update(readFileSync(import.meta.path)).digest("hex"),
  rows,
}
writeFileSync(`${root}/core-bus-copper-metrics.json`, `${JSON.stringify(report, null, 2)}\n`)
let markdown = "# Completed core byte-stage copper measurements\n\n"
markdown += "All 25 jointly completed byte phases have identical measured geometry on main and final head. Values below apply to both. These are XY polyline lengths for each requested signal, including its supplied fanout portions and excluding vertical via barrel delay; they are not DDR delay matching. No timing tolerance or differential pair is declared in these byte inputs.\n\n"
markdown += "| Circuit | Phase | Bus | Total copper (mm) | Minimum (mm) | Maximum (mm) | Max−min skew (mm) |\n| --- | --- | --- | ---: | ---: | ---: | ---: |\n"
for (const row of rows) {
  for (const bus of row.main as any[]) {
    markdown += `| ${row.circuit} | ${row.phase} | ${bus.busId} | ${bus.totalCopperMm.toFixed(6)} | ${bus.minimumSignalMm.toFixed(6)} | ${bus.maximumSignalMm.toFixed(6)} | ${bus.maxMinSkewMm.toFixed(6)} |\n`
  }
}
markdown += "\n[Per-signal measurements and provenance](core-bus-copper-metrics.json) · [Calculation script](core-bus-copper-metrics.ts). The identical main/head raw start/end captures are preserved once per phase as gzip files in `core-completed-phases/`; their uncompressed hashes match both revisions in the core comparison. The script verifies both revisions' recorded raw-file hashes before measuring. Run `bun docs/global-bus-corridors/core-bus-copper-metrics.ts` from this evidence checkout to recompute without core or fresh routing.\n"
writeFileSync(`${root}/core-bus-copper-metrics.md`, markdown)
console.log(`Verified unchanged per-bus copper metrics for ${rows.length} completed phases`)
