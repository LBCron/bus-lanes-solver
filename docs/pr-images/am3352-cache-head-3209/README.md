# AM3352 cache fix gallery

All 11 fresh samples passed 47/47 connectivity, fixed-power preservation, DRC, bus matching and pair coupling. The 161 fixed power routes are preserved in every sample. Bus skew is at most 0.635 mm and pair skew at most 0.127 mm.

Solver: `d47b57c26e6d173d83a76adb5147f38c81623045`. Each sample ran on Blacksmith 4 CPU with Bun 1.4.0 and a 3,600-second budget.

[Fresh gallery run](https://github.com/tscircuit/bus-lanes-solver/actions/runs/44066617824) · [Validation and image hashes](proof.json) · [Original SVG/PNG artifact](https://github.com/tscircuit/bus-lanes-solver/actions/runs/44066617824/artifacts/14321940904)

| Sample | Full-resolution native snapshot |
|---|---|
| control | [PNG](control-solved.png) |
| control-inner1 | [PNG](control-inner1-solved.png) |
| right | [PNG](right-solved.png) |
| left | [PNG](left-solved.png) |
| above | [PNG](above-solved.png) |
| inner-layers | [PNG](inner-layers-solved.png) |
| inner-layers-right | [PNG](inner-layers-right-solved.png) |
| inner-layers-left | [PNG](inner-layers-left-solved.png) |
| inner-layers-above | [PNG](inner-layers-above-solved.png) |
| inner-layers-complete-ca | [PNG](inner-layers-complete-ca-solved.png) |
| outer-layers | [PNG](outer-layers-solved.png) |

These head-only gallery solves are separate from the [required paired benchmark](https://github.com/tscircuit/bus-lanes-solver/actions/runs/44063802500). All 11 input hashes and all non-timing report fields match its head results. No timing improvement is claimed from this gallery.

The linked CI artifact contains all original SVGs and PNGs; its retention ends on 2026-12-17. The PNGs in this directory are unchanged copies of those accepted outputs. This documentation does not change benchmark behavior.
