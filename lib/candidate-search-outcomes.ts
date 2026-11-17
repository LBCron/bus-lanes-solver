import { RoutingMemoryBudgetExceeded } from "./routing-memory-budget"

/** Resource exhaustion leaves a candidate unknown. Continue the caller's
 * existing domain, and report the last resource error if no candidate solves. */
export class CandidateSearchOutcomes {
  private memoryUnknowns = 0
  private lastMemoryError?: RoutingMemoryBudgetExceeded

  get unknownCount(): number {
    return this.memoryUnknowns
  }

  *run<T>(search: Generator<void, T | null>): Generator<void, T | null> {
    try {
      return yield* search
    } catch (error) {
      if (!(error instanceof RoutingMemoryBudgetExceeded)) throw error
      this.memoryUnknowns++
      this.lastMemoryError = error
      return null
    } finally {
      search.return(null)
    }
  }

  noSolution(): null {
    if (this.lastMemoryError) throw this.lastMemoryError
    return null
  }
}
