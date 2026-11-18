# Fresh three-barriers bus-stage geometry

These images show the exact fresh `negotiateLanes` outputs for
`tests/fixtures/bus-corridors/three-barriers.json`, before optional smooth-corner
cleanup. Both have 8/8 connected signals and clean continuous native copper DRC.
Both also pass `BusLanesSolver.forValidation` with `smoothTuning: false` and
with its public default options, and `getOutput()` retains the exact same traces.
Both candidates passed all gates before either image was rendered or written.
Both final PNGs were individually opened and inspected; labels are unclipped
and all routed geometry and obstacles are visible.

| Revision | Completed | Total copper (mm) | Longest trace (mm) |
| --- | ---: | ---: | ---: |
| Base `202b034659fb96bad44d11b8190f4044b675116f` | 8/8 | 90.253362 | 14.024012 |
| Head `190325da97253ad7951f9dfd3b0046b4afcb5395` | 8/8 | 87.396129 | 13.324012 |

Total copper changes by -2.857233 mm (-3.166%);
the longest trace changes by -0.700000 mm (-4.991%).
Measurements are computed from the saved, validated traces. This is an untimed
geometry comparison: recorded single-run milliseconds are diagnostic only.
It is not a full `BusLanesPipelineSolver` smooth-mode solve, and no DDR matching
acceptance or speedup is claimed. The fixture declares no bus skew tolerance;
the trace-length improvement alone does not establish length matching.

- [Base PNG](base-completed.png) / [SVG](base-completed.svg) / [exact routes and accepted output](base-routes.json)
- [Head PNG](head-completed.png) / [SVG](head-completed.svg) / [exact routes and accepted output](head-routes.json)
- [Fresh provenance and results](fresh-comparison.json)
- [Image inspection and independent hash review](artifact-review.json)

Fixture SHA-256: `f2000823bb4787fc9307f4674fe2d9a9320d0f9ba548c065add740e5b08f526c`.
The fresh report records runtime/platform, every solver TypeScript source hash,
native DRC dependency revision, validator source/options, and image/trace/output hashes.

Commands in the recorded workspace:

```sh
source /workspace/.tools/autorouter-env.sh
cd /workspace/bus-lanes-work
bun /workspace/ddr-results/quality-gallery/export-quality.ts
# Open both completed PNGs individually, then verify their recorded hashes:
bun /workspace/ddr-results/quality-gallery/verify-and-notes.ts
```

The exporter pins both revision IDs and verifies source hashes before and after
each fresh solve. It rejects incomplete or disconnected outputs and any native
DRC or canonical validation failure before rendering or writing any image.
Neither input nor copper is adjusted to produce these illustrations.
