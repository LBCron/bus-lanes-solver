# DDR corridor planning: review evidence

Final production source is `190325da97253ad7951f9dfd3b0046b4afcb5395`, compared
with main `202b034659fb96bad44d11b8190f4044b675116f`. This evidence branch adds
reports and reproduction scripts; its production solver files remain identical
to that final source. PR: [bus-lanes-solver #218](https://github.com/tscircuit/bus-lanes-solver/pull/218).

The implementation adds advisory global corridors after a first detailed sweep
detects contention. It retains ordinary candidates and active rip-up order,
allows backward/lateral detours, and accepts a guide candidate only as part of a
complete compatible assignment. Timed or paired requests bypass coarse planning.
A separate native-inner/unicast eligibility change reaches existing carrier
search sooner for untimed byte buses, while preserving surface and branch
activation rules.

## Final core and isolated-stage results

| Evidence | Main | Final head | Interpretation |
| --- | ---: | ---: | --- |
| Core DDR complete boards | 2/10 | 3/10 | Both main passes retained; no per-case connectivity decline. |
| Core connected requested nets | 270/606 | 304/606 | OrangeCrab accounts for the observed extra completion. |
| Core failures / timeouts / crashes | 1 / 7 / 0 | 1 / 6 / 0 | Seven head boards remain incomplete. |
| Native physical findings / geometry errors | 0 / 0 | 0 / 0 | Disconnected partial boards are still failures/timeouts. |
| A64 byte2 fresh isolated public solve | 56.744 s | 11.659 s | Same complete output; one serial pair, not a full-board speedup. |
| Three-barriers untimed bus-stage copper | 90.253362 mm | 87.396129 mm | 8/8 and native DRC pass; 3.166% less copper. |
| Three-barriers longest trace | 14.024012 mm | 13.324012 mm | 4.991% shorter; no matching tolerance declared. |

The ten-board comparison uses pinned core
`1a16da2f74fc2c80712d52abb17254dd2a80e2c5`, fixture package
`24dc44c166d4258c3538f8b1f66953f1b6f58690`, Bun 1.4.3, serial fresh workers,
120-second budgets, the same installed dependency tree and four-CPU/16-GiB
allocation. All 25 jointly completed byte phases have exactly equal start and
end SRJ values. Per-bus XY copper length and max−min skew are unchanged.

OrangeCrab also completed on an earlier main repeat. The observed 3/10 versus
2/10 result meets the baseline completion bar, but does not prove a deterministic
extra board completion. Full-board timing regressions include H3 45.46→69.76 s
and Glider 40.86→42.97 s. These runs do not establish a general runtime gain.

The isolated A64 pair uses the exact captured third-byte input, unchanged public
defaults, separate fresh processes, and independent 120-second external
watchdogs. Both complete output SRJs equal original main, all 16 fixed traces
are preserved, and native connectivity and DRC pass over all 24 traces. The
79.453% reduction applies to this untimed stage. The corridor-quality example
separately measures raw `negotiateLanes` output before optional corner cleanup;
it is not a full smoothed pipeline or length-matching result.

- [Full core comparison, every case/stage and limitations](core-comparison.md)
- [Machine-readable core comparison and phase hashes](core-comparison.json)
- [Identical completed-phase raw start/end SRJs, compressed once per phase](core-completed-phases)
- [Per-bus total copper length and skew](core-bus-copper-metrics.md)
- [Main raw results](core-main/results.json) and [provenance](core-main/provenance.json)
- [Final head raw results](core-head/results.json) and [provenance](core-head/provenance.json)
- [Installed dependency manifest inventory](core-installed-dependencies.json)
- [Fresh isolated A64 inputs, outputs, validation, timings and harness](a64-public-stage/README.md)
- [Fresh completed corridor example and individually inspected images](quality-gallery/README.md)

## Regression and AM3352 acceptance

Both final-head push and PR full test suites passed **623 tests, zero failures**.
Formatting, typecheck and package checks passed. Nine targeted tests across
eight files separately preserved A13/ButterStick snapshots, pending-pad access
and the A64 public default pipeline.

**All eleven fresh paired AM3352 samples pass on both revisions.** The required
`AM3352 benchmark (11/11)` acceptance check is green: 47/47 connections per
sample, full bus matching, fixed/combined DRC, all three pair skew/coupling
checks, and 161 supplied power traces/vias/pad joins preserved. Inputs, full
validation objects and iteration counts agree in all eleven pairs. No completion
is lost or gained. Each revision/sample retained its full 3,600-second budget.

Six single-pair runtime increases are recorded. P50 changes from 82.328 to
76.652 seconds (−6.9%), P80 355.006→343.864 (−3.1%), P90
1039.640→990.249 (−4.8%), and P95 1113.275→1076.125 (−3.3%). These are
eleven single pairs; no general runtime improvement is established. Every
per-case increase remains in the report.

- [Fresh paired Blacksmith workflow](https://github.com/tscircuit/bus-lanes-solver/actions/runs/44382576930)
- [Full paired AM3352 comparison and reproduction command](am3352/README.md)
- [All eleven pairs, measurements and every acceptance gate](am3352/progress.json)
- [Push full-suite counts](am3352/tests-push-summary.json)
- [PR full-suite counts](am3352/tests-pr-summary.json)
- [All eleven individually inspected, prior completed AM3352 reference images](am3352-reference-gallery/retained-reference-gallery.md)

The AM3352 reference images are retained outputs of older solver source
`ec82ec2442d6c03f680d3f9735b94877a3e83559`, not freshly rendered final-head
copper. Their original completed validation and image hashes are preserved.
Current fresh solves independently establish current acceptance; equal
measurements alone do not establish exact copper identity.

## Research, rejected approaches and scope

- [Engineering synthesis and design decisions](research-synthesis.md) distinguishes directly verified NXP/TI guidance, PCB/global-routing research, algorithmic inference, final behavior and future work.
- [Source-verification manifest](research-source-verification.json) records retrieved sources and verification limits.
- [Exploratory comparisons](diagnostics/README.md) retain superseded outcomes and the main OrangeCrab repeat.
- [Synthetic family diagnostics](synthetic/notes.md) include the 10/12→9/12 tight-budget regression, not only successful cases.
- [Rejected hard-batch experiment](diagnostics/batch-ff428a3/analysis.txt) used fewer fine expansions on two successes but added copper and did not complete the capacity-expanded 24/32 cases.

The planner bounds each coarse graph to 4,096 cells and four sweeps. Total work
and retained distance-field memory still grow with visible lane count; broad
scaling improvement has not been demonstrated. Coarse capacity is an estimate,
not a detailed-feasibility certificate.

Core exposes one eight-DQ byte per phase and freezes earlier bytes. Planning an
entire DDR channel needs future byte/strobe/mask requests and electrical
relationships exposed together. The core benchmark establishes routing and
native geometry, not DDR timing, impedance or signal-integrity compliance.

Only completed routing images are included or linked. Failed/intermediate
diagnostic images are excluded. Core and AM3352 comparisons both use final
production source `190325da97253ad7951f9dfd3b0046b4afcb5395`.
