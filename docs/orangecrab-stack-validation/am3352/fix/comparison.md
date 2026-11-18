AM3352 benchmark for PR #218 · [workflow artifacts](https://github.com/tscircuit/bus-lanes-solver/actions/runs/44400918145)

Main: `2af1bd6f4f7481a10afcf9c475f9b7dfe92f9e95` · PR: `358604c0e7f8bee42d0aef488807239c322198c6` · timeout budget: 3600 s per sample.

Controller: `2af1bd6f4f7481a10afcf9c475f9b7dfe92f9e95`.

Lost completions (main accepted, PR not accepted): none. Gained completions: none.

**Budgeted time to valid completion — all 11 canonical samples**

Acceptance requires solving strictly before the timeout budget. An accepted sample contributes min(actual solve time, timeout budget). Every failure, timeout, crash, missing artifact, or invalid result contributes the full budget. These are completion-aware budgeted values, not percentiles of actual elapsed durations.

| Metric | Main | PR | Change |
| --- | ---: | ---: | ---: |
| Completion | 11/11 (100.0%) | 11/11 (100.0%) | 0.0 pp |
| Timeouts | 0 | 0 | 0 |
| Other failures | 0 | 0 | 0 |
| P50 time | 72.735 s | 105.197 s | +44.6% |
| P80 time | 276.018 s | 300.266 s | +8.8% |
| P90 time | 944.996 s | 1007.068 s | +6.6% |
| P95 time | 1059.117 s | 1325.836 s | +25.2% |

Completion changes are percentage points (pp); timing changes are relative percentages, with negative values faster. Other failures include crashes, invalid results, and missing artifacts.

**Actual solve time on the same 11 samples accepted on both revisions**

| Metric | Main | PR | Change |
| --- | ---: | ---: | ---: |
| P50 time | 72.735 s | 105.197 s | +44.6% |
| P80 time | 276.018 s | 300.266 s | +8.8% |
| P90 time | 944.996 s | 1007.068 s | +6.6% |
| P95 time | 1059.117 s | 1325.836 s | +25.2% |

Percentiles use linear interpolation at (n − 1) × p. A PR change has no percentage when the main value is zero.

| Sample | Main status / actual elapsed | PR status / actual elapsed | Completion |
| --- | --- | --- | --- |
| control | accepted (47/47 signals; DRC passed) · solve 53.771 s · wall 55.991 s | accepted (47/47 signals; DRC passed) · solve 42.658 s · wall 44.588 s | both accepted |
| control-inner1 | accepted (47/47 signals; DRC passed) · solve 1173.238 s · wall 1175.870 s | accepted (47/47 signals; DRC passed) · solve 1644.605 s · wall 1648.081 s | both accepted |
| right | accepted (47/47 signals; DRC passed) · solve 24.873 s · wall 27.198 s | accepted (47/47 signals; DRC passed) · solve 29.372 s · wall 31.469 s | both accepted |
| left | accepted (47/47 signals; DRC passed) · solve 53.807 s · wall 57.813 s | accepted (47/47 signals; DRC passed) · solve 58.333 s · wall 63.863 s | both accepted |
| above | accepted (47/47 signals; DRC passed) · solve 44.327 s · wall 48.375 s | accepted (47/47 signals; DRC passed) · solve 45.365 s · wall 48.076 s | both accepted |
| inner-layers | accepted (47/47 signals; DRC passed) · solve 51.322 s · wall 53.078 s | accepted (47/47 signals; DRC passed) · solve 47.591 s · wall 49.281 s | both accepted |
| inner-layers-right | accepted (47/47 signals; DRC passed) · solve 72.735 s · wall 74.848 s | accepted (47/47 signals; DRC passed) · solve 105.197 s · wall 107.709 s | both accepted |
| inner-layers-left | accepted (47/47 signals; DRC passed) · solve 216.224 s · wall 220.065 s | accepted (47/47 signals; DRC passed) · solve 271.897 s · wall 275.694 s | both accepted |
| inner-layers-above | accepted (47/47 signals; DRC passed) · solve 276.018 s · wall 279.620 s | accepted (47/47 signals; DRC passed) · solve 300.266 s · wall 303.162 s | both accepted |
| inner-layers-complete-ca | accepted (47/47 signals; DRC passed) · solve 269.216 s · wall 279.211 s | accepted (47/47 signals; DRC passed) · solve 262.657 s · wall 271.330 s | both accepted |
| outer-layers | accepted (47/47 signals; DRC passed) · solve 944.996 s · wall 949.688 s | accepted (47/47 signals; DRC passed) · solve 1007.068 s · wall 1010.802 s | both accepted |

**Accepted total-copper bus and differential-pair skews (skew / tolerance, mm)**

