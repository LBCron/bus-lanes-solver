import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { gunzipSync } from "node:zlib"
import { length } from "../../lib/geometry"
import type { SimpleRouteJson } from "../../lib/types"

type CompletedBytePair = {
  circuit: string
  phase: string
  allCapturesPresent: boolean
  startSrjEqual: boolean
  endSrjEqual: boolean
  sha256: [string, string, string, string]
}
type CoreComparison = {
  finalConfig: {
    baseline: { sourceCommit: string }
    head: { sourceCommit: string }
  }
  completedByteGeometry: CompletedBytePair[]
}

function readByteCapture({
  bytePair,
  kind,
}: {
  bytePair: CompletedBytePair
  kind: "start" | "end"
}): SimpleRouteJson {
  const bytes = gunzipSync(
    readFileSync(
      join(
        import.meta.dir,
        "completed-byte-captures",
        bytePair.circuit,
        `${bytePair.phase}-${kind}.srj.json.gz`,
      ),
    ),
  )
  const digest = createHash("sha256").update(bytes).digest("hex")
  const hashIndex = kind === "start" ? 0 : 1
  assert.equal(digest, bytePair.sha256[hashIndex])
  assert.equal(digest, bytePair.sha256[hashIndex + 2])
  return JSON.parse(bytes.toString()) as SimpleRouteJson
}

function measureRequestedBusCopper({
  input,
  output,
}: {
  input: SimpleRouteJson
  output: SimpleRouteJson
}) {
  assert.equal(input.differentialPairs?.length ?? 0, 0)
  return (input.buses ?? []).map((bus) => {
    assert.equal(bus.minLength, undefined)
    assert.equal(bus.maxLength, undefined)
    assert.equal(bus.maxLengthSkew, undefined)
    const signals = bus.connectionNames
      .filter((name) =>
        input.connections.some((connection) => connection.name === name),
      )
      .map((connectionName) => {
        const traces =
          output.traces?.filter(
            (trace) => trace.connection_name === connectionName,
          ) ?? []
        assert(traces.length > 0)
        const copperLengthMm = traces.reduce(
          (total, trace) => total + length(trace.route),
          0,
        )
        assert(Number.isFinite(copperLengthMm) && copperLengthMm > 0)
        return { connectionName, traceCount: traces.length, copperLengthMm }
      })
    assert(signals.length > 0)
    const signalLengths = signals.map((signal) => signal.copperLengthMm)
    return {
      busId: bus.busId,
      signals,
      totalCopperLengthMm: signalLengths.reduce(
        (total, distance) => total + distance,
        0,
      ),
      minimumSignalLengthMm: Math.min(...signalLengths),
      maximumSignalLengthMm: Math.max(...signalLengths),
      maxMinSkewMm: Math.max(...signalLengths) - Math.min(...signalLengths),
    }
  })
}

const comparison = JSON.parse(
  readFileSync(join(import.meta.dir, "core-comparison.json"), "utf8"),
) as CoreComparison
const byteMeasurements = comparison.completedByteGeometry.map((bytePair) => {
  assert(
    bytePair.allCapturesPresent &&
      bytePair.startSrjEqual &&
      bytePair.endSrjEqual,
  )
  return {
    circuit: bytePair.circuit,
    phase: bytePair.phase,
    identicalBetweenReproAndFix: true,
    buses: measureRequestedBusCopper({
      input: readByteCapture({ bytePair, kind: "start" }),
      output: readByteCapture({ bytePair, kind: "end" }),
    }),
  }
})
assert.equal(byteMeasurements.length, 25)
writeFileSync(
  join(import.meta.dir, "byte-copper-measurements.json"),
  `${JSON.stringify(
    {
      reproSource: comparison.finalConfig.baseline.sourceCommit,
      fixSource: comparison.finalConfig.head.sourceCommit,
      scope:
        "XY route-polyline copper length, including supplied fanout portions of each requested signal; vertical via barrel delay is excluded. No timing tolerance or pair constraint is declared, and no DDR matching acceptance is inferred.",
      scriptSha256: createHash("sha256")
        .update(readFileSync(import.meta.path))
        .digest("hex"),
      byteMeasurements,
    },
    null,
    2,
  )}\n`,
)
console.log(
  `Verified equal copper length/skew on ${byteMeasurements.length} completed byte pairs`,
)
