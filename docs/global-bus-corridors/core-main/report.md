## Benchmark Results

Each circuit ran locally in a fresh process.

Dataset: `core-ddr` · Scenarios: 10
Commit: [`1a16da2`](https://github.com/tscircuit/core/commit/1a16da2f74fc2c80712d52abb17254dd2a80e2c5)

| Solver | Metric | Local |
| --- | --- | ---: |
| Core DDR | Completion | 20.0% (2/10) |
| Core DDR | DRC pass | 20.0% (2/10) |
| Core DDR | Connected nets | 270/606 |
| Core DDR | DRC issues | 0 |
| Core DDR | Failed | 1 |
| Core DDR | Timeouts | 7 |
| Core DDR | Crashes | 0 |
| Core DDR | P50 time | 120.0s |
| Core DDR | P60 time | 120.0s |
| Core DDR | P70 time | 120.0s |
| Core DDR | P80 time | 120.0s |
| Core DDR | P90 time | 120.0s |
| Core DDR | P95 time | 120.0s |
| Core DDR | Memory P50 | 1800.7 MiB |
| Core DDR | Memory P80 | 2130.5 MiB |
| Core DDR | Memory P90 | 2304.5 MiB |
| Core DDR | Average vias | 94.00 |
| Core DDR | Average wire length (mm) | 914.55 |

Completion requires settled rendering, every routing phase completed and every requested net connected. DRC pass additionally requires clean physical checks and a native pad geometry audit. DRC issues are totaled across completed circuits.
Timing percentiles include all circuits, with failed and timed-out circuits counted at their configured 120s timeout; negative timing deltas are faster. Per-circuit details retain actual wall time. Average vias and wire length use 2 completed circuits. Memory percentiles use measured render-process peak RSS.

<details>
<summary>Local pipeline stage timings</summary>

**Core DDR**

Recorded timings: 10/10 circuits (8 partial, including failed or timed-out circuits).
Times are summed across circuits; percentages use total recorded phase time. Unfinished phases have no recorded end time and are excluded.

| Stage | Total time | % of stage time |
| --- | ---: | ---: |
| byte0 (BusLanesPipelineSolver) | 31.213s | 8.2% |
| byte1 (BusLanesPipelineSolver) | 83.663s | 22.0% |
| byte2 (BusLanesPipelineSolver) | 95.188s | 25.0% |
| byte3 (BusLanesPipelineSolver) | 10.484s | 2.8% |
| ram_byte0 (BusLanesPipelineSolver) | 50.292s | 13.2% |
| remaining (AutoroutingPipelineSolver9_PreloadedTraceGraph) | 109.592s | 28.8% |
| **Total** | **380.434s** | **100.0%** |

</details>

<details>
<summary>Per-circuit results (10)</summary>

| Circuit | Metric | Local |
| --- | --- | ---: |
| Allwinner H3 DDR3 16x1 | Outcome | Failed |
| Allwinner H3 DDR3 16x1 | Connected nets | 16/53 |
| Allwinner H3 DDR3 16x1 | Wall time | 45.5s |
| Allwinner H3 DDR3 16x1 | Peak RSS | 1226.2 MiB |
| Allwinner H3 DDR3 16x1 | Vias | 14 |
| Allwinner H3 DDR3 16x1 | Wire length (mm) | 293.81 |
| Allwinner H3 DDR3 16x1 | DRC issues | 0 |
| Allwinner H3 DDR3 16x1 | Unfinished phase | remaining (AutoroutingPipelineSolver9_PreloadedTraceGraph) |
| OLIMEX A64-OLinuXino rev H | Outcome | Timeout |
| OLIMEX A64-OLinuXino rev H | Connected nets | 32/75 |
| OLIMEX A64-OLinuXino rev H | Wall time | 120.1s |
| OLIMEX A64-OLinuXino rev H | Peak RSS | 1070.2 MiB |
| OLIMEX A64-OLinuXino rev H | Vias | 44 |
| OLIMEX A64-OLinuXino rev H | Wire length (mm) | 474.95 |
| OLIMEX A64-OLinuXino rev H | DRC issues | 0 |
| OLIMEX A64-OLinuXino rev H | Unfinished phase | remaining (AutoroutingPipelineSolver9_PreloadedTraceGraph) |
| OLIMEX STMP157-OLinuXino-LIME2 rev B1 | Outcome | Timeout |
| OLIMEX STMP157-OLinuXino-LIME2 rev B1 | Connected nets | 32/72 |
| OLIMEX STMP157-OLinuXino-LIME2 rev B1 | Wall time | 120.2s |
| OLIMEX STMP157-OLinuXino-LIME2 rev B1 | Peak RSS | 2348.3 MiB |
| OLIMEX STMP157-OLinuXino-LIME2 rev B1 | Vias | 56 |
| OLIMEX STMP157-OLinuXino-LIME2 rev B1 | Wire length (mm) | 475.60 |
| OLIMEX STMP157-OLinuXino-LIME2 rev B1 | DRC issues | 0 |
| OLIMEX STMP157-OLinuXino-LIME2 rev B1 | Unfinished phase | remaining (AutoroutingPipelineSolver9_PreloadedTraceGraph) |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Outcome | Timeout |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Connected nets | 16/50 |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Wall time | 120.1s |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Peak RSS | 1845.0 MiB |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Vias | 32 |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Wire length (mm) | 204.40 |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | DRC issues | 0 |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Unfinished phase | remaining (AutoroutingPipelineSolver9_PreloadedTraceGraph) |
| Allwinner A13 SBC | Outcome | Timeout |
| Allwinner A13 SBC | Connected nets | 24/96 |
| Allwinner A13 SBC | Wall time | 120.1s |
| Allwinner A13 SBC | Peak RSS | 1144.1 MiB |
| Allwinner A13 SBC | Vias | 0 |
| Allwinner A13 SBC | Wire length (mm) | 219.60 |
| Allwinner A13 SBC | DRC issues | 0 |
| Allwinner A13 SBC | Unfinished phase | ram_byte1 (BusLanesPipelineSolver) |
| Allwinner H616 Devboard DDR3 | Outcome | DRC passed |
| Allwinner H616 Devboard DDR3 | Connected nets | 53/53 |
| Allwinner H616 Devboard DDR3 | Wall time | 83.6s |
| Allwinner H616 Devboard DDR3 | Peak RSS | 1756.4 MiB |
| Allwinner H616 Devboard DDR3 | Vias | 93 |
| Allwinner H616 Devboard DDR3 | Wire length (mm) | 659.45 |
| Allwinner H616 Devboard DDR3 | DRC issues | 0 |
| Allwinner H616 Devboard DDR3 | Unfinished phase | — |
| ButterStick r1.0 | Outcome | Timeout |
| ButterStick r1.0 | Connected nets | 16/55 |
| ButterStick r1.0 | Wall time | 120.2s |
| ButterStick r1.0 | Peak RSS | 2088.2 MiB |
| ButterStick r1.0 | Vias | 46 |
| ButterStick r1.0 | Wire length (mm) | 446.26 |
| ButterStick r1.0 | DRC issues | 0 |
| ButterStick r1.0 | Unfinished phase | remaining (AutoroutingPipelineSolver9_PreloadedTraceGraph) |
| Glider mainboard | Outcome | DRC passed |
| Glider mainboard | Connected nets | 49/49 |
| Glider mainboard | Wall time | 40.9s |
| Glider mainboard | Peak RSS | 1389.6 MiB |
| Glider mainboard | Vias | 95 |
| Glider mainboard | Wire length (mm) | 1169.64 |
| Glider mainboard | DRC issues | 0 |
| Glider mainboard | Unfinished phase | — |
| i.MX6 Demo Board | Outcome | Timeout |
| i.MX6 Demo Board | Connected nets | 16/53 |
| i.MX6 Demo Board | Wall time | 120.2s |
| i.MX6 Demo Board | Peak RSS | 1849.0 MiB |
| i.MX6 Demo Board | Vias | 30 |
| i.MX6 Demo Board | Wire length (mm) | 322.77 |
| i.MX6 Demo Board | DRC issues | 0 |
| i.MX6 Demo Board | Unfinished phase | remaining (AutoroutingPipelineSolver9_PreloadedTraceGraph) |
| iCE/Pi CM0 SBC | Outcome | Timeout |
| iCE/Pi CM0 SBC | Connected nets | 16/50 |
| iCE/Pi CM0 SBC | Wall time | 120.1s |
| iCE/Pi CM0 SBC | Peak RSS | 2299.7 MiB |
| iCE/Pi CM0 SBC | Vias | 32 |
| iCE/Pi CM0 SBC | Wire length (mm) | 194.36 |
| iCE/Pi CM0 SBC | DRC issues | 0 |
| iCE/Pi CM0 SBC | Unfinished phase | remaining (AutoroutingPipelineSolver9_PreloadedTraceGraph) |

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
