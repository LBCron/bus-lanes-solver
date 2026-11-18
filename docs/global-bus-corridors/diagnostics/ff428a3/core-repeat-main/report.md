## Benchmark Results

Each circuit ran locally in a fresh process.

Dataset: `core-ddr` · Scenarios: 2
Commit: [`1a16da2`](https://github.com/tscircuit/core/commit/1a16da2f74fc2c80712d52abb17254dd2a80e2c5)

| Solver | Metric | Local |
| --- | --- | ---: |
| Core DDR | Completion | 50.0% (1/2) |
| Core DDR | DRC pass | 50.0% (1/2) |
| Core DDR | Connected nets | 82/125 |
| Core DDR | DRC issues | 0 |
| Core DDR | Failed | 0 |
| Core DDR | Timeouts | 1 |
| Core DDR | Crashes | 0 |
| Core DDR | P50 time | 111.9s |
| Core DDR | P60 time | 113.5s |
| Core DDR | P70 time | 115.1s |
| Core DDR | P80 time | 116.8s |
| Core DDR | P90 time | 118.4s |
| Core DDR | P95 time | 119.2s |
| Core DDR | Memory P50 | 1495.2 MiB |
| Core DDR | Memory P80 | 1664.7 MiB |
| Core DDR | Memory P90 | 1721.2 MiB |
| Core DDR | Average vias | 109.00 |
| Core DDR | Average wire length (mm) | 875.77 |

Completion requires settled rendering, every routing phase completed and every requested net connected. DRC pass additionally requires clean physical checks and a native pad geometry audit. DRC issues are totaled across completed circuits.
Timing percentiles include all circuits, with failed and timed-out circuits counted at their configured 120s timeout; negative timing deltas are faster. Per-circuit details retain actual wall time. Average vias and wire length use 1 completed circuits. Memory percentiles use measured render-process peak RSS.

<details>
<summary>Local pipeline stage timings</summary>

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
<summary>Per-circuit results (2)</summary>

| Circuit | Metric | Local |
| --- | --- | ---: |
| OLIMEX A64-OLinuXino rev H | Outcome | Timeout |
| OLIMEX A64-OLinuXino rev H | Connected nets | 32/75 |
| OLIMEX A64-OLinuXino rev H | Wall time | 120.1s |
| OLIMEX A64-OLinuXino rev H | Peak RSS | 1212.6 MiB |
| OLIMEX A64-OLinuXino rev H | Vias | 44 |
| OLIMEX A64-OLinuXino rev H | Wire length (mm) | 474.95 |
| OLIMEX A64-OLinuXino rev H | DRC issues | 0 |
| OLIMEX A64-OLinuXino rev H | Unfinished phase | remaining (AutoroutingPipelineSolver9_PreloadedTraceGraph) |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Outcome | DRC passed |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Connected nets | 50/50 |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Wall time | 103.8s |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Peak RSS | 1777.7 MiB |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Vias | 109 |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Wire length (mm) | 875.77 |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | DRC issues | 0 |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Unfinished phase | — |

</details>

<details>
<summary>Dependency versions</summary>

| Package | Local |
| --- | --- |
| @tscircuit/bus-lanes-solver | 0.0.62 |
| @tscircuit/capacity-autorouter | 0.0.1128 |
| @tscircuit/fanout-solver | 0.0.86 |
| @tscircuit/checks | 0.0.280 |
| @tscircuit/props | 0.0.735 |
| circuit-json | 0.0.552 |

</details>

<details>
<summary>Runtime, provenance and scope</summary>

Bun 1.4.3 · linux x64 · AMD EPYC 7763 64-Core Processor · 120s render budget per circuit.
Benchmark render fingerprint: `sha256:07241d5c0af855ba5f7d0516d9cdbf62e00f0a048df8c7011165bcce697eb73c`.
Assessment fingerprint: `sha256:07241d5c0af855ba5f7d0516d9cdbf62e00f0a048df8c7011165bcce697eb73c`.

Each circuit runs in a fresh process. Validation runs separately from render timing. Completed stages retain copper in SRJ artifacts; if a later stage fails, Core may emit no final PCB traces. Connected-net counts refer to saved Circuit JSON.

The extracted DDR subsystem retains native component placement, all pads of selected components, source signal layers and routing rules. Existing copper is removed; irregular board edges use a bounding box and unsupported pad shapes use recorded approximations. Results do not establish DDR timing, skew, impedance or hardware qualification.

</details>
