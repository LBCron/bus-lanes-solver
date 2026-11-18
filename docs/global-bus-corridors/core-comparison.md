# Final core DDR comparison

Fresh complete boards: **2/10 → 3/10**. Connected requested nets: **270/606 → 304/606**. Original H616 and Glider passes are preserved; no case loses connected nets. OrangeCrab adds a full 50/50 pass in this run. All main/head assessed outputs have zero native physical DRC findings and zero native geometry errors. Partial outputs still have disconnected-port findings and are not completed boards.

| Case | Main status | Main nets | Head status | Head nets | Main s | Head s | Main connectivity / physical findings | Head connectivity / physical findings | Main / head geometry errors |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|
| h3 | failed | 16/53 | failed | 16/53 | 45.46 | 69.76 | 76 / 0 | 76 / 0 | 0 / 0 |
| a64 | timeout | 32/75 | timeout | 32/75 | 120.10 | 120.16 | 120 / 0 | 120 / 0 | 0 / 0 |
| stmp157 | timeout | 32/72 | timeout | 32/72 | 120.20 | 120.14 | 137 / 0 | 137 / 0 | 0 / 0 |
| orangecrab | timeout | 16/50 | passed | 50/50 | 120.10 | 105.68 | 70 / 0 | 0 / 0 | 0 / 0 |
| a13 | timeout | 24/96 | timeout | 24/96 | 120.11 | 120.06 | 144 / 0 | 144 / 0 | 0 / 0 |
| h616 | passed | 53/53 | passed | 53/53 | 83.62 | 76.63 | 0 / 0 | 0 / 0 | 0 / 0 |
| butterstick | timeout | 16/55 | timeout | 16/55 | 120.15 | 120.20 | 111 / 0 | 111 / 0 | 0 / 0 |
| glider | passed | 49/49 | passed | 49/49 | 40.86 | 42.97 | 0 / 0 | 0 / 0 | 0 / 0 |
| imx6 | timeout | 16/53 | timeout | 16/53 | 120.24 | 120.21 | 86 / 0 | 86 / 0 | 0 / 0 |
| icepi | timeout | 16/50 | timeout | 16/50 | 120.12 | 120.17 | 70 / 0 | 70 / 0 | 0 / 0 |

Native connectivity findings total 814 → 744; all are disconnected-port findings. H3 fails in the remaining capacity autorouter; A64, STMP157, A13, ButterStick, i.MX6 and iCE/Pi time out with retained partial routes. OrangeCrab, H616 and Glider finish and validate fully.

## Fresh isolated A64 byte2 pair

Exact original core A64 phase-3 raw input, passed through `getBusLanesInputFromSrj(structuredClone(raw))`, public `new BusLanesPipelineSolver(input)` with default options, separate fresh serial Bun processes, 120-second external watchdog per process. Main solver walltime **56.744s**, head **11.659s** (4.867× main/head, 79.45% reduction). External whole-process times: 58.500s and 12.997s. Both use 16,850 solver iterations.

Both fresh outputs preserve all 16 fixed traces and inputs, connect all 8 requested nets and 16 native endpoints, pass native DRC over all 24 traces with zero issues, and have the full 24-trace output SRJ exactly equal to the original main output and each other (JSON SHA-256 `58b4af520e8c32a205296ca5181db02f3f27934dd8317b8a1bd5301137ed47a7`). All 8 requested route arrays also match exactly. This establishes a speed difference for this isolated stage; it does not establish a full-board speedup. Full pair input/output/validation/timings/source hashes are retained under `/workspace/ddr-results/a64-final-paired-public`.

## Completed byte geometry

Both runs completed 25 bus phases. 25 have exactly equal start SRJ values; all 25 of those have exactly equal end SRJ values. Comparable phases with different outputs: 0. Missing raw completed-phase captures: 0. Full per-phase input/output hashes and requested-route equality are in the JSON comparison.

| Case | Phase | Same start SRJ | Same end SRJ | Same requested route arrays |
|---|---|---|---|---|
| h3 | byte0 | True | True | True |
| h3 | byte1 | True | True | True |
| a64 | byte0 | True | True | True |
| a64 | byte1 | True | True | True |
| a64 | byte2 | True | True | True |
| a64 | byte3 | True | True | True |
| stmp157 | byte0 | True | True | True |
| stmp157 | byte1 | True | True | True |
| stmp157 | byte2 | True | True | True |
| stmp157 | byte3 | True | True | True |
| orangecrab | byte0 | True | True | True |
| orangecrab | byte1 | True | True | True |
| a13 | byte0 | True | True | True |
| a13 | byte1 | True | True | True |
| a13 | ram_byte0 | True | True | True |
| h616 | byte0 | True | True | True |
| h616 | byte1 | True | True | True |
| butterstick | byte0 | True | True | True |
| butterstick | byte1 | True | True | True |
| glider | byte0 | True | True | True |
| glider | byte1 | True | True | True |
| imx6 | byte0 | True | True | True |
| imx6 | byte1 | True | True | True |
| icepi | byte0 | True | True | True |
| icepi | byte1 | True | True | True |

## Per-stage outcomes

### h3

main: byte0 completed (8 requests, 0.841s); byte1 completed (8 requests, 29.533s); remaining failed (37 requests, 9.226s).
head: byte0 completed (8 requests, 0.947s); byte1 completed (8 requests, 34.942s); remaining failed (37 requests, 24.744s).

### a64

main: byte0 completed (8 requests, 0.877s); byte1 completed (8 requests, 1.034s); byte2 completed (8 requests, 93.558s); byte3 completed (8 requests, 9.249s); remaining running (43 requests, unfinished).
head: byte0 completed (8 requests, 1.062s); byte1 completed (8 requests, 1.268s); byte2 completed (8 requests, 11.238s); byte3 completed (8 requests, 8.635s); remaining running (43 requests, unfinished).

