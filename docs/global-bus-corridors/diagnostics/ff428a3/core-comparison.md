## Same Machine Benchmark Results

Both revisions ran sequentially on one machine.

Dataset: `core-ddr` · Scenarios: 10
Base: [`1a16da2`](https://github.com/tscircuit/core/commit/1a16da2f74fc2c80712d52abb17254dd2a80e2c5) · PR: [`1a16da2`](https://github.com/tscircuit/core/commit/1a16da2f74fc2c80712d52abb17254dd2a80e2c5)

| Solver | Metric | Base | PR | Delta |
| --- | --- | ---: | ---: | ---: |
| Core DDR | Completion | 20.0% (2/10) | 30.0% (3/10) | +10.0 pp |
| Core DDR | DRC pass | 20.0% (2/10) | 30.0% (3/10) | +10.0 pp |
| Core DDR | Connected nets | 270/606 | 296/606 | +26 |
| Core DDR | DRC issues | 0 | 0 | 0 |
| Core DDR | Failed | 1 | 1 | 0 |
| Core DDR | Timeouts | 7 | 6 | -1 |
| Core DDR | Crashes | 0 | 0 | 0 |
| Core DDR | P50 time | 120.0s | 120.0s | 0.0% |
| Core DDR | P60 time | 120.0s | 120.0s | 0.0% |
| Core DDR | P70 time | 120.0s | 120.0s | 0.0% |
| Core DDR | P80 time | 120.0s | 120.0s | 0.0% |
| Core DDR | P90 time | 120.0s | 120.0s | 0.0% |
| Core DDR | P95 time | 120.0s | 120.0s | 0.0% |
| Core DDR | Memory P50 | 1800.7 MiB | 1590.0 MiB | -11.7% |
| Core DDR | Memory P80 | 2130.5 MiB | 1815.5 MiB | -14.8% |
| Core DDR | Memory P90 | 2304.5 MiB | 1917.5 MiB | -16.8% |
| Core DDR | Average vias | 94.00 | 94.00 | 0.0% |
| Core DDR | Average wire length (mm) | 914.55 | 914.55 | 0.0% |

Outcome changes: **1 improved**, **0 regressed**.
Completion requires settled rendering, every routing phase completed and every requested net connected. DRC pass additionally requires clean physical checks and a native pad geometry audit. DRC issues are totaled across completed circuits.
Timing percentiles include all circuits, with failed and timed-out circuits counted at their configured 120s timeout; negative timing deltas are faster. Per-circuit details retain actual wall time. Average vias and wire length use 2 matched completed circuits. Memory percentiles use measured render-process peak RSS.

<details>
<summary>Base pipeline stage timings</summary>

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
<summary>PR pipeline stage timings</summary>

**Core DDR**

Recorded timings: 10/10 circuits (7 partial, including failed or timed-out circuits).
Times are summed across circuits; percentages use total recorded phase time. Unfinished phases have no recorded end time and are excluded.

| Stage | Total time | % of stage time |
| --- | ---: | ---: |
| byte0 (BusLanesPipelineSolver) | 28.314s | 5.6% |
| byte1 (BusLanesPipelineSolver) | 84.721s | 16.9% |
| byte2 (BusLanesPipelineSolver) | 106.865s | 21.3% |
| byte3 (BusLanesPipelineSolver) | 1.829s | 0.4% |
| ram_byte0 (BusLanesPipelineSolver) | 44.771s | 8.9% |
| remaining (AutoroutingPipelineSolver9_PreloadedTraceGraph) | 234.981s | 46.9% |
| **Total** | **501.480s** | **100.0%** |

</details>

<details>
<summary>Changed outcomes (1)</summary>

| Solver | Circuit | Base | PR | Base time | PR time | Delta |
| --- | --- | --- | --- | ---: | ---: | --- |
| Core DDR | OrangeCrab rev 0.2.1 ECP5 DDR3 | Timeout | DRC passed | 120.1s | 110.7s | Improved |

</details>

<details>
<summary>Per-circuit results (10)</summary>

| Circuit | Metric | Base | PR | Delta |
| --- | --- | ---: | ---: | ---: |
| Allwinner H3 DDR3 16x1 | Outcome | Failed | Failed | — |
| Allwinner H3 DDR3 16x1 | Connected nets | 16/53 | 16/53 | 0 |
| Allwinner H3 DDR3 16x1 | Wall time | 45.5s | 51.0s | +12.1% |
| Allwinner H3 DDR3 16x1 | Peak RSS | 1226.2 MiB | 1186.9 MiB | -3.2% |
| Allwinner H3 DDR3 16x1 | Vias | 14 | 14 | 0 |
| Allwinner H3 DDR3 16x1 | Wire length (mm) | 293.81 | 293.81 | 0.0% |
| Allwinner H3 DDR3 16x1 | DRC issues | 0 | 0 | 0 |
| Allwinner H3 DDR3 16x1 | Unfinished phase | remaining (AutoroutingPipelineSolver9_PreloadedTraceGraph) | remaining (AutoroutingPipelineSolver9_PreloadedTraceGraph) | — |
| OLIMEX A64-OLinuXino rev H | Outcome | Timeout | Timeout | — |
| OLIMEX A64-OLinuXino rev H | Connected nets | 32/75 | 24/75 | -8 |
| OLIMEX A64-OLinuXino rev H | Wall time | 120.1s | 120.1s | +0.0% |
| OLIMEX A64-OLinuXino rev H | Peak RSS | 1070.2 MiB | 1097.5 MiB | +2.6% |
| OLIMEX A64-OLinuXino rev H | Vias | 44 | 30 | -14 |
| OLIMEX A64-OLinuXino rev H | Wire length (mm) | 474.95 | 410.15 | -13.6% |
| OLIMEX A64-OLinuXino rev H | DRC issues | 0 | 0 | 0 |
| OLIMEX A64-OLinuXino rev H | Unfinished phase | remaining (AutoroutingPipelineSolver9_PreloadedTraceGraph) | byte3 (BusLanesPipelineSolver) | — |
| OLIMEX STMP157-OLinuXino-LIME2 rev B1 | Outcome | Timeout | Timeout | — |
| OLIMEX STMP157-OLinuXino-LIME2 rev B1 | Connected nets | 32/72 | 32/72 | 0 |
| OLIMEX STMP157-OLinuXino-LIME2 rev B1 | Wall time | 120.2s | 120.2s | +0.0% |
| OLIMEX STMP157-OLinuXino-LIME2 rev B1 | Peak RSS | 2348.3 MiB | 1541.1 MiB | -34.4% |
| OLIMEX STMP157-OLinuXino-LIME2 rev B1 | Vias | 56 | 56 | 0 |
| OLIMEX STMP157-OLinuXino-LIME2 rev B1 | Wire length (mm) | 475.60 | 475.60 | 0.0% |
| OLIMEX STMP157-OLinuXino-LIME2 rev B1 | DRC issues | 0 | 0 | 0 |
| OLIMEX STMP157-OLinuXino-LIME2 rev B1 | Unfinished phase | remaining (AutoroutingPipelineSolver9_PreloadedTraceGraph) | remaining (AutoroutingPipelineSolver9_PreloadedTraceGraph) | — |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Outcome | Timeout | DRC passed | Improved |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Connected nets | 16/50 | 50/50 | +34 |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Wall time | 120.1s | 110.7s | -7.9% |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Peak RSS | 1845.0 MiB | 1797.8 MiB | -2.6% |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Vias | 32 | 109 | +77 |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Wire length (mm) | 204.40 | 875.77 | +328.5% |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | DRC issues | 0 | 0 | 0 |
| OrangeCrab rev 0.2.1 ECP5 DDR3 | Unfinished phase | remaining (AutoroutingPipelineSolver9_PreloadedTraceGraph) | — | — |
| Allwinner A13 SBC | Outcome | Timeout | Timeout | — |
| Allwinner A13 SBC | Connected nets | 24/96 | 24/96 | 0 |
| Allwinner A13 SBC | Wall time | 120.1s | 120.3s | +0.2% |
| Allwinner A13 SBC | Peak RSS | 1144.1 MiB | 1152.2 MiB | +0.7% |
| Allwinner A13 SBC | Vias | 0 | 0 | 0 |
| Allwinner A13 SBC | Wire length (mm) | 219.60 | 219.60 | 0.0% |
| Allwinner A13 SBC | DRC issues | 0 | 0 | 0 |
| Allwinner A13 SBC | Unfinished phase | ram_byte1 (BusLanesPipelineSolver) | ram_byte1 (BusLanesPipelineSolver) | — |
| Allwinner H616 Devboard DDR3 | Outcome | DRC passed | DRC passed | — |
| Allwinner H616 Devboard DDR3 | Connected nets | 53/53 | 53/53 | 0 |
| Allwinner H616 Devboard DDR3 | Wall time | 83.6s | 90.8s | +8.6% |
| Allwinner H616 Devboard DDR3 | Peak RSS | 1756.4 MiB | 1639.0 MiB | -6.7% |
| Allwinner H616 Devboard DDR3 | Vias | 93 | 93 | 0 |
| Allwinner H616 Devboard DDR3 | Wire length (mm) | 659.45 | 659.45 | 0.0% |
| Allwinner H616 Devboard DDR3 | DRC issues | 0 | 0 | 0 |
| Allwinner H616 Devboard DDR3 | Unfinished phase | — | — | — |
| ButterStick r1.0 | Outcome | Timeout | Timeout | — |
| ButterStick r1.0 | Connected nets | 16/55 | 16/55 | 0 |
| ButterStick r1.0 | Wall time | 120.2s | 120.2s | +0.0% |
| ButterStick r1.0 | Peak RSS | 2088.2 MiB | 2196.4 MiB | +5.2% |
| ButterStick r1.0 | Vias | 46 | 46 | 0 |
| ButterStick r1.0 | Wire length (mm) | 446.26 | 446.26 | 0.0% |
| ButterStick r1.0 | DRC issues | 0 | 0 | 0 |
| ButterStick r1.0 | Unfinished phase | remaining (AutoroutingPipelineSolver9_PreloadedTraceGraph) | remaining (AutoroutingPipelineSolver9_PreloadedTraceGraph) | — |
| Glider mainboard | Outcome | DRC passed | DRC passed | — |
| Glider mainboard | Connected nets | 49/49 | 49/49 | 0 |
| Glider mainboard | Wall time | 40.9s | 52.8s | +29.2% |
| Glider mainboard | Peak RSS | 1389.6 MiB | 1447.8 MiB | +4.2% |
| Glider mainboard | Vias | 95 | 95 | 0 |
| Glider mainboard | Wire length (mm) | 1169.64 | 1169.64 | 0.0% |
| Glider mainboard | DRC issues | 0 | 0 | 0 |
| Glider mainboard | Unfinished phase | — | — | — |
| i.MX6 Demo Board | Outcome | Timeout | Timeout | — |
| i.MX6 Demo Board | Connected nets | 16/53 | 16/53 | 0 |
| i.MX6 Demo Board | Wall time | 120.2s | 120.2s | -0.0% |
| i.MX6 Demo Board | Peak RSS | 1849.0 MiB | 1886.5 MiB | +2.0% |
| i.MX6 Demo Board | Vias | 30 | 30 | 0 |
| i.MX6 Demo Board | Wire length (mm) | 322.77 | 322.77 | 0.0% |
| i.MX6 Demo Board | DRC issues | 0 | 0 | 0 |
| i.MX6 Demo Board | Unfinished phase | remaining (AutoroutingPipelineSolver9_PreloadedTraceGraph) | remaining (AutoroutingPipelineSolver9_PreloadedTraceGraph) | — |
| iCE/Pi CM0 SBC | Outcome | Timeout | Timeout | — |
| iCE/Pi CM0 SBC | Connected nets | 16/50 | 16/50 | 0 |
| iCE/Pi CM0 SBC | Wall time | 120.1s | 120.1s | +0.0% |
| iCE/Pi CM0 SBC | Peak RSS | 2299.7 MiB | 1657.7 MiB | -27.9% |
| iCE/Pi CM0 SBC | Vias | 32 | 32 | 0 |
| iCE/Pi CM0 SBC | Wire length (mm) | 194.36 | 194.36 | 0.0% |
| iCE/Pi CM0 SBC | DRC issues | 0 | 0 | 0 |
| iCE/Pi CM0 SBC | Unfinished phase | remaining (AutoroutingPipelineSolver9_PreloadedTraceGraph) | remaining (AutoroutingPipelineSolver9_PreloadedTraceGraph) | — |

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
