# Exploratory comparisons

These are diagnostics from superseded implementations, not the final-revision
benchmark result. The primary report in the parent directory identifies final
source `190325da97253ad7951f9dfd3b0046b4afcb5395`.

`ff428a3/` retains an earlier ten-board comparison and selected paired A64 and
OrangeCrab repeats. The original head run connected only 24 A64 nets before its
deadline; final source must be evaluated separately. OrangeCrab also completed
on the repeated main run, so its original timeout-to-pass change cannot by
itself establish an algorithmic improvement. No failed or intermediate routing
images are included.

The synthetic diagnostic family is in `../synthetic/`. It includes every
recorded outcome, including its tight-budget completion regression. It does
not demonstrate a general scaling or throughput improvement.
