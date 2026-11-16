import {
  finishGeneratedSurfaceCarriers,
  type CompletedGeneratedSurfaceCarriers,
} from "./finish-generated-surface-carriers"
import { negotiateSignalSites } from "./negotiate-signal-sites"
import { runBoundedRouting } from "./run-bounded-routing"
import type { SimpleRouteJson, SolverOptions } from "./types"

const PAD_EDGE_PROBE_STEPS = 3000

interface GeneratedSignalSitesRequest {
  input: SimpleRouteJson
  options: SolverOptions
  maxSteps: number
}

/** Keep new pad approaches and carrier layers negotiable when adjacent via
 * allocation falls back to the native surface. Supplied copper remains fixed. */
export function* routeGeneratedSignalSites(
  request: GeneratedSignalSitesRequest,
): Generator<void, CompletedGeneratedSurfaceCarriers | null> {
  // Try the additional drill-clear sites together before freezing a grid
  // assignment. Keep this probe bounded before the ordinary site search.
  if (request.maxSteps > 2 * PAD_EDGE_PROBE_STEPS) {
    const padEdgeRoute = yield* runBoundedRouting(
      completeGeneratedSignalSites(request, [true]),
      PAD_EDGE_PROBE_STEPS,
    )
    if (padEdgeRoute) return padEdgeRoute
  }
  return yield* completeGeneratedSignalSites(request)
}

function* completeGeneratedSignalSites(
  { input, options, maxSteps }: GeneratedSignalSitesRequest,
  allowPadEdgeSitesByAttempt = [false, true],
): Generator<void, CompletedGeneratedSurfaceCarriers | null> {
  const routed = yield* runBoundedRouting(
    negotiateGeneratedSignalSites(input, allowPadEdgeSitesByAttempt),
    maxSteps,
  )
  if (!routed) return null
  return yield* finishGeneratedSurfaceCarriers({
    input,
    carriers: routed.traces,
    escapes: routed.escapes,
    options,
    maxSteps,
  })
}

function* negotiateGeneratedSignalSites(
  input: SimpleRouteJson,
  allowPadEdgeSitesByAttempt: boolean[],
): ReturnType<typeof negotiateSignalSites> {
  // The ordinary fallback visits grid sites before expanding pad-edge sites.
  for (const allowPadEdgeSites of allowPadEdgeSitesByAttempt) {
    const routed = yield* negotiateSignalSites(
      { native: input, pending: input, escapes: [], retained: [], traces: [] },
      new Set(input.connections.map((connection) => connection.name)),
      false,
      true,
      {
        checkEscapeCompatibility: true,
        allowExpandedSites: true,
        expandEmptyDomainsOnly: !allowPadEdgeSites,
        allowPadEdgeSites,
        maxCandidateSearchNodes: 12000,
      },
    )
    if (routed) return routed
  }
  return null
}
