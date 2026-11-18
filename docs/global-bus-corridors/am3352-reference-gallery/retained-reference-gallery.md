# Prior completed AM3352 reference images

These eleven images are retained references from solver source
`ec82ec2442d6c03f680d3f9735b94877a3e83559`, exported on 2026-10-26. They
are **not freshly generated head outputs**, and their exact copper identity with
current head output has not been established. The current PR's fresh paired CI
solves and validation reports are separate evidence of current completion and
performance.

The original gallery is pinned in baseline main `202b034659fb96bad44d11b8190f4044b675116f`:
[images and original reports](https://github.com/tscircuit/bus-lanes-solver/tree/202b034659fb96bad44d11b8190f4044b675116f/docs/am3352-native-carrier-regression).
Its original [artifact manifest](https://github.com/tscircuit/bus-lanes-solver/blob/202b034659fb96bad44d11b8190f4044b675116f/docs/am3352-native-carrier-regression/artifact-manifest.json)
records each image SHA-256, original input/trace/output hashes, source identity,
full validation and original inspection provenance. All eleven current PNG byte
hashes match that manifest. The source benchmark hash also matches the report
values serialized as two-space JSON plus a final newline; repository formatting
changed its byte representation, not those parsed values.

Every original recorded sample is successfully solved at 47/47 signals, with
complete connectivity, full bus/pair matching, clean fixed and combined copper
DRC, matched pair gaps, no validation issues, and 161 preserved fixed power
traces, vias and pad joins. This is a check of the original reports and manifest;
no retained route geometry has been rerouted or revalidated during this review.

All eleven original-resolution PNGs were individually reopened for this PR.
Four labeled physical-layer panels, native pads and fixed fanout copper are
visible. Carrier counts sum to 47; their distributions agree with the recorded
reports. Titles, status and skew labels are readable and unclipped. The gallery
contains completed copper, not search paths, provisional candidates or dashed
unrouted guides. No visual blockers were found. Numerical clearance, matching
and coupling acceptance comes from the recorded validation, not visual inspection.

| Image | Visible carrier distribution | Inspection |
| --- | --- | --- |
| [control](https://github.com/tscircuit/bus-lanes-solver/blob/202b034659fb96bad44d11b8190f4044b675116f/docs/am3352-native-carrier-regression/control.png) | inner1 19, inner2 16, bottom 12 | Passed |
| [control-inner1](https://github.com/tscircuit/bus-lanes-solver/blob/202b034659fb96bad44d11b8190f4044b675116f/docs/am3352-native-carrier-regression/control-inner1.png) | inner1 47 | Passed |
| [right](https://github.com/tscircuit/bus-lanes-solver/blob/202b034659fb96bad44d11b8190f4044b675116f/docs/am3352-native-carrier-regression/right.png) | inner1 21, inner2 18, bottom 8 | Passed |
| [left](https://github.com/tscircuit/bus-lanes-solver/blob/202b034659fb96bad44d11b8190f4044b675116f/docs/am3352-native-carrier-regression/left.png) | inner1 18, inner2 20, bottom 9 | Passed |
| [above](https://github.com/tscircuit/bus-lanes-solver/blob/202b034659fb96bad44d11b8190f4044b675116f/docs/am3352-native-carrier-regression/above.png) | inner1 18, inner2 15, bottom 14 | Passed |
| [inner-layers](https://github.com/tscircuit/bus-lanes-solver/blob/202b034659fb96bad44d11b8190f4044b675116f/docs/am3352-native-carrier-regression/inner-layers.png) | inner1 24, inner2 23 | Passed |
| [inner-layers-right](https://github.com/tscircuit/bus-lanes-solver/blob/202b034659fb96bad44d11b8190f4044b675116f/docs/am3352-native-carrier-regression/inner-layers-right.png) | inner1 22, inner2 25 | Passed |
| [inner-layers-left](https://github.com/tscircuit/bus-lanes-solver/blob/202b034659fb96bad44d11b8190f4044b675116f/docs/am3352-native-carrier-regression/inner-layers-left.png) | inner1 28, inner2 19 | Passed |
| [inner-layers-above](https://github.com/tscircuit/bus-lanes-solver/blob/202b034659fb96bad44d11b8190f4044b675116f/docs/am3352-native-carrier-regression/inner-layers-above.png) | inner1 21, inner2 26 | Passed |
| [inner-layers-complete-ca](https://github.com/tscircuit/bus-lanes-solver/blob/202b034659fb96bad44d11b8190f4044b675116f/docs/am3352-native-carrier-regression/inner-layers-complete-ca.png) | inner1 19, inner2 28 | Passed |
| [outer-layers](https://github.com/tscircuit/bus-lanes-solver/blob/202b034659fb96bad44d11b8190f4044b675116f/docs/am3352-native-carrier-regression/outer-layers.png) | top 8, bottom 39 | Passed |

Comparison of these original reports with all eleven fresh final-head pairs is pending the last two CI samples. Fresh current acceptance and performance must be read from the paired Blacksmith reports, separately from this retained image inspection.
