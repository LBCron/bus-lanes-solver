# Bus corridor and OrangeCrab stack conventions audit

Reviewed original solver revision `190325da97253ad7951f9dfd3b0046b4afcb5395`.
Conventions fixes were implemented in `/workspace/bus-lanes-conventions` and
committed by the parent agent as `fcd6df51427f644a06bf332d166681e2ccc22492`.
This agent made no GitHub mutations or commits. No further source changes are
planned from this audit.

## Authoritative sources

- [tscircuit handbook code guidance, pinned e9aca72](https://github.com/tscircuit/handbook/blob/e9aca72f4e0f79a8ebcdf29c28d8f3faad80eda2/guides/code.md): two-parameter rule, context passing, banned vague names, naming/casing, domain-named Map keys, hoisted named helpers, and avoiding `as any`/`as unknown`.
- [Seve's direct core review](https://github.com/tscircuit/core/pull/422#discussion_r1885804180): “We never use more than two parameters in a function”; use named parameters or a small shared context. The same review requests moving substantial implementation out of the high-level component module.
- [Seve-authored named Map key rule](https://github.com/tscircuit/handbook/commit/3d73d2763858110ebc3c5a981bc93624a6822d0b): explicitly adds the prohibition on `Map<string, ...>` in favor of named/branded domain keys.
- [Seve-authored AI code guidance](https://github.com/tscircuit/handbook/commit/671fd4530d2d7d50c321b946fc89484c9aa55bee): introduces the guidance about clear module boundaries, hoisting named closures and preserving type checking.
- [Handbook community culture](https://github.com/tscircuit/handbook/blob/e9aca72f4e0f79a8ebcdf29c28d8f3faad80eda2/guides/community-culture.md): asks for tests and visual snapshots, thoughtful APIs and clear names.
- [Handbook benchmark conventions](https://github.com/tscircuit/handbook/blob/e9aca72f4e0f79a8ebcdf29c28d8f3faad80eda2/guides/benchmark-sh.md): complete datasets by default, useful per-case logs with durations, and rounded P50/P95/average reporting.
- [Seve's project-specific artifact allowance](https://github.com/tscircuit/bus-lanes-solver/pull/100#discussion_r4385481950): in reply to a request to remove `docs/` artifacts, Seve says “for this project i've been allowing it to see if it allows for better outcomes”. This is not a blanket instruction to remove the research/results artifacts.
- Repository [AGENTS.md](https://github.com/tscircuit/bus-lanes-solver/blob/202b034659fb96bad44d11b8190f4044b675116f/AGENTS.md): branch/PR workflow; completed-route artifact gates and specific failed-baseline exceptions; pinned paired benchmarks; honest failure/runtime reporting; fresh Blacksmith 11/11 AM3352 acceptance; immutable fanout outputs.

These are recorded instructions and direct Seve comments. I did not infer
additional personal preferences from unrelated repositories or silently apply a
no-documentation rule that conflicts with the project-specific comment.

## Concrete findings and changes made

1. **New planner API exceeded two parameters.** `planBusCorridors` had five
   positional parameters, and the new guide `costAt` method had three. The
   planner now accepts one named object containing its input, connections,
   fixed copper, widths and optional terminal layers. Guide costs accept a
   `Terminal` object. Production and all test call sites were updated.

2. **New planner maps had anonymous string keys.** The new planner, its
   negotiation integration and new tests now use domain key aliases
   `ConnectionName` and `CopperLayerName`. The aliases remain structurally
   compatible with existing connection/layer names. Existing unrelated legacy
   map declarations and public constructor signatures were not mass-refactored.

3. **The large planner declared named local helpers.** Grid-point/cell lookup,
   edge clipping/interpolation, coarse routing, footprint allocation, usage
   updates and overflow calculation are now module-scope helpers. They share
   one explicit `CorridorPlanningContext`; no new service/framework or family
   of unrelated contexts was introduced. Arithmetic, direction order, insertion
   order, limits and cooperative yield points were preserved. The separate
   guide factory still retains only guide geometry/distance fields, rather
   than retaining planner scenes or occupancy state.

4. **Native byte eligibility implementation expanded the high-level solver
   constructor.** The exact eligibility expression is now the sibling helper
   `shouldNegotiateUntimedBus({ input, options })`. The constructor remains a
   high-level call and caches the same Boolean. Scope and short-circuit logic
   remain unchanged.

5. **New tests included named helpers inside test callbacks and a vague
   `data` variable.** The planning helper and guide-cost callback were hoisted
   to module scope. The bus object is called `untimedBus`. Domain-semantic
   fixture labels such as DDR data buses were not blindly renamed. Assertions,
   fixtures, physical thresholds and accepted routing constraints remain
   unchanged. The A64 test required no style edits.

The production implementation remains in `lib/`, tests remain in `tests/`,
file names follow the repository's kebab-case convention, new typed APIs do not
use `as any` or `as unknown`, and the package entrypoint was not expanded with
implementation details. No new rendering coordinate transformations were added
by this refactor; the new repro should use the existing Circuit JSON renderer
rather than manually scaling the PCB into an SVG.

## Verification

- `bun run typecheck`: passed.
- `bun run format:check`: passed; Biome checked 719 files, no fixes needed.
- Eleven planner/cost/candidate tests: passed.
- A64 public default-pipeline regression with the repository CI test budget:
  `bun test --timeout 120000 tests/a64-byte2-early-negotiation.test.ts`:
  passed, 76 assertions, approximately 9.550 seconds. Its assertions preserve
  exact expected routes, the supplied 16 traces, endpoints/layers, input
  immutability and native DRC.
- The first combined local test invocation used Bun's default 5-second test
  budget and reported an A64 harness timeout after 9.289 seconds. It is
  explicitly retained in `stack-conventions-targeted-tests.log`; there was no
  reported functional assertion failure. Only the timed-out A64 test was
  rerun, using the same 120,000-ms budget already specified in this repository's
  `.github/workflows/bun-test.yml`. No source timeout or physical constraint
  was increased.
- Supplementary three-barriers equivalence check against original `190325d`:
  all guide paths, 10,000 sampled guide costs, all 12 planning yields, all
  1,191 detailed negotiation yields, and final accepted trace arrays compare
  exactly. This is an equivalence guard, not fresh benchmark performance
  evidence. Report: `/workspace/ddr-results/stack-conventions-equivalence.json`.

Durable logs are `/workspace/ddr-results/stack-conventions-targeted-tests.log`,
`stack-conventions-a64-test.log`, and `stack-conventions-format.log`. The
equivalence harness is `stack-conventions-equivalence.ts` in the same directory.

## Requirements for the requested repro/fix stack

- Keep the repro branch's solver behavior equal to pinned main. Put the
  captured OrangeCrab baseline and its source/runtime/provenance in the repro
  PR; replace exactly the same tracked SVG path in the stacked fix PR. This
  produces the actual GitHub before/after image diff the user requested.
- The failed full-board baseline is newly and explicitly user-authorized. A
  narrow full-board OrangeCrab exception can be documented alongside the
  existing three OrangeCrab baseline exceptions in AGENTS.md. Do not broaden
  that exception to failed AM3352 images or unaccepted candidate copper.
- Label the captured main state as the actual 120-second timeout with 16/50
  connected nets. Render only accepted completed-byte copper, native pads and
  board geometry. The completed fix snapshot must use the actual accepted
  50/50 output and retain the independent connectivity/DRC assessment. A
  caption or an SVG existing on disk does not establish completion.
- Do not introduce a flaky assertion that main must always fail at that wall
  time. Main completed OrangeCrab in an earlier selected repeat. The capture
  demonstrates the observed budget-sensitive outcome, not a deterministic
  isolated solver bug or a guaranteed extra board completion.
- Preserve source identity: the old `190325d` benchmark evidence must remain
  labeled as that revision. The conventions refactor and new stacked head
  require final-revision paired core/AM3352 measurements and current PR
  descriptions. Exact output-equivalence checks do not replace fresh solve
  performance or the required Blacksmith 11/11 acceptance gate.
- Inspect both the baseline and completed replacement SVG renderings, keep
  viewport/scale consistent, and retain fixed fanout provenance and the
  complete-output gate. Keep failed diagnostic images outside the ordinary
  AM3352 completed gallery.

No remaining actionable handbook violation was found in the new planner code
after these changes. This was a conventions review and limited targeted
verification; it does not replace the parent agent's final full-suite, core
DDR and Blacksmith validation for the new stacked revisions.

## FINAL STACK

The published stack is [repro PR #219](https://github.com/tscircuit/bus-lanes-solver/pull/219)
at `2af1bd6f4f7481a10afcf9c475f9b7dfe92f9e95`, with
[fix PR #218](https://github.com/tscircuit/bus-lanes-solver/pull/218) stacked above
it at `358604c0e7f8bee42d0aef488807239c322198c6`. Both revisions are frozen
for final validation.

The repro's final read-only audit confirmed a 32-line high-level CLI with
capture/validation/render implementation in a sibling module; native pad
transforms use `transformation-matrix`; the trace-owner Map has the named
`SourceTraceId` key; the CLI uses `captureState`; and import/replay gates check
the expected source, core, fixture, benchmark-package and harness provenance.
These address the existing handbook's entrypoint, named Map key, clear naming,
two-parameter and 2D transformation rules cited above. No actionable findings
remained after the producer's fixes.

The six-layer baseline and completed SVG renderings were inspected by the root
agent. This review independently checked the six layer labels, fixed viewport,
panel bounds and absence of duplicate actual SVG IDs. The producer confirmed
the cleanup preserved both SVG and PNG bytes. The retained baseline capture is
from solver `202b034659fb96bad44d11b8190f4044b675116f`; the retained completed
capture is from `190325da97253ad7951f9dfd3b0046b4afcb5395`. Their labels and
provenance remain distinct from the final stack's fresh benchmark source pins.

Fresh core comparisons for both final revisions (twenty board runs in total)
and the eleven-sample AM3352 comparisons are running. This section records no
final outcome for those runs; earlier source results and retained-image
revalidation must not be substituted for the final stack's measurements.
