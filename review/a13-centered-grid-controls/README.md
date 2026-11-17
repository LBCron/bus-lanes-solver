Fresh AM3352 control routes at `b410bda0f902ae0a0f01366fe889a2abb0e94127`. All eleven cases completed 47/47 native signal connections, DRC, full-copper length matching and pair coupling; all 161 supplied power dogbones per case remain unchanged. Every PNG was inspected after validation.

[Fresh image solves and validated exporter](https://github.com/tscircuit/bus-lanes-solver/actions/runs/44035484915). The 1,100-pixel PNGs preview the original SVGs; neither is a search-state visualization.

[Fresh paired base/head comparison](https://github.com/tscircuit/bus-lanes-solver/actions/runs/44035191021): base/controller `b1b366dcbaea5ea37b80cd62df8ec901f04f42e3`, head `b410bda0f902ae0a0f01366fe889a2abb0e94127`. Bun 1.4.0, Blacksmith 4-vCPU Ubuntu 24.04 x64, 3,600 seconds per solver/sample, same fixtures and harness, fresh child processes and alternating revision order. The image solves are independent of the paired timing runs.

| Placement | PNG | Original SVG | Signals, both | DRC, both | Bus skews, both (mm) | Pair skews, both (mm) | Seconds, base → head |
| --- | --- | --- | ---: | ---: | --- | --- | ---: |
| above | [PNG](above-solved.png) | [SVG](above-solved.svg) | 47/47 | 0 | 0.635000 / 0.635000 | 0.127000 / 0.127000 / 0.127000 | 32.864 → 32.906 |
| control | [PNG](control-solved.png) | [SVG](control-solved.svg) | 47/47 | 0 | 0.635000 / 0.635000 | 0.077868 / 0.126884 / 0.072830 | 21.147 → 21.531 |
| control-inner1 | [PNG](control-inner1-solved.png) | [SVG](control-inner1-solved.svg) | 47/47 | 0 | 0.635000 / 0.635000 | 0.048900 / 0.004720 / 0.030215 | 538.904 → 559.723 |
| inner-layers | [PNG](inner-layers-solved.png) | [SVG](inner-layers-solved.svg) | 47/47 | 0 | 0.635000 / 0.635000 | 0.077868 / 0.126884 / 0.127000 | 48.459 → 47.672 |
| inner-layers-above | [PNG](inner-layers-above-solved.png) | [SVG](inner-layers-above-solved.svg) | 47/47 | 0 | 0.634991 / 0.634993 | 0.126915 / 0.126990 / 0.000001 | 161.288 → 156.856 |
| inner-layers-complete-ca | [PNG](inner-layers-complete-ca-solved.png) | [SVG](inner-layers-complete-ca-solved.svg) | 47/47 | 0 | 0.634990 / 0.634992 / 0.634994 | 0.075359 / 0.000000 / 0.066384 | 175.864 → 181.714 |
| inner-layers-left | [PNG](inner-layers-left-solved.png) | [SVG](inner-layers-left-solved.svg) | 47/47 | 0 | 0.634990 / 0.634992 | 0.126990 / 0.000001 / 0.105429 | 271.212 → 149.028 |
| inner-layers-right | [PNG](inner-layers-right-solved.png) | [SVG](inner-layers-right-solved.svg) | 47/47 | 0 | 0.635000 / 0.635000 | 0.127000 / 0.127000 / 0.127000 | 44.624 → 44.805 |
| left | [PNG](left-solved.png) | [SVG](left-solved.svg) | 47/47 | 0 | 0.635000 / 0.511147 | 0.010514 / 0.127000 / 0.105429 | 34.764 → 35.558 |
| outer-layers | [PNG](outer-layers-solved.png) | [SVG](outer-layers-solved.svg) | 47/47 | 0 | 0.635000 / 0.635000 | 0.019219 / 0.127000 / 0.127000 | 577.863 → 575.943 |
| right | [PNG](right-solved.png) | [SVG](right-solved.svg) | 47/47 | 0 | 0.635000 / 0.635000 | 0.096047 / 0.121802 / 0.102644 | 19.465 → 18.598 |

Aggregate solve seconds: **1926.453 → 1824.335 (-5.3%)**. All validation measurements and search iteration counts are identical for every placement. No algorithmic speedup is claimed from these timings.

Bus skew limit: 0.635 mm. Pair skew limit: 0.127 mm. All coupling checks pass. Measurements include native terminal approaches, fixed fanouts and carrier copper.

Reproduce each paired case with the pinned base harness:

```sh
bun base/scripts/pr-benchmark/run-pair.ts --sample "$SAMPLE" --timeout-seconds 3600 \
  --main base/lib/index.ts --pr head/lib/index.ts \
  --main-sha b1b366dcbaea5ea37b80cd62df8ec901f04f42e3 \
  --pr-sha b410bda0f902ae0a0f01366fe889a2abb0e94127 \
  --controller-sha b1b366dcbaea5ea37b80cd62df8ec901f04f42e3 \
  --output "results/$SAMPLE.json"
```
