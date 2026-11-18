# Fresh AM3352 comparison: fix

Pinned base `2af1bd6f4f7481a10afcf9c475f9b7dfe92f9e95`; head `358604c0e7f8bee42d0aef488807239c322198c6`. All **11/11** fresh paired samples are accepted on both references, with no failures, timeouts, lost or gained completions. Every case connects 47/47 signals and passes full matching, fixed/combined DRC, all three pair skew/coupling checks and immutable fixed 161 power traces/vias/pad joins. Full validation objects and iteration counts match in all 11 pairs; measurement equality alone does not prove exact routed-copper identity.

Each sample uses the same Blacksmith 4-vCPU worker for serial base/head solves, Bun 1.4.0, Linux x64, the pinned-base fixture/harness and a 3,600-second per-ref/sample budget. Order alternates by sample.

| Sample | Base solve(s) | Head solve(s) | Change |
| --- | ---: | ---: | ---: |
| [control](control/control.json) | 53.771 | 42.658 | -20.67% |
| [control-inner1](control-inner1/control-inner1.json) | 1173.238 | 1644.605 | +40.18% |
| [right](right/right.json) | 24.873 | 29.372 | +18.09% |
| [left](left/left.json) | 53.807 | 58.333 | +8.41% |
| [above](above/above.json) | 44.327 | 45.365 | +2.34% |
| [inner-layers](inner-layers/inner-layers.json) | 51.322 | 47.591 | -7.27% |
| [inner-layers-right](inner-layers-right/inner-layers-right.json) | 72.735 | 105.197 | +44.63% |
| [inner-layers-left](inner-layers-left/inner-layers-left.json) | 216.224 | 271.897 | +25.75% |
| [inner-layers-above](inner-layers-above/inner-layers-above.json) | 276.018 | 300.266 | +8.78% |
| [inner-layers-complete-ca](inner-layers-complete-ca/inner-layers-complete-ca.json) | 269.216 | 262.657 | -2.44% |
| [outer-layers](outer-layers/outer-layers.json) | 944.996 | 1007.068 | +6.57% |

Measured increases: `control-inner1` (+40.18%), `right` (+18.09%), `left` (+8.41%), `above` (+2.34%), `inner-layers-right` (+44.63%), `inner-layers-left` (+25.75%), `inner-layers-above` (+8.78%), `outer-layers` (+6.57%). Every increase is retained. These are single-pair observations, not repeated statistical speed evidence.

Eight of eleven cases are slower in this pair. P50 changes 72.735→105.197seconds(+44.63%), P80 276.018→300.266(+8.78%), P90 944.996→1007.068(+6.57%), and P95 1059.117→1325.836(+25.18%). No general runtime improvement is claimed.

- [Trusted complete comparison, including every bus/pair skew and tolerance](comparison.md)
- [Raw-derived acceptance gates and pins](progress.json)
- [Machine-readable trusted summary](summary.json)
- [Provenance and hosted-report hash comparison](provenance.json)

Exact reproduction uses the pinned base `.github/workflows/am3352-benchmark.yml` and `scripts/pr-benchmark/run-pair.ts`, with `--timeout-seconds 3600`, `--main-sha`/`--controller-sha` set to the base pin above and `--pr-sha` to the head. The workflow installs each checkout from its frozen lockfile and runs every canonical sample. The hosted CI report and this local trusted report are checked byte-identical; raw artifacts remain linked in provenance.
- [Independent cross-audit](independent-audit-repro-agent.txt)
