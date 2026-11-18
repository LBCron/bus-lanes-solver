# Final fresh stacked core DDR comparison

Fresh repro base R **4/10 boards, 341/606 nets**; fresh handbook fix F **4/10 boards, 341/606 nets**. No per-case connectivity declines: True. H616 and Glider pass in both: True. All assessed native physical findings and geometry errors are zero in both runs.

**OrangeCrab passes in BOTH fresh R and F runs.** Its complete circuit JSON is byte-identical in R, F and the retained 190 completed capture. The successful SVG geometry is therefore also unchanged main code R’s completed geometry. This is not evidence of a deterministic OrangeCrab completion fix. Historical measurements of202b (2/10) and190 (3/10) measurements are retained separately and do not replace this fresh comparison.

| Case | Fresh R status | R connected | Fresh F status | F connected | R s | F s | R/F connectivity findings | R/F physical findings | R/F geometry errors |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|
| h3 | failed | 16/53 | failed | 16/53 | 40.64 | 44.06 | 76/76 | 0/0 | 0/0 |
| a64 | timeout | 32/75 | failed | 32/75 | 120.09 | 114.42 | 120/120 | 0/0 | 0/0 |
| stmp157 | timeout | 32/72 | timeout | 32/72 | 120.17 | 120.15 | 137/137 | 0/0 | 0/0 |
| orangecrab | passed | 50/50 | passed | 50/50 | 96.72 | 85.57 | 0/0 | 0/0 | 0/0 |
| a13 | timeout | 24/96 | timeout | 24/96 | 120.20 | 120.08 | 144/144 | 0/0 | 0/0 |
| h616 | passed | 53/53 | passed | 53/53 | 64.11 | 58.61 | 0/0 | 0/0 | 0/0 |
| butterstick | timeout | 16/55 | timeout | 16/55 | 120.23 | 120.17 | 111/111 | 0/0 | 0/0 |
| glider | passed | 49/49 | passed | 49/49 | 39.13 | 33.12 | 0/0 | 0/0 | 0/0 |
| imx6 | passed | 53/53 | passed | 53/53 | 111.41 | 95.16 | 0/0 | 0/0 | 0/0 |
| icepi | timeout | 16/50 | timeout | 16/50 | 120.13 | 120.08 | 70/70 | 0/0 | 0/0 |

Native connectivity findings total 658→658; they are disconnected-port findings on partial boards. Partial routes and timeouts are not complete boards. H3 fails in the remaining capacity solver in both runs. F A64 completes all four bytes, then its remaining capacity solver fails with `UQ ran out of iterations`; R A64 times out at 32 connected nets. This status difference leaves equal 32/75 connectivity.

## Fresh isolated public A64 phase3 pair

R source `2af1bd6f4f7481a10afcf9c475f9b7dfe92f9e95` versus F `358604c0e7f8bee42d0aef488807239c322198c6`: solver walltime **44.486s → 8.481s**, ratio **5.245×**, reduction **80.94%**. External whole-process walltimes 45.367s and 9.244s. Both use 16,850 solver iterations.

Both fresh processes use the exact original captured A64 phase3 raw input through the core adapter on a clone, default public `new BusLanesPipelineSolver(input)`, no options/reflection, separate serial processes and independent 120s external watchdogs. Both preserve all 16 fixed traces and input values, connect 8 requested nets/16native endpoints, and pass native DRC across 24 traces,188 segments and30 vias with0 issues. Both full output SRJs exactly equal original main (JSON SHA-256 `58b4af520e8c32a205296ca5181db02f3f27934dd8317b8a1bd5301137ed47a7`). The timing claim applies only to this isolated stage; it is not a full-board speedup claim.

## Exact geometry comparisons

Completed byte-stage pairs: 25; exactly equal start SRJs: 25; exactly equal end SRJs among comparable starts: 25; missing captures: 0; different comparable outputs: 0. JSON contains all paths and hashes.

| Board complete in both | Entire circuit bytes equal | Entire circuit JSON values equal |
|---|---|---|
| orangecrab | True | True |
| h616 | True | True |
| glider | True | True |
| imx6 | True | True |

OrangeCrab R/F/retained 190 circuit SHA-256: `79df0cdc7ef4d80a6e58a00831edd5bdd0a5afdde9277d3b508d8f03e555bd2d`. All52 traces,109 vias,385 pads and canonical complete physical objects match exactly, with every route/via/ownership field retained and no rounding or tolerance. The retained image keeps its actual source190 capture provenance.

## Per-stage outcomes

### h3

R: byte0 completed (8 requests,0.700s); byte1 completed (8 requests,25.310s); remaining failed (37 requests,9.346s).
F: byte0 completed (8 requests,0.776s); byte1 completed (8 requests,26.055s); remaining failed (37 requests,10.285s).

### a64

R: byte0 completed (8 requests,0.835s); byte1 completed (8 requests,0.871s); byte2 completed (8 requests,74.589s); byte3 completed (8 requests,6.329s); remaining running (43 requests,unfinished).
F: byte0 completed (8 requests,0.942s); byte1 completed (8 requests,1.052s); byte2 completed (8 requests,10.322s); byte3 completed (8 requests,7.220s); remaining failed (43 requests,88.032s).

### stmp157

