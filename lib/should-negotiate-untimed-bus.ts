import { getCopperLayerNames } from "@tscircuit/fanout-solver"
import { isUnroutedComponentPad } from "./is-unrouted-component-pad"
import type { SimpleRouteJson, SolverOptions } from "./types"

/** Reach inner-carrier retries early for native unicast byte buses while
 * preserving the established search for timed, surface-only and branched buses. */
export function shouldNegotiateUntimedBus({
  input,
  options,
}: {
  input: SimpleRouteJson
  options: SolverOptions
}): boolean {
  const names = new Set(input.connections.map((connection) => connection.name))
  const innerCarriers = getCopperLayerNames(input.layerCount).filter(
    (layer) =>
      /^inner\d+$/.test(layer) &&
      (!input.allowedLayers || input.allowedLayers.includes(layer)),
  )
  return (
    !options.preserveBranchAccess &&
    !input.differentialPairs?.length &&
    !!input.buses?.length &&
    !input.buses.some(
      (bus) =>
        bus.minLength !== undefined ||
        bus.maxLength !== undefined ||
        bus.maxLengthSkew !== undefined,
    ) &&
    input.connections.every(
      (connection) =>
        connection.pointsToConnect.length === 2 &&
        connection.pointsToConnect.every((point) =>
          isUnroutedComponentPad(input, connection, point),
        ),
    ) &&
    input.buses.some(
      (bus) =>
        new Set(bus.connectionNames.filter((name) => names.has(name))).size >=
          8 &&
        innerCarriers.some(
          (layer) => !bus.allowedLayers || bus.allowedLayers.includes(layer),
        ),
    )
  )
}
