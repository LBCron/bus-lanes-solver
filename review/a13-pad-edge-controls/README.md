# Validated AM3352 controls for the A13 escape fix

All eleven placements were freshly routed at production revision `aa0c68b66cb0e80d7aa3bc3f11dfd0ce052cc901`. Every snapshot passes 47/47 connectivity, combined DRC, full-copper length matching, pair coupling and preservation of all 161 supplied power dogbones. All eleven images were visually inspected before publishing.

The image solves are from [43959167575](https://github.com/tscircuit/bus-lanes-solver/actions/runs/43959167575). The separate paired base/head comparison is [43955037625](https://github.com/tscircuit/bus-lanes-solver/actions/runs/43955037625), base `b1b366dcbaea5ea37b80cd62df8ec901f04f42e3`, head `aa0c68b66cb0e80d7aa3bc3f11dfd0ce052cc901`. Full validation measurements and iteration counts are identical across revisions for every placement. This does not assert byte-equivalent output SRJ, which was not retained by the paired harness.

Bun 1.4.0; Blacksmith 4-vCPU Ubuntu 24.04 x64; 3,600 seconds per solver/sample; same pinned harness and fixture hashes, fresh sequential child processes, alternating revision order by sample.

| Placement | Signals, both | DRC, both | Bus skews, both (mm) | Pair skews, both (mm) | Coupling, both | Solve seconds, base → head |
| --- | ---: | ---: | --- | --- | --- | ---: |
| [control](control-solved.png) | 47/47 | 0 | 0.635000 / 0.635000 | 0.077868 / 0.126884 / 0.072830 | pass | 24.090 → 24.817 |
| [control-inner1](control-inner1-solved.png) | 47/47 | 0 | 0.635000 / 0.635000 | 0.048900 / 0.004720 / 0.030215 | pass | 1247.751 → 1457.594 |
| [right](right-solved.png) | 47/47 | 0 | 0.635000 / 0.635000 | 0.096047 / 0.121802 / 0.102644 | pass | 34.193 → 25.960 |
| [left](left-solved.png) | 47/47 | 0 | 0.635000 / 0.511147 | 0.010514 / 0.127000 / 0.105429 | pass | 40.320 → 32.924 |
| [above](above-solved.png) | 47/47 | 0 | 0.635000 / 0.635000 | 0.127000 / 0.127000 / 0.127000 | pass | 28.768 → 34.661 |
| [inner-layers](inner-layers-solved.png) | 47/47 | 0 | 0.635000 / 0.635000 | 0.077868 / 0.126884 / 0.127000 | pass | 58.741 → 57.749 |
| [inner-layers-right](inner-layers-right-solved.png) | 47/47 | 0 | 0.635000 / 0.635000 | 0.127000 / 0.127000 / 0.127000 | pass | 72.163 → 67.577 |
| [inner-layers-left](inner-layers-left-solved.png) | 47/47 | 0 | 0.634990 / 0.634992 | 0.126990 / 0.000001 / 0.105429 | pass | 145.196 → 225.215 |
| [inner-layers-above](inner-layers-above-solved.png) | 47/47 | 0 | 0.634991 / 0.634993 | 0.126915 / 0.126990 / 0.000001 | pass | 194.892 → 298.456 |
| [inner-layers-complete-ca](inner-layers-complete-ca-solved.png) | 47/47 | 0 | 0.634990 / 0.634992 / 0.634994 | 0.075359 / 0.000000 / 0.066384 | pass | 350.316 → 316.104 |
| [outer-layers](outer-layers-solved.png) | 47/47 | 0 | 0.635000 / 0.635000 | 0.019219 / 0.127000 / 0.127000 | pass | 952.335 → 1122.954 |

Aggregate solve time: **3148.766 → 3664.010 seconds (+16.4%)**. This first pair is slower in aggregate despite identical search iterations and validation measurements. An unchanged-production-code control also varied +8.7%; the repeat comparison is still running. No speedup or performance acceptance is claimed.

Bus skew limit: 0.635 mm. Pair skew limit: 0.127 mm. All three shared pair sections and their exterior coupling checks pass in every sample. Full original SVGs, 2,200-pixel PNGs and raw reports remain in the workflow artifacts. The PNGs here are 1,100-pixel previews rendered from those validated SVGs.

After the measured production revision, `a43773f681aabba4d3ce4beabc12266859a67a5a` changes only three expected SVG snapshots; no solver or benchmark code changes.
