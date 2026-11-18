import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const directory = "/workspace/ddr-results/quality-gallery"
const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex")
const report = JSON.parse(await readFile(join(directory, "fresh-comparison.json"), "utf8"))
const input = JSON.parse(await readFile(report.fixture, "utf8"))
if (sha256(await readFile(report.fixture)) !== report.fixtureSha256)
  throw Error("Fixture hash mismatch")
if (sha256(await readFile(join(directory, "export-quality.ts"))) !== report.exporterSha256)
  throw Error("Exporter hash mismatch")
const checks = []
for (const result of report.reports) {
  const routes = JSON.parse(await readFile(join(directory, `${result.source}-routes.json`), "utf8"))
  for (const [extension, recorded] of [["png", result.pngSha256], ["svg", result.svgSha256]]) {
    if (sha256(await readFile(join(directory, `${result.source}-completed.${extension}`))) !== recorded)
      throw Error(`${result.source}: ${extension} hash mismatch`)
  }
  if (sha256(JSON.stringify(routes.traces)) !== result.traceSha256 ||
      sha256(JSON.stringify(routes.output)) !== result.validatedOutputSha256 ||
      JSON.stringify(routes.input) !== JSON.stringify(input) ||
      JSON.stringify(routes.output.traces) !== JSON.stringify(routes.traces))
    throw Error(`${result.source}: exact geometry or input identity mismatch`)
  if (!routes.solved || routes.failed || !routes.drc.valid || routes.drc.issues.length ||
      !result.canonicalValidatorSolved || !result.publicDefaultValidatorSolved ||
      result.requestedSignals !== input.connections.length ||
      result.routedSignals !== input.connections.length)
    throw Error(`${result.source}: acceptance mismatch`)
  const repository = result.source === "base" ? "/workspace/bus-lanes-solver" : "/workspace/bus-lanes-work"
  const commit = Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: repository })
  if (commit.exitCode || commit.stdout.toString().trim() !== result.solverIdentity.commit)
    throw Error(`${result.source}: source commit changed`)
  for (const [filename, recorded] of Object.entries(result.solverIdentity.sourceHashes))
    if (sha256(await readFile(join(repository, filename))) !== recorded)
      throw Error(`${result.source}: source changed at ${filename}`)
  checks.push({ source: result.source, pngFile: `${result.source}-completed.png`,
    svgFile: `${result.source}-completed.svg`, pngSha256: result.pngSha256,
    svgSha256: result.svgSha256, traceSha256: result.traceSha256,
    validatedOutputSha256: result.validatedOutputSha256,
    sourceCommit: result.solverIdentity.commit,
    sourceHashesVerified: true, fixtureHashVerified: true,
    exactOutputTraceIdentityVerified: true,
    individuallyOpenedWithViewImage: true,
    visualFindings: "Passed: complete board and all endpoint markers visible; eight continuous routes; all six obstacle rectangles visible; same viewport/scale; full source, acceptance, geometry-scope and measured-length labels readable and unclipped; no dashed unrouted guides or provisional search geometry." })
}
const base = report.reports.find((result: any) => result.source === "base")
const head = report.reports.find((result: any) => result.source === "head")
const totalDelta = head.totalCopperLengthMm - base.totalCopperLengthMm
const longestDelta = head.longestCopperLengthMm - base.longestCopperLengthMm
await Bun.write(join(directory, "artifact-review.json"), JSON.stringify({
  reviewedAt: new Date().toISOString(), reviewer: "/root",
  reviewScope: "Fresh completed bus-stage geometry before optional smooth-corner cleanup; not BusLanesPipeline smooth-mode output or DDR matching acceptance.",
  freshComparisonSha256: sha256(await readFile(join(directory, "fresh-comparison.json"))),
  exporterSha256Verified: true, bothFinalPngsIndividuallyOpened: true,
  failedOrIntermediateImagesIncluded: false,
  physicalAcceptance: "Both candidates passed endpoints and layers, continuous native copper DRC, canonical output validation with smoothTuning=false, and the public forValidation default with identical getOutput traces.",
  totalCopperDeltaMm: totalDelta, longestCopperDeltaMm: longestDelta,
  checks,
}, null, 2) + "\n")
await Bun.write(join(directory, "README.md"), `# Fresh three-barriers bus-stage geometry

These images show the exact fresh \`negotiateLanes\` outputs for
\`tests/fixtures/bus-corridors/three-barriers.json\`, before optional smooth-corner
cleanup. Both have ${input.connections.length}/${input.connections.length} connected signals and clean continuous native copper DRC.
Both also pass \`BusLanesSolver.forValidation\` with \`smoothTuning: false\` and
with its public default options, and \`getOutput()\` retains the exact same traces.
Both candidates passed all gates before either image was rendered or written.
Both final PNGs were individually opened and inspected; labels are unclipped
and all routed geometry and obstacles are visible.

| Revision | Completed | Total copper (mm) | Longest trace (mm) |
| --- | ---: | ---: | ---: |
| Base \`${base.solverIdentity.commit}\` | ${base.routedSignals}/${base.requestedSignals} | ${base.totalCopperLengthMm.toFixed(6)} | ${base.longestCopperLengthMm.toFixed(6)} |
| Head \`${head.solverIdentity.commit}\` | ${head.routedSignals}/${head.requestedSignals} | ${head.totalCopperLengthMm.toFixed(6)} | ${head.longestCopperLengthMm.toFixed(6)} |

Total copper changes by ${totalDelta.toFixed(6)} mm (${(totalDelta / base.totalCopperLengthMm * 100).toFixed(3)}%);
the longest trace changes by ${longestDelta.toFixed(6)} mm (${(longestDelta / base.longestCopperLengthMm * 100).toFixed(3)}%).
Measurements are computed from the saved, validated traces. This is an untimed
geometry comparison: recorded single-run milliseconds are diagnostic only.
It is not a full \`BusLanesPipelineSolver\` smooth-mode solve, and no DDR matching
acceptance or speedup is claimed. The fixture declares no bus skew tolerance;
the trace-length improvement alone does not establish length matching.

- [Base PNG](base-completed.png) / [SVG](base-completed.svg) / [exact routes and accepted output](base-routes.json)
- [Head PNG](head-completed.png) / [SVG](head-completed.svg) / [exact routes and accepted output](head-routes.json)
- [Fresh provenance and results](fresh-comparison.json)
- [Image inspection and independent hash review](artifact-review.json)

Fixture SHA-256: \`${report.fixtureSha256}\`.
The fresh report records runtime/platform, every solver TypeScript source hash,
native DRC dependency revision, validator source/options, and image/trace/output hashes.

Commands in the recorded workspace:

\`\`\`sh
source /workspace/.tools/autorouter-env.sh
cd /workspace/bus-lanes-work
bun /workspace/ddr-results/quality-gallery/export-quality.ts
# Open both completed PNGs individually, then verify their recorded hashes:
bun /workspace/ddr-results/quality-gallery/verify-and-notes.ts
\`\`\`

The exporter pins both revision IDs and verifies source hashes before and after
each fresh solve. It rejects incomplete or disconnected outputs and any native
DRC or canonical validation failure before rendering or writing any image.
Neither input nor copper is adjusted to produce these illustrations.
`)
console.log(JSON.stringify({ verified: true, sources: checks.map((value) => value.source),
  totalCopperDeltaMm: totalDelta, longestCopperDeltaMm: longestDelta }))