| Sample | Main buses | PR buses | Main pairs | PR pairs |
| --- | --- | --- | --- | --- |
| control | DDR&#95;BYTE0: 0.6350 / 0.6350<br>DDR&#95;BYTE1: 0.6350 / 0.6350 | DDR&#95;BYTE0: 0.6350 / 0.6350<br>DDR&#95;BYTE1: 0.6350 / 0.6350 | pair&#95;0: 0.0779 / 0.1270<br>pair&#95;1: 0.1269 / 0.1270<br>pair&#95;2: 0.0728 / 0.1270 | pair&#95;0: 0.0779 / 0.1270<br>pair&#95;1: 0.1269 / 0.1270<br>pair&#95;2: 0.0728 / 0.1270 |
| control-inner1 | DDR&#95;BYTE0: 0.6350 / 0.6350<br>DDR&#95;BYTE1: 0.6350 / 0.6350 | DDR&#95;BYTE0: 0.6350 / 0.6350<br>DDR&#95;BYTE1: 0.6350 / 0.6350 | pair&#95;0: 0.0489 / 0.1270<br>pair&#95;1: 0.0047 / 0.1270<br>pair&#95;2: 0.0302 / 0.1270 | pair&#95;0: 0.0489 / 0.1270<br>pair&#95;1: 0.0047 / 0.1270<br>pair&#95;2: 0.0302 / 0.1270 |
| right | DDR&#95;BYTE0: 0.6350 / 0.6350<br>DDR&#95;BYTE1: 0.6350 / 0.6350 | DDR&#95;BYTE0: 0.6350 / 0.6350<br>DDR&#95;BYTE1: 0.6350 / 0.6350 | pair&#95;0: 0.0960 / 0.1270<br>pair&#95;1: 0.1218 / 0.1270<br>pair&#95;2: 0.1026 / 0.1270 | pair&#95;0: 0.0960 / 0.1270<br>pair&#95;1: 0.1218 / 0.1270<br>pair&#95;2: 0.1026 / 0.1270 |
| left | DDR&#95;BYTE0: 0.6350 / 0.6350<br>DDR&#95;BYTE1: 0.5111 / 0.6350 | DDR&#95;BYTE0: 0.6350 / 0.6350<br>DDR&#95;BYTE1: 0.5111 / 0.6350 | pair&#95;0: 0.0105 / 0.1270<br>pair&#95;1: 0.1270 / 0.1270<br>pair&#95;2: 0.1054 / 0.1270 | pair&#95;0: 0.0105 / 0.1270<br>pair&#95;1: 0.1270 / 0.1270<br>pair&#95;2: 0.1054 / 0.1270 |
| above | DDR&#95;BYTE0: 0.6350 / 0.6350<br>DDR&#95;BYTE1: 0.6350 / 0.6350 | DDR&#95;BYTE0: 0.6350 / 0.6350<br>DDR&#95;BYTE1: 0.6350 / 0.6350 | pair&#95;0: 0.1270 / 0.1270<br>pair&#95;1: 0.1270 / 0.1270<br>pair&#95;2: 0.1270 / 0.1270 | pair&#95;0: 0.1270 / 0.1270<br>pair&#95;1: 0.1270 / 0.1270<br>pair&#95;2: 0.1270 / 0.1270 |
| inner-layers | DDR&#95;BYTE0: 0.6350 / 0.6350<br>DDR&#95;BYTE1: 0.6350 / 0.6350 | DDR&#95;BYTE0: 0.6350 / 0.6350<br>DDR&#95;BYTE1: 0.6350 / 0.6350 | pair&#95;0: 0.0779 / 0.1270<br>pair&#95;1: 0.1269 / 0.1270<br>pair&#95;2: 0.1270 / 0.1270 | pair&#95;0: 0.0779 / 0.1270<br>pair&#95;1: 0.1269 / 0.1270<br>pair&#95;2: 0.1270 / 0.1270 |
| inner-layers-right | DDR&#95;BYTE0: 0.6350 / 0.6350<br>DDR&#95;BYTE1: 0.6350 / 0.6350 | DDR&#95;BYTE0: 0.6350 / 0.6350<br>DDR&#95;BYTE1: 0.6350 / 0.6350 | pair&#95;0: 0.1270 / 0.1270<br>pair&#95;1: 0.1270 / 0.1270<br>pair&#95;2: 0.1270 / 0.1270 | pair&#95;0: 0.1270 / 0.1270<br>pair&#95;1: 0.1270 / 0.1270<br>pair&#95;2: 0.1270 / 0.1270 |
| inner-layers-left | DDR&#95;BYTE0: 0.6350 / 0.6350<br>DDR&#95;BYTE1: 0.6350 / 0.6350 | DDR&#95;BYTE0: 0.6350 / 0.6350<br>DDR&#95;BYTE1: 0.6350 / 0.6350 | pair&#95;0: 0.1270 / 0.1270<br>pair&#95;1: 0.0000 / 0.1270<br>pair&#95;2: 0.1054 / 0.1270 | pair&#95;0: 0.1270 / 0.1270<br>pair&#95;1: 0.0000 / 0.1270<br>pair&#95;2: 0.1054 / 0.1270 |
| inner-layers-above | DDR&#95;BYTE0: 0.6350 / 0.6350<br>DDR&#95;BYTE1: 0.6350 / 0.6350 | DDR&#95;BYTE0: 0.6350 / 0.6350<br>DDR&#95;BYTE1: 0.6350 / 0.6350 | pair&#95;0: 0.1269 / 0.1270<br>pair&#95;1: 0.1270 / 0.1270<br>pair&#95;2: 0.0000 / 0.1270 | pair&#95;0: 0.1269 / 0.1270<br>pair&#95;1: 0.1270 / 0.1270<br>pair&#95;2: 0.0000 / 0.1270 |
| inner-layers-complete-ca | DDR&#95;BYTE0: 0.6350 / 0.6350<br>DDR&#95;BYTE1: 0.6350 / 0.6350<br>DDR&#95;ADDR&#95;CTRL&#95;CK: 0.6350 / 0.6350 | DDR&#95;BYTE0: 0.6350 / 0.6350<br>DDR&#95;BYTE1: 0.6350 / 0.6350<br>DDR&#95;ADDR&#95;CTRL&#95;CK: 0.6350 / 0.6350 | pair&#95;0: 0.0754 / 0.1270<br>pair&#95;1: 0.0000 / 0.1270<br>pair&#95;2: 0.0664 / 0.1270 | pair&#95;0: 0.0754 / 0.1270<br>pair&#95;1: 0.0000 / 0.1270<br>pair&#95;2: 0.0664 / 0.1270 |
| outer-layers | DDR&#95;BYTE0: 0.6350 / 0.6350<br>DDR&#95;BYTE1: 0.6350 / 0.6350 | DDR&#95;BYTE0: 0.6350 / 0.6350<br>DDR&#95;BYTE1: 0.6350 / 0.6350 | pair&#95;0: 0.0192 / 0.1270<br>pair&#95;1: 0.1270 / 0.1270<br>pair&#95;2: 0.1270 / 0.1270 | pair&#95;0: 0.0192 / 0.1270<br>pair&#95;1: 0.1270 / 0.1270<br>pair&#95;2: 0.1270 / 0.1270 |

