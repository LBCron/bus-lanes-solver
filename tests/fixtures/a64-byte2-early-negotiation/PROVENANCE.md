# A64 byte2 early-negotiation regression

This fixture requests the third eight-signal DDR byte on the A64 board while
retaining the 16 completed traces for the first two bytes. It exercises a fresh
`BusLanesPipelineSolver(input)` solve with default options. The production change
under test enables early negotiation for eligible untimed, unpaired dense buses.

Pinned source revisions:

- Core: `1a16da2f74fc2c80712d52abb17254dd2a80e2c5`
- DDR benchmark: `24dc44c166d4258c3538f8b1f66953f1b6f58690`
- Bus lanes main baseline: `202b034659fb96bad44d11b8190f4044b675116f`

Source artifacts from the pinned core-main A64 run:

| Artifact | SHA-256 of original file |
| --- | --- |
| `a64/phase-3-start.srj.json` | `3839e7492986ba5a6b5f6051446a0094b29d5dea2eadda18cd718a38a27f2938` |
| `a64/phase-3-end.srj.json` | `58b4af520e8c32a205296ca5181db02f3f27934dd8317b8a1bd5301137ed47a7` |

The originals were read from `/workspace/ddr-results/core-main/a64/`.
`input.srj.json.gz` contains the complete start SRJ, serialized as compact JSON.
Its 607 obstacles, eight requests, six physical layers, and 16 fixed traces are
retained. All supplied segments are wires or vias, so core's
`getBusLanesInputFromSrj` conversion preserves these values. The converter source
SHA-256 was `fca83b4aacc128274410985896c2a0c4239e44bb4e386aaccca76b10823d1fb3`.

`expected-routes.json.gz` contains only the eight requested route arrays from the
end SRJ, keyed by `connection_name` in start-SRJ request order:
`source_net_34`, `source_net_35`, `source_net_36`, `source_net_37`,
`source_net_39`, `source_net_40`, `source_net_41`, and `source_net_42`.
The end SRJ retains all 16 supplied traces as its exact prefix.
The gzip files use maximum compression, an empty filename, and `mtime=0`.

The test independently checks requested endpoints and layers, supplied-trace
preservation, input immutability, and native copper DRC. Validation-only empty
connections identify the owners of the 16 fixed traces; they are never passed to
the solver. Saved route comparison checks output stability and is not a timing
or fresh-performance benchmark.
