import { expect, test } from "bun:test"
import { Buffer } from "node:buffer"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"

type PublicPackage = { name: string; version: string; url?: string }
type NpmPack = {
  name: string
  version: string
  filename: string
  integrity: string
  shasum: string
}

// Exact Core914 versions that are statically imported by the unmodified native
// H3 test, its RootCircuit/catalogue, and the repository's normal test preload.
// The declared bus control/consumer package is handled by its own normal build.
const packages: PublicPackage[] = [
  { name: "@dagrejs/dagre", version: "2.0.4" },
  { name: "@tscircuit/capacity-autorouter", version: "0.0.1109" },
  { name: "@tscircuit/checks", version: "0.0.279" },
  { name: "@tscircuit/circuit-json-util", version: "0.0.131" },
  { name: "@tscircuit/copper-pour-solver", version: "0.0.74" },
  { name: "@tscircuit/create-fdm-enclosure", version: "0.0.6" },
  { name: "@tscircuit/fanout-solver", version: "0.0.84" },
  { name: "@tscircuit/footprinter", version: "0.0.451" },
  { name: "@tscircuit/math-utils", version: "0.0.39" },
  { name: "@tscircuit/modelprinter", version: "0.0.37" },
  { name: "@tscircuit/props", version: "0.0.732" },
  { name: "circuit-json", version: "0.0.551" },
  { name: "circuit-json-to-spice", version: "0.0.47" },
  { name: "circuit-to-svg", version: "0.0.460" },
  { name: "jscad-fiber", version: "0.0.93" },
  {
    name: "@tscircuit/dogbone-solver",
    version: "0.0.4",
    url: "https://jscdn.tscircuit.com/@tscircuit/dogbone-solver/0.0.4.tgz",
  },
  {
    name: "@tscircuit/flex-utils",
    version: "0.0.8",
    url: "https://jscdn.tscircuit.com/@tscircuit/flex-utils/0.0.8.tgz",
  },
  {
    name: "@tscircuit/schematic-trace-solver",
    version: "0.0.246",
    url: "https://jscdn.tscircuit.com/@tscircuit/schematic-trace-solver/0.0.246.tgz",
  },
]

const hash = ({
  algorithm,
  bytes,
  encoding,
}: {
  algorithm: string
  bytes: Buffer
  encoding: "hex" | "base64"
}) => createHash(algorithm).update(bytes).digest(encoding)

async function emitPublicPackage(
  requested: PublicPackage,
  temporary: string,
): Promise<void> {
  let filename: string
  let bytes: Buffer
  let registryIntegrity: string | undefined
  let registryShasum: string | undefined
  if (requested.url) {
    // These URLs are the exact public archive dependencies in Core914. No
    // scripts execute and no tar content is extracted onto the CI filesystem.
    const response = await fetch(requested.url, {
      signal: AbortSignal.timeout(60_000),
    })
    expect(response.ok).toBe(true)
    bytes = Buffer.from(await response.arrayBuffer())
    filename = requested.name.replaceAll("/", "-").replaceAll("@", "") + ".tgz"
    writeFileSync(join(temporary, filename), bytes)
  } else {
    const results: NpmPack[] = JSON.parse(
      execFileSync(
        "npm",
        [
          "pack",
          requested.name + "@" + requested.version,
          "--registry=https://registry.npmjs.org",
          "--ignore-scripts",
          "--json",
          "--pack-destination",
          temporary,
        ],
        { encoding: "utf8", timeout: 60_000, maxBuffer: 16 * 1024 * 1024 },
      ),
    )
    expect(results).toHaveLength(1)
    const packed = results[0]!
    expect(packed.name).toBe(requested.name)
    expect(packed.version).toBe(requested.version)
    expect(basename(packed.filename)).toBe(packed.filename)
    filename = packed.filename
    bytes = readFileSync(join(temporary, filename))
    registryIntegrity = packed.integrity
    registryShasum = packed.shasum
    expect(hash({ algorithm: "sha1", bytes, encoding: "hex" })).toBe(registryShasum)
    expect(registryIntegrity.split(" ")).toContain(
      "sha512-" + hash({ algorithm: "sha512", bytes, encoding: "base64" }),
    )
  }
  const manifest = JSON.parse(
    execFileSync(
      "tar",
      ["-xOf", join(temporary, filename), "package/package.json"],
      { encoding: "utf8", maxBuffer: 1024 * 1024 },
    ),
  )
  expect(manifest.name).toBe(requested.name)
  expect(manifest.version).toBe(requested.version)
  const metadata = {
    name: requested.name,
    version: requested.version,
    filename,
    source: requested.url ?? "https://registry.npmjs.org",
    integrityMode: requested.url ? "declared-public-url" : "npm-registry",
    registryIntegrityVerified: registryIntegrity !== undefined,
    registryIntegrity,
    registryShasum,
    integrity:
      "sha512-" + hash({ algorithm: "sha512", bytes, encoding: "base64" }),
    shasum: hash({ algorithm: "sha1", bytes, encoding: "hex" }),
    sha256: hash({ algorithm: "sha256", bytes, encoding: "hex" }),
    bytes: bytes.length,
    dependencies: manifest.dependencies ?? {},
    peerDependencies: manifest.peerDependencies ?? {},
  }
  const encoded = bytes.toString("base64")
  const lines = [
    "PENDING_ACCESS_CORE_PUBLIC_METADATA " + JSON.stringify(metadata),
    "PENDING_ACCESS_CORE_PUBLIC_TARBALL_BEGIN " + requested.name,
  ]
  for (let offset = 0; offset < encoded.length; offset += 120)
    lines.push(encoded.slice(offset, offset + 120))
  lines.push("PENDING_ACCESS_CORE_PUBLIC_TARBALL_END " + requested.name)
  await Bun.write(Bun.stdout, lines.join("\n") + "\n")
}

test("capture exact public Core native-H3 dependencies for local validation", async () => {
  // Temporary public package transport only; no production, workflow, package,
  // routing, benchmark, or check implementation is changed by this test.
  const temporary = mkdtempSync(join(tmpdir(), "pending-access-core-public-"))
  try {
    for (const requested of packages)
      await emitPublicPackage(requested, temporary)
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
}, 600_000)