<details><summary>Fixture input SHA-256 hashes</summary>

| Sample | Main input | PR input |
| --- | --- | --- |
| control | b7a4e9d09a22fe0ed131a544548b14eef20fbf4e88b6dc6ffaa11ca44e6bfe59 | b7a4e9d09a22fe0ed131a544548b14eef20fbf4e88b6dc6ffaa11ca44e6bfe59 |
| control-inner1 | 14b5b318540ce7bac367cf22338abd7f9fffd2f7ce6c2a12f903116f50ca9bde | 14b5b318540ce7bac367cf22338abd7f9fffd2f7ce6c2a12f903116f50ca9bde |
| right | 78c22c8d818ee2c2abe2eec9c6b6e408161a9d0eaf09afbafc3242e71e8f5778 | 78c22c8d818ee2c2abe2eec9c6b6e408161a9d0eaf09afbafc3242e71e8f5778 |
| left | 6042ca0f0889a983a6ccf8f929a6a46b18cc57134e1b9f3b49c19063b936caa5 | 6042ca0f0889a983a6ccf8f929a6a46b18cc57134e1b9f3b49c19063b936caa5 |
| above | 20fc884f08accd368e4ce049ab3fc180a1926f425787a504dbc4040f651bfa69 | 20fc884f08accd368e4ce049ab3fc180a1926f425787a504dbc4040f651bfa69 |
| inner-layers | 1b91e6c5207e4b7e132aa5ac246e94777f926c7beab8675adf0356634b8280ad | 1b91e6c5207e4b7e132aa5ac246e94777f926c7beab8675adf0356634b8280ad |
| inner-layers-right | 2eaf3dedcd84fbfed10262f4d4c99370a0ca00a7a060f87b7a1cdcba9de37a8e | 2eaf3dedcd84fbfed10262f4d4c99370a0ca00a7a060f87b7a1cdcba9de37a8e |
| inner-layers-left | 1c3db8ee018bc90df7fbbb0c198c42efcc0ca948a6a213338650cf81a51f7ab2 | 1c3db8ee018bc90df7fbbb0c198c42efcc0ca948a6a213338650cf81a51f7ab2 |
| inner-layers-above | 68a86ef74f8ec9628954e909464c009d98fb2c902a6376e20b3a32d4b5cff555 | 68a86ef74f8ec9628954e909464c009d98fb2c902a6376e20b3a32d4b5cff555 |
| inner-layers-complete-ca | a6def279fa2d3356a66ee94b1760a76eebb6c6d8e605005ce5903bd2fbca8776 | a6def279fa2d3356a66ee94b1760a76eebb6c6d8e605005ce5903bd2fbca8776 |
| outer-layers | de3fd915f3c7d8c9bf4fd3c9b197596ba5e08c1be328f9c5223d7ab78736588f | de3fd915f3c7d8c9bf4fd3c9b197596ba5e08c1be328f9c5223d7ab78736588f |

</details>
