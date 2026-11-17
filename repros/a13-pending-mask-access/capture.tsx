import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { gunzipSync, gzipSync } from "node:zlib"
import { NativeDdrBoard } from "./circuits/native-ddr-board"
import type { SimpleRouteJson } from "../../lib"

const corePath = process.argv[2]
if (!corePath) throw Error("Usage: bun capture.tsx /path/to/core")
const { RootCircuit } = await import(resolve(corePath, "index.ts"))
const circuit = new RootCircuit()
const requests: SimpleRouteJson[] = []
circuit.on(
  "autorouting:start",
  (event: { simpleRouteJson: SimpleRouteJson }) => {
    const request = event.simpleRouteJson
    requests.push(request)
    if (requests.length !== 5) return
    const fixture = {
      ramByte0Request: requests[2],
      ramByte1Request: requests[3],
      fixedConnections: requests
        .slice(0, 2)
        .flatMap((phase) => phase.connections),
      maskConnections: request.connections.filter((connection) =>
        ["source_net_76", "source_net_77"].includes(connection.name),
      ),
      circuit: circuit
        .getCircuitJson()
        .filter(
          (element: { type: string }) =>
            !["pcb_trace", "pcb_via"].includes(element.type),
        ),
    }
    writeFileSync(
      new URL(
        "../../tests/fixtures/a13-pending-mask-access/input.json.gz",
        import.meta.url,
      ),
      gzipSync(JSON.stringify(fixture)),
    )
    process.exit(0)
  },
)
const source = JSON.parse(
  gunzipSync(
    readFileSync(new URL("./circuits/a13.json.gz", import.meta.url)),
  ).toString(),
)
circuit.add(<NativeDdrBoard source={source} />)
await circuit.renderUntilSettled()
throw Error("A13 did not reach its remaining-signal routing phase")
