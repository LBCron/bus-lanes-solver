# Fresh isolated A64 third-byte comparison

Both revisions freshly solve the exact A64 byte2 input from core's third byte
phase, through `new BusLanesPipelineSolver(input)` with public default options.
The main and head processes run serially with no concurrent local build, test
or solver work. Each has an external 120-second process-group watchdog.

| Measurement | Main `202b034` | Final head `190325d` |
| --- | ---: | ---: |
| Constructor + `solve()` wall time | 56.744129 s | 11.659061 s |
| External process wall time | 58.500 s | 12.997 s |
| Solver iterations | 16,850 | 16,850 |
| New connected signals / endpoints | 8 / 16 | 8 / 16 |
| Supplied traces preserved exactly | 16 / 16 | 16 / 16 |
| Native combined-copper DRC issues | 0 | 0 |

This single fresh pair measures 79.453% less solver wall time (main/head ratio
4.867). It is a measurement of this untimed byte-stage input, not a general
runtime or full-board speedup. Earlier negotiation reaches the existing native
carrier retry sooner; it is separate from the synthetic corridor-quality gain.
The input declares no timing tolerance or differential pair, so completion is
not a DDR matching or signal-integrity acceptance result.

Both full output JSON values are identical to each other and to the original
main phase output: SHA-256
`58b4af520e8c32a205296ca5181db02f3f27934dd8317b8a1bd5301137ed47a7`.
The harness independently checks all endpoints and layers, input immutability,
the exact 16-trace fixed prefix, and native connectivity and continuous copper
DRC across all 24 traces, 188 segments and 30 vias. Validation-only connection
records retain the electrical owners of fixed traces omitted from the eight
current requests; they do not change either solver input or output.

- [Paired results and provenance](comparison.json)
- [Main result](main.result.json), [input](main.input.srj.json), [output](main.output.srj.json), [validation](main.validation.json)
- [Head result](head.result.json), [input](head.input.srj.json), [output](head.output.srj.json), [validation](head.validation.json)
- [Public-pipeline measurement harness](a64-final-paired-public-stage.ts)
- [Serial process/watchdog wrapper](run-final-a64-pair.py)

The scripts retain the exact workspace paths used. With the pinned core source,
installed dependency inventory and base/head bundles in the recorded locations:

```sh
python3 /workspace/ddr-results/run-final-a64-pair.py
```

The wrapper refuses to overwrite an existing output directory. To replay in a
different workspace, adjust checkout/output paths while preserving the pinned
source, input, adapter and bundle hashes; use a new output directory and keep
other local heavy work stopped. The raw results record Bun 1.4.3, Linux x64,
four-CPU cgroup quota, 16-GiB memory limit, command, timestamps and source hashes.
