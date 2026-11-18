# AM3352 fresh paired comparison

All **11/11** samples are freshly solved and accepted on **both** main `202b034` and final head `190325d`. The required `AM3352 benchmark (11/11)` acceptance job is green. Every sample connects 47/47 requested signals, passes full declared bus matching, fixed and combined copper DRC, all three pair skew/coupling checks, and preserves the 161 supplied fixed power traces, vias and pad joins. No completion is lost or gained. Inputs and full validation objects, iterations and carrier counts agree between revisions. Equal measurements alone do not establish exact trace geometry.

These are serial base/head solves within each sample, distributed across eleven Blacksmith 4-vCPU Ubuntu workers, Bun 1.4.0, Linux x64. Each pair uses the same pinned-base harness and fixture; order alternates by sample. The limit is 3,600 seconds per solver/sample. These are fresh performance measurements, separate from the older completed reference-image gallery.

| Sample | Main solve (s) | Head solve (s) | Change | Main / head accepted |
| --- | ---: | ---: | ---: | --- |
| [control](control/control.json) | 34.607 | 39.697 | +14.71% | 47/47 / 47/47 |
| [control-inner1](control-inner1/control-inner1.json) | 1186.911 | 1162.002 | -2.10% | 47/47 / 47/47 |
| [right](right/right.json) | 31.092 | 35.956 | +15.65% | 47/47 / 47/47 |
| [left](left/left.json) | 38.848 | 34.648 | -10.81% | 47/47 / 47/47 |
| [above](above/above.json) | 48.211 | 50.768 | +5.30% | 47/47 / 47/47 |
| [inner-layers](inner-layers/inner-layers.json) | 38.860 | 41.384 | +6.50% | 47/47 / 47/47 |
| [inner-layers-right](inner-layers-right/inner-layers-right.json) | 82.328 | 76.652 | -6.89% | 47/47 / 47/47 |
| [inner-layers-left](inner-layers-left/inner-layers-left.json) | 180.040 | 195.595 | +8.64% | 47/47 / 47/47 |
| [inner-layers-above](inner-layers-above/inner-layers-above.json) | 355.006 | 343.864 | -3.14% | 47/47 / 47/47 |
| [inner-layers-complete-ca](inner-layers-complete-ca/inner-layers-complete-ca.json) | 201.146 | 217.620 | +8.19% | 47/47 / 47/47 |
| [outer-layers](outer-layers/outer-layers.json) | 1039.640 | 990.249 | -4.75% | 47/47 / 47/47 |

Six single-pair runtime increases remain: `control`, `right`, `above`, `inner-layers`, `inner-layers-left`, `inner-layers-complete-ca`. Five pairs are faster. The median is 82.328→76.652 seconds (−6.9%), P80 355.006→343.864 (−3.1%), P90 1039.640→990.249 (−4.8%), and P95 1113.275→1076.125 (−3.3%). These are eleven single pairs, not repeated statistical evidence of a general runtime improvement. Full per-bus total-copper skew and pair skew/tolerance measurements appear in the trusted report; raw validation retains signal lengths, coupling and fixed-copper gates.

- [Trusted pinned-base comparison report](comparison.md)
- [Independent gate/status summary](progress.json)
- [Final provenance and report hashes](provenance.json)
- [Independent audit](independent-audit.txt)
- [Trusted report reproduction driver](render-final.ts)
- [Blacksmith workflow and raw CI artifacts](https://github.com/tscircuit/bus-lanes-solver/actions/runs/44382576930)

Exact CI pair command, run from a parent directory containing pinned `base` and `head` checkouts with their recorded dependencies:

```sh
bun base/scripts/pr-benchmark/run-pair.ts \
  --sample control --timeout-seconds 3600 \
  --main base/lib/index.ts --pr head/lib/index.ts \
  --main-sha 202b034659fb96bad44d11b8190f4044b675116f \
  --pr-sha 190325da97253ad7951f9dfd3b0046b4afcb5395 \
  --controller-sha 202b034659fb96bad44d11b8190f4044b675116f \
  --output results/control.json
```

Repeat with each of the eleven sample names listed above. The workflow installs each checkout using its frozen lockfile and uses the base report renderer for comparison. Raw reports record both input hashes, exact source/controller pins, runtime, runner identity, execution order, budgets and validation.
