# Completed core byte-stage copper measurements

All 25 jointly completed byte phases have identical measured geometry on main and final head. Values below apply to both. These are XY polyline lengths for each requested signal, including its supplied fanout portions and excluding vertical via barrel delay; they are not DDR delay matching. No timing tolerance or differential pair is declared in these byte inputs.

| Circuit | Phase | Bus | Total copper (mm) | Minimum (mm) | Maximum (mm) | Max−min skew (mm) |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| h3 | byte0 | DDR_BUS_byte0 | 119.219967 | 12.019812 | 19.472511 | 7.452699 |
| h3 | byte1 | DDR_BUS_byte1 | 174.585252 | 9.189707 | 35.165017 | 25.975310 |
| a64 | byte0 | DDR_BUS_byte0 | 137.784899 | 14.415180 | 20.152796 | 5.737615 |
| a64 | byte1 | DDR_BUS_byte1 | 144.743233 | 12.502439 | 22.986390 | 10.483952 |
| a64 | byte2 | DDR_BUS_byte2 | 127.621477 | 11.065727 | 23.246332 | 12.180604 |
| a64 | byte3 | DDR_BUS_byte3 | 64.804338 | 7.000610 | 9.631118 | 2.630509 |
| stmp157 | byte0 | DDR_BUS_byte0 | 104.068333 | 11.438478 | 14.169848 | 2.731371 |
| stmp157 | byte1 | DDR_BUS_byte1 | 89.923878 | 9.949747 | 15.123723 | 5.173976 |
| stmp157 | byte2 | DDR_BUS_byte2 | 202.899442 | 21.346299 | 31.763477 | 10.417179 |
| stmp157 | byte3 | DDR_BUS_byte3 | 78.703408 | 8.101219 | 11.163961 | 3.062742 |
| orangecrab | byte0 | DDR_BUS_byte0 | 88.639658 | 8.795815 | 13.034925 | 4.239110 |
| orangecrab | byte1 | DDR_BUS_byte1 | 115.763678 | 12.197667 | 16.685527 | 4.487861 |
| a13 | byte0 | DDR_BUS_byte0 | 34.930573 | 3.628564 | 4.912626 | 1.284062 |
| a13 | byte1 | DDR_BUS_byte1 | 55.673651 | 5.513236 | 8.027019 | 2.513783 |
| a13 | ram_byte0 | DDR_BUS_ram_byte0 | 128.994041 | 5.974874 | 30.054031 | 24.079158 |
| h616 | byte0 | DDR_BUS_byte0 | 85.448672 | 7.268305 | 14.047462 | 6.779157 |
| h616 | byte1 | DDR_BUS_byte1 | 74.396233 | 4.684090 | 14.937796 | 10.253706 |
| butterstick | byte0 | DDR_BUS_byte0 | 216.296263 | 21.711984 | 35.888547 | 14.176563 |
| butterstick | byte1 | DDR_BUS_byte1 | 229.960817 | 20.677741 | 39.581784 | 18.904043 |
| glider | byte0 | DDR_BUS_byte0 | 141.847152 | 16.312031 | 19.436295 | 3.124264 |
| glider | byte1 | DDR_BUS_byte1 | 142.034408 | 14.477716 | 21.519956 | 7.042239 |
| imx6 | byte0 | DDR_BUS_byte0 | 149.884271 | 15.728427 | 22.322540 | 6.594113 |
| imx6 | byte1 | DDR_BUS_byte1 | 172.884035 | 19.313322 | 25.249545 | 5.936224 |
| icepi | byte0 | DDR_BUS_byte0 | 98.010874 | 8.655219 | 14.876430 | 6.221211 |
| icepi | byte1 | DDR_BUS_byte1 | 96.348036 | 8.708183 | 15.055578 | 6.347395 |

[Per-signal measurements and provenance](core-bus-copper-metrics.json) · [Calculation script](core-bus-copper-metrics.ts). The identical main/head raw start/end captures are preserved once per phase as gzip files in `core-completed-phases/`; their uncompressed hashes match both revisions in the core comparison. The script verifies both revisions' recorded raw-file hashes before measuring. Run `bun docs/global-bus-corridors/core-bus-copper-metrics.ts` from this evidence checkout to recompute without core or fresh routing.
