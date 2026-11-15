import type { Obstacle } from "./types"

type ConnectivityAlias = Obstacle["connectedTo"][number]
type ConnectedPadGroup = {
  pads: Set<Obstacle>
  aliases: Set<ConnectivityAlias>
}

/** Retain pad and group order while merging each electrical alias group once. */
export function getConnectedPadGroups(pads: Obstacle[]): Set<Obstacle>[] {
  const groups = new Map<ConnectivityAlias, ConnectedPadGroup>()
  for (const pad of pads) {
    const touching = new Set(
      pad.connectedTo.flatMap((alias) =>
        groups.has(alias) ? [groups.get(alias)!] : [],
      ),
    )
    const group: ConnectedPadGroup = {
      pads: new Set([
        pad,
        ...[...touching].flatMap((previous) => [...previous.pads]),
      ]),
      aliases: new Set([
        ...pad.connectedTo,
        ...[...touching].flatMap((previous) => [...previous.aliases]),
      ]),
    }
    for (const alias of group.aliases) groups.set(alias, group)
  }
  return [...new Set(groups.values())].map((group) => group.pads)
}
