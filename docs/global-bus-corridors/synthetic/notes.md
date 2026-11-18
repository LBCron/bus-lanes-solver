# Synthetic diagnostic evidence

These are exploratory routing diagnostics, not the required final core or
AM3352 benchmark comparisons. The captured scripts retain the exact workspace
paths used for the runs; substitute base/head checkout paths to replay them.
The JSON reports retain source hashes, budgets, every outcome and completed
copper metrics. The source hashes precede the final eligibility guard; these
fixtures are untimed and unpaired. The shorter three-barrier case is also a
fresh-solve regression test in the final PR source.

The 12-case family at a 1,500-yield budget completed 10/12 on main and 9/12
with supplementary guides. Two shared successes used less copper. Seed 4
missed the tight head budget because the added work consumed yields. These
results do not establish a solve-rate or scaling improvement.

Five/eight-signal preservation cases used the same 11/17 yields and copper as
main. Sixteen signals retained identical completed copper with 2,318 versus
2,227 yields. The original 24/32 cases both exhausted 5,000 yields, but their
single-layer, fixed-handoff geometry has an independent capacity issue: a vertical cut through the wall
leaves three center tracks and ten tracks in each outside bypass (0.1 mm width,
0.1 mm clearance, 0.1 mm board-edge clearance), at most 23 tracks. Their failure
cannot establish an algorithmic scaling limit. Fair larger tests must widen
the bypass channels with lane demand. This cut bound is a geometric analysis,
not an unroutability certificate produced by the coarse planner.
