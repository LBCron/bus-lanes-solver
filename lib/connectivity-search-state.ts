/** Carrier labels retain the first via when it constrains the possible exits.
 * Unrestricted labels share the original dense cell/stage arrays. */
export class ConnectivitySearchState {
  best: Float64Array
  parent: Int32Array
  private cells: number[] = []
  private firstVias: number[] = []
  private labels = new Map<number, Map<number, number>>()
  constructor(readonly cellCount: number) {
    this.best = new Float64Array(cellCount * 3)
    this.parent = new Int32Array(cellCount * 3)
  }
  reset() {
    this.best.fill(Infinity)
    this.cells.length = 0
    this.firstVias.length = 0
    this.labels.clear()
  }
  cell(id: number) {
    return id < this.cellCount * 3
      ? id % this.cellCount
      : this.cells[id - this.cellCount * 3]
  }
  stage(id: number) {
    return id < this.cellCount * 3 ? Math.floor(id / this.cellCount) : 1
  }
  firstVia(id: number) {
    return id < this.cellCount * 3
      ? -1
      : this.firstVias[id - this.cellCount * 3]
  }
  carrierId(cell: number, firstVia: number) {
    if (firstVia < 0) return this.cellCount + cell
    let group = this.labels.get(firstVia)
    if (!group) this.labels.set(firstVia, (group = new Map()))
    const previous = group.get(cell)
    if (previous !== undefined) return previous
    const id = this.cellCount * 3 + this.cells.length
    if (id >= this.best.length) {
      const best = new Float64Array(this.best.length * 2).fill(Infinity)
      const parent = new Int32Array(best.length)
      best.set(this.best)
      parent.set(this.parent)
      this.best = best
      this.parent = parent
    }
    this.cells.push(cell)
    this.firstVias.push(firstVia)
    group.set(cell, id)
    return id
  }
}
