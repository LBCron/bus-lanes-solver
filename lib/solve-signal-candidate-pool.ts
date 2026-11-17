import { pruneCandidateDomains } from "./prune-candidate-domains"

/** Select one mutually compatible candidate per connection. Arc consistency
 * runs before bounded backtracking; returned references keep the input order. */
export function solveSignalCandidatePool<T>(
  domains: readonly (readonly T[])[],
  compatible: (first: T, second: T) => boolean,
  maxSearchNodes = 4000,
  maxSupportChecks = 1_000_000,
): T[] | null {
  const search = solveSignalCandidatePoolSteps({
    domains,
    compatible,
    maxSearchNodes,
    maxSupportChecks,
  })
  let step = search.next()
  while (!step.done) step = search.next()
  return step.value
}

/** The same bounded domain search with a cooperative whole-selection
 * constraint. Pairwise compatibility cannot represent collective enclosure. */
export interface SignalCandidatePoolOptions<T> {
  domains: readonly (readonly T[])[]
  compatible: (first: T, second: T) => boolean
  maxSearchNodes?: number
  maxSupportChecks?: number
  acceptSelection?: (selection: T[]) => Generator<void, boolean>
}

interface CandidateSearchState<T> {
  compatible: SignalCandidatePoolOptions<T>["compatible"]
  acceptSelection: SignalCandidatePoolOptions<T>["acceptSelection"]
  maxSearchNodes: number
  nodes: number
  selected: T[]
  assigned: Uint8Array
}

export function* solveSignalCandidatePoolSteps<T>({
  domains,
  compatible,
  maxSearchNodes = 4000,
  maxSupportChecks = 1_000_000,
  acceptSelection,
}: SignalCandidatePoolOptions<T>): Generator<void, T[] | null> {
  const initial = pruneCandidateDomains(domains, compatible, maxSupportChecks)
  if (!initial) return null
  return yield* visitSignalCandidateDomains({
    remaining: initial,
    state: {
      compatible,
      acceptSelection,
      maxSearchNodes,
      nodes: 0,
      selected: new Array(initial.length),
      assigned: new Uint8Array(initial.length),
    },
  })
}

function* visitSignalCandidateDomains<T>({
  remaining,
  state,
}: {
  remaining: T[][]
  state: CandidateSearchState<T>
}): Generator<void, T[] | null> {
  const { assigned, selected, compatible, acceptSelection, maxSearchNodes } =
    state
  if (++state.nodes > maxSearchNodes) return null
  let next = -1
  for (let index = 0; index < remaining.length; index++) {
    if (assigned[index]) continue
    if (!remaining[index].length) return null
    if (next < 0 || remaining[index].length < remaining[next].length)
      next = index
  }
  if (next < 0) {
    const answer = selected.slice()
    return !acceptSelection || (yield* acceptSelection(answer)) ? answer : null
  }
  for (const candidate of remaining[next]) {
    selected[next] = candidate
    assigned[next] = 1
    const filtered = remaining.map((domain, index) =>
      assigned[index]
        ? domain
        : domain.filter((other) => compatible(candidate, other)),
    )
    const answer = filtered.some(
      (domain, index) => !assigned[index] && !domain.length,
    )
      ? null
      : yield* visitSignalCandidateDomains({ remaining: filtered, state })
    if (answer) return answer
    assigned[next] = 0
    if (state.nodes >= maxSearchNodes) break
  }
  return null
}
