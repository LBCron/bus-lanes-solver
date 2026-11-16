# Handheld Gaming Console connectivity regression

This fixture preserves native pad positions and all 65 requested signals. Its
fresh solve requires complete connectivity, endpoint continuity, copper
clearance, drill spacing and self-clearance before exporting a routed snapshot.
No saved routes seed the solve.

![Fresh validated connectivity result](board.snap.svg)

Run the regression from the repository root:

    bun test ./tests/handheld-routing-snapshot.test.ts

The test uses the repository-standard `toMatchSvgSnapshot(import.meta.path)`
matcher and compares against
`tests/__snapshots__/handheld-routing-snapshot.snap.svg`.

Regenerate the completed board image with:

    bun repros/handheld-gaming-console/routing-snapshot.ts

The runner has a 600-second cooperative budget. The active fixture uses six
physical layers; the original eight-layer native board, input and historical
failure metadata remain preserved for provenance. Input-only diagnostic images
can be generated locally with `snapshot.ts` and are excluded from Git.

The result establishes connectivity geometry. All six DDR bus groups still
fail length matching, and differential coupling remains unresolved. Completed
connectivity does not establish DDR timing or manufacturing readiness.

The solver PR also retains the first-via search alternatives required for drill
clearance and deduplicates physical vias shared by fixed branches. Existing
valid layouts keep their original search order. Failed layouts may require an
additional search attempt.

Run the drill-clearance regressions and seeded completion controls with:

    bun test tests/connectivity-review-regressions.test.ts tests/connectivity-completion-preservation.test.ts

Benchmark acceptance requires fresh paired solves of all eleven AM3352 cases
against the pinned main revision, including connectivity, DRC, total-copper bus
and pair skew, coupling and fixed-copper preservation. Current measurements and
revision IDs belong in the PR description and workflow artifacts.
