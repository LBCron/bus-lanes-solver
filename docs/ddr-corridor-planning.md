# DDR corridor planning

## Engineering basis

DDR layout guidance treats byte lanes as coherent routing groups. NXP AN5097
recommends planning data groups before address/command/control and clocks,
keeping a byte lane on a common critical layer with consistent transitions, and
considering the outermost/longest data lane first. TI's AM62x/AM62Lx guide also
requires placement to leave routing space and reserves the DDR region from
unrelated signals. These are reasons to allocate routing space before committing
individual shortest paths, rather than using shortness as the only objective.

- [NXP AN5097, §§2 and 7](https://community.nxp.com/pwmxy87654/attachments/pwmxy87654/imx-processors/231241/1/AN5097%20Hardware%20and%20Layout%20Design%20Considerations%20for%20DDR4%20SDRAM%20Memory%20Interfaces.pdf)
- [TI SPRAD06C, §§2.5–2.6, 2.15 and 2.17](https://www.ti.com/lit/an/sprad06c/sprad06c.pdf)
- [AMD UG583, General Memory Routing Guidelines](https://docs.amd.com/r/en-US/ug583-ultrascale-pcb-design/General-Memory-Routing-Guidelines)

PCB bus-planning research explicitly considers layer assignment, escape routing,
congestion and bus length bounds together. FastRoute separates coarse global
allocation from detailed routing and broadens congested routes beyond simple
L/Z patterns. PathFinder supplies the complementary idea of negotiated present
and historical congestion: a route can move aside when another needs a scarce
resource. These support movable guides rather than permanent rectangular
partitions.

- [Kong, Tan and Wong, Automatic bus planner for dense PCBs, DAC 2009](https://experts.illinois.edu/en/publications/automatic-bus-planner-for-dense-pcbs/)
- [Wu, Ma and Wong, An ILP-based automatic bus planner for dense PCBs, ASP-DAC 2013](https://experts.illinois.edu/en/publications/an-ilp-based-automatic-bus-planner-for-dense-pcbs/)
- [FastRoute, 2012, §§2–4](https://onlinelibrary.wiley.com/doi/10.1155/2012/608362)
- [McMurchie and Ebeling, PathFinder, 1995](https://janders.eecg.utoronto.ca/1387_2015/readings/pathfinder.pdf)
- [OpenROAD global routing guides](https://openroad.readthedocs.io/en/latest/main/openroad/grt/README.html)

Backward and lateral detours are an algorithmic inference from routability
planning, not a DDR electrical requirement. Their total lengths, matching,
coupling, clearances and transitions still require validation. Permitted net/bit
swaps and controller-specific cross-byte timing rules must not be inferred from
these sources.

## Solver scope

Untimed buses with at least eight requested members now enter joint negotiation
even when their current handoffs share one carrier. The existing dense-search
option remains required. Small fixed-carrier buses previously stayed in serial
winding-order retries, which could spend most of the request budget before a
needed carrier change. Matched and paired requests retain their prior activation
rules. The A64 third data-byte reproduction exercises this public pipeline path
and checks that the supplied copper and accepted route geometry are preserved.

The planning seam is `negotiateLanes`, after fanout has provided reachable
handoffs. A cheap first detailed sweep establishes whether signals actually
compete: coarse tile overflow alone can overestimate contention between legal
parallel tracks. If competition remains, the planner allocates space for all
ordinary bus signals on their existing layers, accounting for width, clearance,
immutable copper and paired routes. It uses at most 4,096 coarse cells and four
negotiation sweeps, then supplies soft spatial costs for supplementary searches.

The planner is eligible only when the entire request has no bus length/skew
constraints and no differential pairs. Coarse lane width alone does not account
for future tuning banks or coupling refinement; changing an untimed neighbor can
also consume a matched bus's tuning space. Such requests retain the established
matching-aware search. Core's untimed DQ phases remain eligible.

Ordinary routes and the active rip-up/history order are retained. Guided searches
run only on the planned layer, when an ordinary route conflicts, during the first
two contention retries, with at most 128 batches of 500 grid expansions each.
Guided paths enter the candidate pool; they can change output only through a
complete compatible assignment. They never displace an ordinary active route
merely because a coarse plan prefers another region. Guide factories retain only
the compact distance field, path and geometry, releasing planning scenes and
occupancy arrays before detailed negotiation resumes.
The detailed router retains continuous geometry checks and its ordinary final
acceptance criteria. A guide is search geometry, never routed copper or evidence
of completion.

Core's pinned ten-board benchmark currently routes each 8-signal byte as a
separate phase, with earlier bytes retained as immutable copper. A bus-lanes
invocation therefore cannot reserve future byte lanes whose requests core has
not supplied. This change can coordinate the signals visible in one request; a
whole-DDR channel planner would additionally require core to expose future
cohorts. The benchmark measures connectivity, routing checks and native-pad
geometry. It does not establish DDR timing or impedance compliance.

The synthetic `tests/negotiated-corridors.test.ts` exercises three signals in a
pocket whose forward opening fits one trace. Two signals must first travel away
from the destination before passing around the pocket. It validates fresh
connectivity, continuous copper DRC and input preservation. Both main and the
revised router can solve this fixture; it guards the integration's routing
capability rather than claiming a new benchmark success.

## Reproducing comparisons

Pin the core revision, its installed dependency graph, the benchmark fixture
revision, Bun version and timeout. Run base and head serially with the same
machine allocation. Core's normal command is:

```sh
bun run benchmark:ddr --timeout 120 --out /tmp/ddr-base
bun run benchmark:ddr --timeout 120 --out /tmp/ddr-head
```

The two runs must resolve `@tscircuit/bus-lanes-solver` to the recorded base and
head builds respectively. Keep every other dependency unchanged. The benchmark
reporter can compare their retained JSON:

```sh
bun node_modules/@tscircuit/core-ddr-benchmark/scripts/report.ts \
  /tmp/ddr-head/results.json /tmp/ddr-base/results.json /tmp/ddr-comparison.md
```

For this repository's AM3352 benchmark, use the same base harness and fixture
set for both solver modules, including full matching and coupling validation:

```sh
./benchmark.sh --solver /absolute/path/to/base/lib/index.ts \
  --timeout-seconds 3600 --output /tmp/am3352-base.json
./benchmark.sh --solver /absolute/path/to/head/lib/index.ts \
  --timeout-seconds 3600 --output /tmp/am3352-head.json
```

The PR's Blacksmith `AM3352 benchmark` workflow runs every declared sample with
paired base/head fresh solves and retains raw reports. Report solved counts,
connectivity, DRC, copper-length skew, pair skew/coupling, runtime and all
regressions separately; saved-output revalidation does not replace a fresh run.
