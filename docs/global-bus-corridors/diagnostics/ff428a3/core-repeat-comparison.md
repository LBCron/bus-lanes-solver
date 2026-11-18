## Same Machine Benchmark Results

Both revisions ran sequentially on one machine.

Dataset: `core-ddr` · Scenarios: 2
Base: [`1a16da2`](https://github.com/tscircuit/core/commit/1a16da2f74fc2c80712d52abb17254dd2a80e2c5) · PR: [`1a16da2`](https://github.com/tscircuit/core/commit/1a16da2f74fc2c80712d52abb17254dd2a80e2c5)

| Solver | Metric | Base | PR | Delta |
| --- | --- | ---: | ---: | ---: |
| Core DDR | Completion | 50.0% (1/2) | 50.0% (1/2) | 0.0 pp |
| Core DDR | DRC pass | 50.0% (1/2) | 50.0% (1/2) | 0.0 pp |
| Core DDR | Connected nets | 82/125 | 82/125 | 0 |
| Core DDR | DRC issues | 0 | 0 | 0 |
| Core DDR | Failed | 0 | 0 | 0 |
| Core DDR | Timeouts | 1 | 1 | 0 |
| Core DDR | Crashes | 0 | 0 | 0 |
| Core DDR | P50 time | 111.9s | 119.4s | +6.7% |
| Core DDR | P60 time | 113.5s | 119.5s | +5.3% |
| Core DDR | P70 time | 115.1s | 119.7s | +3.9% |
| Core DDR | P80 time | 116.8s | 119.8s | +2.6% |
| Core DDR | P90 time | 118.4s | 119.9s | +1.3% |
| Core DDR | P95 time | 119.2s | 119.9s | +0.6% |
| Core DDR | Memory P50 | 1495.2 MiB | 1515.5 MiB | +1.4% |
| Core DDR | Memory P80 | 1664.7 MiB | 1697.3 MiB | +2.0% |
| Core DDR | Memory P90 | 1721.2 MiB | 1757.9 MiB | +2.1% |
| Core DDR | Average vias | 109.00 | 109.00 | 0.0% |
| Core DDR | Average wire length (mm) | 875.77 | 875.77 | 0.0% |

Outcome changes: **0 improved**, **0 regressed**.
Completion requires settled rendering, every routing phase completed and every requested net connected. DRC pass additionally requires clean physical checks and a native pad geometry audit. DRC issues are totaled across completed circuits.
Timing percentiles include all circuits, with failed and timed-out circuits counted at their configured 120s timeout; negative timing deltas are faster. Per-circuit details retain actual wall time. Average vias and wire length use 1 matched completed circuits. Memory percentiles use measured render-process peak RSS.

<details>
<summary>Base pipeline stage timings</summary>

**Core DDR**

Recorded timings: 2/2 circuits (1 partial, including failed or timed-out circuits).
Times are summed across circuits; percentages use total recorded phase time. Unfinished phases have no recorded end time and are excluded.

| Stage | Total time | % of stage time |
| --- | ---: | ---: |
| byte0 (BusLanesPipelineSolver) | 1.539s | 0.8% |
| byte1 (BusLanesPipelineSolver) | 2.175s | 1.1% |
| byte2 (BusLanesPipelineSolver) | 81.962s | 43.3% |
| byte3 (BusLanesPipelineSolver) | 7.268s | 3.8% |
| remaining (AutoroutingPipelineSolver9_PreloadedTraceGraph) | 96.411s | 50.9% |
| **Total** | **189.354s** | **100.0%** |

</details>

<details>
<summary>PR pipeline stage timings</summary>

**Core DDR**

Recorded timings: 2/2 circuits (1 partial, including failed or timed-out circuits).
Times are summed across circuits; percentages use total recorded phase time. Unfinished phases have no recorded end time and are excluded.

| Stage | Total time | % of stage time |
| --- | ---: | ---: |
| byte0 (BusLanesPipelineSolver) | 2.202s | 1.0% |
| byte1 (BusLanesPipelineSolver) | 2.524s | 1.2% |
| byte2 (BusLanesPipelineSolver) | 86.590s | 41.1% |
| byte3 (BusLanesPipelineSolver) | 8.609s | 4.1% |
| remaining (AutoroutingPipelineSolver9_PreloadedTraceGraph) | 110.546s | 52.5% |
| **Total** | **210.471s** | **100.0%** |

</details>

<details>
<summary>Per-circuit results (2)</summary>

| Circuit | Metric | Base | PR | Delta |
| --- | --- | ---: | ---: | ---: |
| OLIMEX A64-OLinuXino rev H | Outcome | Timeout | Timeout | — |
| OLIMEX A64-OLinuXino rev H | Connected nets | 32/75 | 32/75 | 0 |
| OLIMEX A64-OLinuXino rev H | Wall time | 120.1s | 120.1s | +0.0% |
| OLIMEX A64-OLinuXino rev H | Peak RSS | 1212.6 MiB | 1212.6 MiB | -0.0% |
| OLIMEX A64-OLinuXino rev H | Vias | 44 | 44 | 0 |
| OLIMEX A64-OLinuXino rev H | Wire length (mm) | 474.95 | 474.95 | 0.0% |
| OLIMEX A64-OLinuXino rev H | DRC issues | 0 | 0 | 0 |
| OLIMEX A64-OLinuXino rev H | Unfinished phase | remaining (AutoroutingPipelineSolver9_PreloadedTraceGraph) | remaining (AutoroutingPipelineSolver9_PreloadedTraceGraph) | — |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Outcome | DRC passed | DRC passed | — |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Connected nets | 50/50 | 50/50 | 0 |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Wall time | 103.8s | 118.8s | +14.5% |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Peak RSS | 1777.7 MiB | 1818.5 MiB | +2.3% |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Vias | 109 | 109 | 0 |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Wire length (mm) | 875.77 | 875.77 | 0.0% |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | DRC issues | 0 | 0 | 0 |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Unfinished phase | — | — | — |

</details>

<details>
<summary>Dependency versions</summary>

| Package | Base | PR |
| --- | --- | --- |
| @tscircuit/bus-lanes-solver | 0.0.62 | 0.0.62 |
| @tscircuit/capacity-autorouter | 0.0.1128 | 0.0.1128 |
| @tscircuit/fanout-solver | 0.0.86 | 0.0.86 |
| @tscircuit/checks | 0.0.280 | 0.0.280 |
| @tscircuit/props | 0.0.735 | 0.0.735 |
| circuit-json | 0.0.552 | 0.0.552 |

</details>

<details>
<summary>Runtime, provenance and scope</summary>

Bun 1.4.3 · linux x64 · AMD EPYC 7763 64-Core Processor · 120s render budget per circuit.
Benchmark render fingerprint: `sha256:07241d5c0af855ba5f7d0516d9cdbf62e00f0a048df8c7011165bcce697eb73c`.
Assessment fingerprint: `sha256:07241d5c0af855ba5f7d0516d9cdbf62e00f0a048df8c7011165bcce697eb73c`.

Each circuit runs in a fresh process. Validation runs separately from render timing. Completed stages retain copper in SRJ artifacts; if a later stage fails, Core may emit no final PCB traces. Connected-net counts refer to saved Circuit JSON.

The extracted DDR subsystem retains native component placement, all pads of selected components, source signal layers and routing rules. Existing copper is removed; irregular board edges use a bounding box and unsupported pad shapes use recorded approximations. Results do not establish DDR timing, skew, impedance or hardware qualification.

</details>