R: byte0 completed (8 requests,0.726s); byte1 completed (8 requests,0.822s); byte2 completed (8 requests,1.408s); byte3 completed (8 requests,0.800s); remaining running (40 requests,unfinished).
F: byte0 completed (8 requests,0.644s); byte1 completed (8 requests,0.978s); byte2 completed (8 requests,1.077s); byte3 completed (8 requests,0.926s); remaining running (40 requests,unfinished).

### orangecrab

R: byte0 completed (8 requests,0.736s); byte1 completed (8 requests,0.840s); remaining completed (34 requests,89.416s).
F: byte0 completed (8 requests,1.047s); byte1 completed (8 requests,0.689s); remaining completed (34 requests,78.763s).

### a13

R: byte0 completed (8 requests,13.578s); byte1 completed (8 requests,14.967s); ram_byte0 completed (8 requests,34.598s); ram_byte1 running (8 requests,unfinished).
F: byte0 completed (8 requests,15.751s); byte1 completed (8 requests,14.288s); ram_byte0 completed (8 requests,32.485s); ram_byte1 running (8 requests,unfinished).

### h616

R: byte0 completed (8 requests,0.709s); byte1 completed (8 requests,5.155s); remaining completed (37 requests,52.473s).
F: byte0 completed (8 requests,0.674s); byte1 completed (8 requests,4.977s); remaining completed (37 requests,47.604s).

### butterstick

R: byte0 completed (8 requests,3.050s); byte1 completed (8 requests,14.954s); remaining running (39 requests,unfinished).
F: byte0 completed (8 requests,3.489s); byte1 completed (8 requests,14.019s); remaining running (39 requests,unfinished).

### glider

R: byte0 completed (8 requests,0.641s); byte1 completed (8 requests,0.338s); remaining completed (33 requests,32.936s).
F: byte0 completed (8 requests,0.332s); byte1 completed (8 requests,0.631s); remaining completed (33 requests,27.656s).

### imx6

R: byte0 completed (8 requests,0.798s); byte1 completed (8 requests,1.983s); remaining completed (37 requests,102.161s).
F: byte0 completed (8 requests,1.069s); byte1 completed (8 requests,1.597s); remaining completed (37 requests,86.223s).

### icepi

R: byte0 completed (8 requests,0.439s); byte1 completed (8 requests,0.397s); remaining running (34 requests,unfinished).
F: byte0 completed (8 requests,0.321s); byte1 completed (8 requests,0.307s); remaining running (34 requests,unfinished).

## Pins, build and execution provenance

- R source `2af1bd6f4f7481a10afcf9c475f9b7dfe92f9e95`, frozen dist SHA `92f3fb6ea1086a669b07ea368b804c4a9e976773fdea8e620132eb139d16a155`.
- F source `358604c0e7f8bee42d0aef488807239c322198c6`, frozen dist SHA `557d2f94e831b77c89546f730931b46be07f2d371d534fd81fcf29453ea98913`.
- Both source trees built serially with `source /workspace/.tools/autorouter-env.sh; bun run build` using Bun 1.4.3 and tsup 8.5.1. Build logs: `/workspace/ddr-results/build-stack-repro-base.log` and `build-stack-fix-handbook.log`. Frozen packages include dist,package.json and freeze provenance.
- Fresh R dist differs from historicalfa639 only in60 generated dependency source-path labels/keys because the R node_modules directory is a symlink. Replacing `../bus-lanes-work/node_modules/` with `node_modules/` IN MEMORY gives byte-identical historicalfa639. Neither frozen bundle was normalized on disk. Proof: `packages/bus-stack-repro-base/generated-path-equivalence.json`.
- Core `1a16da2f74fc2c80712d52abb17254dd2a80e2c5`; fixture package pin `24dc44c166d4258c3538f8b1f66953f1b6f58690`; harness/assessment fingerprint `07241d5c0af855ba5f7d0516d9cdbf62e00f0a048df8c7011165bcce697eb73c`. All recorded core/harness/fixture/runtime/dependency/budget metadata match exactly.
- Bun 1.4.3, Linux x64, AMD EPYC7763;4CPU quota (`400000 100000`),16GiB memory;120s per render and validation worker. All20cases ran fresh serially, R all10 before F all10, no routing cache. Root held other local heavy work through the stage pair. All352 recorded nonbus dependency files remained identical to the original installed manifest; this is not an exhaustive transitive-file hash claim.
- main core command: `source /workspace/.tools/autorouter-env.sh; bun run benchmark:ddr --timeout 120 --out /workspace/ddr-results/core-stack-repro-base`.
- head core command: `source /workspace/.tools/autorouter-env.sh; bun run benchmark:ddr --timeout 120 --out /workspace/ddr-results/core-stack-fix-handbook`.
- Pair command: `python3 /workspace/ddr-results/prepared-post-handbook/run-stage-pair.py /workspace/ddr-results/stack-final-config.json`; worker commands/source/input/adapter/native-validator/harness hashes and external watchdog results retained in the pair directory.
- Core/R/F tracked source trees remain clean. Core bus symlink remains on the final frozen F package. No source edits, extra solves or repeats were performed.

Full-board timings are observations from sequential different-time runs. H3 changes40.64→44.06s; other times and timeout/status differences are reported above. No OrangeCrab deterministic-fix claim is supported. The core harness does not establish bus length matching, per-bus total copper-length skew, pair skew or coupling acceptance; routing-only passes must not be called length-matching passes.

Raw all10results/provenance/logs, both frozen packages, stage pair files, build logs, generated-path proof and both-source OrangeCrab geometry report remain under `/workspace/ddr-results`.