### stmp157

main: byte0 completed (8 requests, 0.908s); byte1 completed (8 requests, 0.971s); byte2 completed (8 requests, 1.630s); byte3 completed (8 requests, 1.235s); remaining running (40 requests, unfinished).
head: byte0 completed (8 requests, 0.968s); byte1 completed (8 requests, 0.798s); byte2 completed (8 requests, 1.385s); byte3 completed (8 requests, 1.060s); remaining running (40 requests, unfinished).

### orangecrab

main: byte0 completed (8 requests, 1.134s); byte1 completed (8 requests, 0.853s); remaining running (34 requests, unfinished).
head: byte0 completed (8 requests, 0.913s); byte1 completed (8 requests, 1.600s); remaining completed (34 requests, 94.863s).

### a13

main: byte0 completed (8 requests, 20.092s); byte1 completed (8 requests, 18.275s); ram_byte0 completed (8 requests, 50.292s); ram_byte1 running (8 requests, unfinished).
head: byte0 completed (8 requests, 15.268s); byte1 completed (8 requests, 16.024s); ram_byte0 completed (8 requests, 41.232s); ram_byte1 running (8 requests, unfinished).

### h616

main: byte0 completed (8 requests, 1.132s); byte1 completed (8 requests, 7.735s); remaining completed (37 requests, 66.029s).
head: byte0 completed (8 requests, 0.656s); byte1 completed (8 requests, 5.605s); remaining completed (37 requests, 64.167s).

### butterstick

main: byte0 completed (8 requests, 4.111s); byte1 completed (8 requests, 21.718s); remaining running (39 requests, unfinished).
head: byte0 completed (8 requests, 4.725s); byte1 completed (8 requests, 19.860s); remaining running (39 requests, unfinished).

### glider

main: byte0 completed (8 requests, 0.412s); byte1 completed (8 requests, 0.503s); remaining completed (33 requests, 34.338s).
head: byte0 completed (8 requests, 0.463s); byte1 completed (8 requests, 0.531s); remaining completed (33 requests, 36.166s).

### imx6

main: byte0 completed (8 requests, 1.050s); byte1 completed (8 requests, 2.662s); remaining running (37 requests, unfinished).
head: byte0 completed (8 requests, 0.838s); byte1 completed (8 requests, 2.241s); remaining running (37 requests, unfinished).

### icepi

main: byte0 completed (8 requests, 0.656s); byte1 completed (8 requests, 0.378s); remaining running (34 requests, unfinished).
head: byte0 completed (8 requests, 0.387s); byte1 completed (8 requests, 0.811s); remaining running (34 requests, unfinished).

## Pins, commands and limits

- Main bus source: `202b034659fb96bad44d11b8190f4044b675116f`; dist SHA-256 `fa6390c904b678f7dc197d0d3d671a28e273554369f8475457ea86374c5dad8c`.
- Final head bus source: `190325da97253ad7951f9dfd3b0046b4afcb5395`; dist SHA-256 `940e910143a475e280ed3cdc7a0bb262daf98c0fdb075d82b95cbfb2b496f2f8`.
- Core: `1a16da2f74fc2c80712d52abb17254dd2a80e2c5`, tracked tree clean. Other dependencies and fixtures unchanged; only bus dependency symlink switched. It remains pointed at the final frozen head.
- Core DDR package pin: `24dc44c166d4258c3538f8b1f66953f1b6f58690`; harness/assessment fingerprint `07241d5c0af855ba5f7d0516d9cdbf62e00f0a048df8c7011165bcce697eb73c`.
- Both full runs: Bun 1.4.3, Linux x64, AMD EPYC 7763, 4 CPU quota (`400000 100000`), 16 GiB memory limit, 120s per render and validation worker, serial fresh workers, routing cache disabled. Exact fixtures, runtime, dependencies, source/harness and budgets match in all recorded metadata.
- Main command: `source /workspace/.tools/autorouter-env.sh; bun run benchmark:ddr --out /workspace/ddr-results/core-main` (default timeout 120).
- Final command: `source /workspace/.tools/autorouter-env.sh; bun run benchmark:ddr --timeout 120 --out /workspace/ddr-results/core-head-native-inner`.
- Stage pair command: `python3 /workspace/ddr-results/run-final-a64-pair.py` from `/workspace/core`; invokes two fresh default public solver processes with independent 120s external watchdogs.
- Pair machine: same recorded AMD EPYC 7763 / 4 CPU / 16 GiB; other local heavy work held through completion. Pair ran after the environment/context refresh; both pair measurements ran together under the same current environment.

Full-board timing changes are observations from different-time full runs. H3 regresses 45.46→69.76s and Glider changes are listed above; the fresh pair supports only the isolated A64 stage timing claim. OrangeCrab passed in an earlier selected main repeat as well, showing deadline variance; this final 3/10 vs original 2/10 result should not be called proof of a deterministic full-board completion gain.

This core DDR harness does not request or establish length matching, total-bus copper-length skew, pair skew or coupling acceptance. These routing-only passes must not be called length-matching passes. The superseded 631 run is preserved separately and excluded from final acceptance.

Raw reports and hashes are in both `results.json`/`provenance.json` files, `/workspace/ddr-results/core-head-native-inner.run.log`, the stage pair directory, and `/workspace/ddr-results/core-final-comparison.json`.

Additional [per-bus copper measurements](core-bus-copper-metrics.md) postprocess
all 25 jointly completed byte phases. Total XY copper length and max−min skew
are identical between revisions for every phase. These geometric measurements
do not turn the untimed core inputs into matching acceptance tests.
