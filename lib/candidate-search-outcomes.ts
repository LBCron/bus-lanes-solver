import { RoutingMemoryBudgetExceeded, PendingRoutingWorkBudgetExceeded } from "./routing-memory-budget"

/** Resource exhaustion leaves a candidate unknown. Continue the caller's
 * existing domain, and report the last resource error if no candidate solves. */
export class CandidateSearchOutcomes {
  private resourceUnknowns = 0
  private lastResourceError?: RoutingMemoryBudgetExceeded | PendingRoutingWorkBudgetExceeded

  get unknownCount(): number {
    return this.resourceUnknowns
  }

  *run<T>(search: Generator<void, T | null>): Generator<void, T | null> {
    try {
      return yield* search
    } catch (error) {
      if (!(error instanceof RoutingMemoryBudgetExceeded) && !(error instanceof PendingRoutingWorkBudgetExceeded)) throw error
      this.resourceUnknowns++
      this.lastResourceError = error
      return null
    } finally {
      search.return(null)
    }
  }

  noSolution(): null {
    if (this.lastResourceError) throw this.lastResourceError
    return null
  }
}
