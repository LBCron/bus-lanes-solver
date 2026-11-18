# OrangeCrab repro/fix stack validation

[Repro #219](https://github.com/tscircuit/bus-lanes-solver/pull/219) targets main;
[fix #218](https://github.com/tscircuit/bus-lanes-solver/pull/218) targets that
repro. The fix modifies the same tracked SVG,
`repros/orangecrab-full-board/board.snap.svg`, so GitHub shows the captured
16/50 timeout and accepted 50/50 result as an image diff.

| Role | Pinned source |
| --- | --- |
| Main | `202b034659fb96bad44d11b8190f4044b675116f` |
| Repro base R | `2af1bd6f4f7481a10afcf9c475f9b7dfe92f9e95` |
| Stacked fix F | `358604c0e7f8bee42d0aef488807239c322198c6` |
| Retained completed SVG capture | `190325da97253ad7951f9dfd3b0046b4afcb5395` |

This evidence branch contains the unchanged final F production files plus
reports. It changes no solver, fixture, dependency, budget or acceptance rule.

## Fresh core comparison

| Measurement | Repro R | Fix F |
| --- | ---: | ---: |
| Complete boards | **4/10** | **4/10** |
| Connected requested nets | **341/606** | **341/606** |
| Native physical findings / geometry errors | 0 / 0 | 0 / 0 |
| Failures / timeouts / crashes | 1 / 5 / 0 | 2 / 4 / 0 |
| Isolated A64 byte2 default solve | 44.486 s | 8.481 s |

All four baseline completions remain complete: OrangeCrab, H616, Glider and
i.MX6. No case loses connected nets. All 25 jointly completed byte phases have
exactly equal start/end SRJs; all four completed board Circuit JSON files are
byte-identical. Per-bus copper lengths and max−min skew are unchanged.

F A64 completes all four bytes and then the remaining capacity router fails
with `UQ ran out of iterations`; R times out at the same 32/75 connected nets.
That status change is reported as a failure, not a completed board. H3 remains
failed, and STMP157, A13, ButterStick and iCE/Pi remain timed out.

The fresh isolated A64 pair runs the exact captured input through public default
`BusLanesPipelineSolver` instances in separate serial processes, each with a
120-second watchdog. Both full outputs exactly equal original main, including
all 16 supplied traces. Eight nets/16 endpoints connect, and native DRC checks
24 traces, 188 segments and 30 vias with no issues. The measured 80.94% solver
wall-time reduction (5.245× main/head ratio) applies to this single untimed
stage, not a general or full-board speedup.

- [Every core case/stage, regressions, commands and provenance](core-comparison.md)
- [Machine-readable comparison and exact geometry hashes](core-comparison.json)
- [R raw results](core-base/results.json) / [provenance](core-base/provenance.json)
- [F raw results](core-fix/results.json) / [provenance](core-fix/provenance.json)
- [Per-bus copper and skew](byte-copper-measurements.md) / [exact per-signal measurements](byte-copper-measurements.json)
- [Shared completed byte captures](completed-byte-captures) / [four completed board captures](completed-board-captures)
- [Fresh public A64 pair, inputs, outputs and native validation](a64-public-stage/comparison.json)
- [Actual measurement harness](a64-public-stage/a64-public-stage.ts) / [serial watchdog wrapper](a64-public-stage/run-stage-pair.py)
- [Fixed configuration](stack-final-config.json) / [completed execution state](stack-validation-state.json)

Both ten-case runs use core `1a16da2`, fixture package `24dc44c`, Bun 1.4.3,
Linux x64, four CPU quota and 16-GiB memory, serial fresh workers, unchanged
dependencies and 120-second render/validation budgets. Routing cache is disabled.
R all ten precedes F all ten; other local heavy work was held through the A64
pair. Both source trees were built serially before measurements and their
unmodified bundles frozen by SHA-256.

The R bundle differs from the earlier main bundle only in 60 generated
dependency path labels/keys caused by its `node_modules` symlink. In-memory
path replacement proves exact historical-bundle equality; no measured bundle
was normalized on disk. Actual hashes and that proof are preserved in
[R freeze provenance](packages/bus-stack-repro-base/freeze-provenance.json),
[path equivalence](packages/bus-stack-repro-base/generated-path-equivalence.json)
and [F freeze provenance](packages/bus-stack-fix-handbook/freeze-provenance.json).
[741 installed package manifests](core-installed-package-manifests.json) were
rechecked. The [original installed provenance](core-original-installed-provenance.json)
and [direct-file verifier](verify-nonbus-dependencies.py) cover 352 recorded
nonbus package files; they do not claim exhaustive transitive-file hashing.

## What the OrangeCrab SVG diff means

The baseline SVG retains the original main `202b034` 120-second timeout, with
only its 16 accepted DQ traces and 32 vias. The replacement retains the actual
`190325d` completed capture: 50/50 requested DDR nets, 52 traces, 109 vias and
385 native pads. Both six-layer previews were individually inspected at one
viewport. The user-requested baseline exception is narrowly recorded in AGENTS.

**Both fresh R and F also complete OrangeCrab, and their entire circuit files
are byte-identical to that retained completed capture.** The completed geometry
is therefore achievable by unchanged main code. The additional 34 nets are the
remaining capacity-router output; the 16 DQ routes are unchanged. This is a
deadline-sensitive captured outcome, not a deterministic OrangeCrab repair or
proof that the corridor planner changed its bus geometry.

- [Exact R/F/retained190 circuit and physical-object comparison](orangecrab-stack-versus-retained190-both.json)
- [Independent retained-circuit reassessment](retained-capture-revalidation.json)
- [Repro exporter, source/license and capture provenance](../../repros/orangecrab-full-board/README.md)

Core measures requested DDR routing and native geometry. These results do not
establish length matching, coupling, impedance or electrical DDR compliance.

## Handbook and Seve's guidance

The planner uses named options, domain-named Map keys, module-scope helpers and
one shared planning context. Native byte eligibility is a sibling helper. The
repro has a 32-line CLI, sibling implementation, `transformation-matrix` for
pad coordinates, a named source-trace key type and strict capture-source guards.
No new dependencies were introduced.

[The conventions audit](stack-conventions-audit.md) links the pinned handbook
and Seve's direct comments/commits. Its pending-benchmark notes describe the
audit stage; the fresh final results are reported here. The
[equivalence check](stack-conventions-equivalence.json) preserves guide paths,
10,000 sampled costs, every planning/negotiation yield and completed traces on
the three-barriers fixture. It is not performance evidence.

The [original EE/routing research and rejected experiments](https://github.com/tscircuit/bus-lanes-solver/blob/802261f4d8bba90503f7534cf340ab85a0af2ddb/docs/global-bus-corridors/README.md)
remain pinned historical evidence. No broad 24/32-lane scaling improvement is
claimed. Core must expose future byte/strobe/mask groups before a whole-channel
planner can reserve their space and tuning regions.

## Fresh AM3352 and full CI

Both full push and PR suites pass: **611 tests on repro #219**, **623 on fix
#218**, zero failures. Actual unit-test runtime is Bun 1.4.4. Format, typecheck
and package checks pass on both PRs. AM3352 runs are separately pinned to
Bun 1.4.0 and use 3,600 seconds per solver/sample.

Both PRs freshly solve and accept **all eleven AM3352 samples on both
references**, with full matching, DRC, all three pair skew/coupling checks and
immutable fixed-161 power copper. Inputs, full validation objects and iteration
counts match for every pair. No completion is lost or gained; there are no
failures or timeouts. Independent audits pass, all 24 downloaded artifact ZIP
digests match GitHub, and each trusted local report is byte-identical to hosted
CI. Every check on both PRs is green.

The fix has **eight measured per-case runtime increases**. P50 changes
72.735→105.197 seconds (+44.63%), P80 276.018→300.266 (+8.78%), P90
944.996→1007.068 (+6.57%), and P95 1059.117→1325.836 (+25.18%). The
largest per-case increases are inner-layers-right (+44.63%) and control-inner1
(+40.18%). These regressions remain explicit; no general runtime improvement
is claimed. The repro's identical-code paired timings range from −23.16% to
+38.57%, descriptive context that does not dismiss the fix measurements.

- [Repro #219: all eleven cases, matching/skew tables and raw reports](am3352/repro/README.md)
- [Fix #218: all eleven cases, matching/skew tables and raw reports](am3352/fix/README.md)
- [Combined final CI status](am3352/final-status.json)
- [Eleven individually inspected prior completed AM3352 reference images](https://github.com/tscircuit/bus-lanes-solver/blob/802261f4d8bba90503f7534cf340ab85a0af2ddb/docs/global-bus-corridors/am3352-reference-gallery/retained-reference-gallery.md)

Those AM3352 images retain their original `ec82ec2` source and validation;
they are not fresh final-head renders or performance evidence. Fresh current
acceptance is established separately by the paired reports above. Equal
measurements do not establish exact fresh copper identity.
