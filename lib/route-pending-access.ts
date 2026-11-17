import { finishGeneratedSurfaceCarriers } from "./finish-generated-surface-carriers"
import { negotiateSurfaceRoutes } from "./negotiate-surface-routes"
import { PendingPadAccess } from "./pending-pad-access"
import { runBoundedRouting } from "./run-bounded-routing"
import type { SimpleRouteJson, SolverOptions, Trace } from "./types"

/** Admit a complete route union only while declared future pads retain their
 * demonstrated physical access. A lost obligation activates the same native
 * surface candidate domain used for ordinary negotiated copper conflicts. */
export function* routePendingAccess({
  input,
  traces,
  options,
  maxSteps,
  access,
}: {
  input: SimpleRouteJson
  traces: Trace[]
  options: SolverOptions
  maxSteps: number
  access: PendingPadAccess
}): Generator<void, Trace[] | null> {
  if (!(yield* access.getBlockedConnections(traces)).length) return traces
  const joint = yield* runBoundedRouting(
    negotiateSurfaceRoutes(input, {
      native: input,
      pending: input,
      escapes: [],
      retained: [],
      traces,
    }),
    maxSteps,
  )
  if (!joint) return null
  const finished = yield* finishGeneratedSurfaceCarriers({
    input,
    carriers: [...joint.retained, ...joint.traces],
    escapes: joint.escapes,
    options,
    maxSteps,
  })
  if (
    !finished ||
    (yield* access.getBlockedConnections(finished.traces)).length
  )
    return null
  return finished.traces
}
