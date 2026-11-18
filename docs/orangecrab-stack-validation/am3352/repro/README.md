# Fresh AM3352 comparison: repro

Pinned base `202b034659fb96bad44d11b8190f4044b675116f`; head `2af1bd6f4f7481a10afcf9c475f9b7dfe92f9e95`. All **11/11** fresh paired samples are accepted on both references, with no failures, timeouts, lost or gained completions. Every case connects 47/47 signals and passes full matching, fixed/combined DRC, all three pair skew/coupling checks and immutable fixed 161 power traces/vias/pad joins. Full validation objects and iteration counts match in all 11 pairs; measurement equality alone does not prove exact routed-copper identity.

Each sample uses the same Blacksmith 4-vCPU worker for serial base/head solves, Bun 1.4.0, Linux x64, the pinned-base fixture/harness and a 3,600-second per-ref/sample budget. Order alternates by sample.

| Sample | Base solve(s) | Head solve(s) | Change |
| --- | ---: | ---: | ---: |
| [control](control/control.json) | 42.118 | 40.076 | -4.85% |
| [control-inner1](control-inner1/control-inner1.json) | 1128.687 | 1563.989 | +38.57% |
| [right](right/right.json) | 23.008 | 22.664 | -1.49% |
| [left](left/left.json) | 43.216 | 50.996 | +18.00% |
| [above](above/above.json) | 50.863 | 57.472 | +12.99% |
| [inner-layers](inner-layers/inner-layers.json) | 60.583 | 46.553 | -23.16% |
| [inner-layers-right](inner-layers-right/inner-layers-right.json) | 69.902 | 84.189 | +20.44% |
| [inner-layers-left](inner-layers-left/inner-layers-left.json) | 285.946 | 279.226 | -2.35% |
| [inner-layers-above](inner-layers-above/inner-layers-above.json) | 293.692 | 396.691 | +35.07% |
| [inner-layers-complete-ca](inner-layers-complete-ca/inner-layers-complete-ca.json) | 261.157 | 278.679 | +6.71% |
| [outer-layers](outer-layers/outer-layers.json) | 1171.661 | 1009.592 | -13.83% |

Measured increases: `control-inner1` (+38.57%), `left` (+18.00%), `above` (+12.99%), `inner-layers-right` (+20.44%), `inner-layers-above` (+35.07%), `inner-layers-complete-ca` (+6.71%). Every increase is retained. These are single-pair observations, not repeated statistical speed evidence.

The source solver code is identical between main and this repro. Its measured per-case timing changes range from −23.16% to +38.57%; this is descriptive variance context and does not dismiss timing increases in the solver fix.

- [Trusted complete comparison, including every bus/pair skew and tolerance](comparison.md)
- [Raw-derived acceptance gates and pins](progress.json)
- [Machine-readable trusted summary](summary.json)
- [Provenance and hosted-report hash comparison](provenance.json)
- [Independent final audit](independent-audit-final-ci.json)
- [Timing range](timing-range.json)

Exact reproduction uses the pinned base `.github/workflows/am3352-benchmark.yml` and `scripts/pr-benchmark/run-pair.ts`, with `--timeout-seconds 3600`, `--main-sha`/`--controller-sha` set to the base pin above and `--pr-sha` to the head. The workflow installs each checkout from its frozen lockfile and runs every canonical sample. The hosted CI report and this local trusted report are checked byte-identical; raw artifacts remain linked in provenance.
