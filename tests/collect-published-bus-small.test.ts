import { expect, test } from "bun:test"
import { Buffer } from "node:buffer"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"

// Small capture only: two canonical bus archives and the Biome JS wrapper.
// Fill from the official immutable preview/build record before publication.
const consumerArchiveUrl = "https://pkg.pr.new/tscircuit/bus-lanes-solver/@tscircuit/bus-lanes-solver@0729caf"
const consumerCommitSha = "0729cafff1c433f0ded063b27a478933ae31d43d"
const releasedCommitSha = "cbd27db2e7de5697d24fc63928c43fb92d3431d1"

type PublicArchive = {
  key: string
  name: string
  version: string
  url?: string
  sourceCommit?: string
}
type NpmPack = {
  name: string
  version: string
  filename: string
  integrity: string
  shasum: string
}

const archives: PublicArchive[] = [
  {
    key: "released-bus-0.0.61",
    name: "@tscircuit/bus-lanes-solver",
    version: "0.0.61",
    url: "https://jscdn.tscircuit.com/@tscircuit/bus-lanes-solver/0.0.61.tgz",
    sourceCommit: releasedCommitSha,
  },
  {
    key: "consumer-bus-preview",
    name: "@tscircuit/bus-lanes-solver",
    version: "0.0.61",
    url: consumerArchiveUrl,
    sourceCommit: consumerCommitSha,
  },
  { key: "biome-2.5.15", name: "@biomejs/biome", version: "2.5.15" },
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

async function emitArchive(
  requested: PublicArchive,
  temporary: string,
): Promise<void> {
  let filename: string
  let bytes: Buffer
  let registryIntegrity: string | undefined
  let registryShasum: string | undefined
  if (requested.url) {
    expect(requested.sourceCommit).toMatch(/^[0-9a-f]{40}$/)
    const sourceUrl = new URL(requested.url)
    expect(sourceUrl.protocol).toBe("https:")
    expect(sourceUrl.username).toBe("")
    expect(sourceUrl.password).toBe("")
    expect(sourceUrl.search).toBe("")
    expect(sourceUrl.hash).toBe("")
    if (requested.key === "consumer-bus-preview") {
      expect(sourceUrl.hostname).toBe("pkg.pr.new")
      expect(sourceUrl.pathname).toContain(requested.sourceCommit!.slice(0, 7))
    } else {
      expect(requested.url).toBe(
        "https://jscdn.tscircuit.com/@tscircuit/bus-lanes-solver/0.0.61.tgz",
      )
    }
    const response = await fetch(requested.url, {
      signal: AbortSignal.timeout(60_000),
    })
    expect(response.ok).toBe(true)
    bytes = Buffer.from(await response.arrayBuffer())
    filename = requested.key + ".tgz"
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
    expect(hash({ algorithm: "sha1", bytes, encoding: "hex" })).toBe(
      registryShasum,
    )
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
  if (requested.sourceCommit && manifest.gitHead)
    expect(manifest.gitHead).toBe(requested.sourceCommit)
  if (requested.key === "biome-2.5.15")
    expect(manifest.optionalDependencies["@biomejs/cli-darwin-arm64"]).toBe(
      "2.5.15",
    )
  const metadata = {
    key: requested.key,
    name: requested.name,
    version: requested.version,
    filename,
    source: requested.url ?? "https://registry.npmjs.org",
    sourceCommit: requested.sourceCommit,
    archiveGitHead: manifest.gitHead,
    sourceCommitEvidence: manifest.gitHead
      ? "archive-gitHead"
      : requested.sourceCommit
        ? "official-build-record-verified-separately"
        : undefined,
    integrityMode: requested.url ? "official-public-url" : "npm-registry",
    registryIntegrityVerified: registryIntegrity !== undefined,
    registryIntegrity,
    registryShasum,
    integrity:
      "sha512-" + hash({ algorithm: "sha512", bytes, encoding: "base64" }),
    shasum: hash({ algorithm: "sha1", bytes, encoding: "hex" }),
    sha256: hash({ algorithm: "sha256", bytes, encoding: "hex" }),
    bytes: bytes.length,
    exports: manifest.exports,
    dependencies: manifest.dependencies ?? {},
    peerDependencies: manifest.peerDependencies ?? {},
    optionalDependencies: manifest.optionalDependencies ?? {},
  }
  const encoded = bytes.toString("base64")
  const lines = [
    "PENDING_ACCESS_PUBLISHED_METADATA " + JSON.stringify(metadata),
    "PENDING_ACCESS_PUBLISHED_TARBALL_BEGIN " + requested.key,
  ]
  for (let offset = 0; offset < encoded.length; offset += 120)
    lines.push(encoded.slice(offset, offset + 120))
  lines.push("PENDING_ACCESS_PUBLISHED_TARBALL_END " + requested.key)
  await Bun.write(Bun.stdout, lines.join("\n") + "\n")
}

test.only("capture canonical published bus controls and formatter wrapper", async () => {
  // Temporary public byte transport only. Distinct record keys preserve both
  // solver identities despite their shared package name/version. No scripts,
  // routes, workflows, dependencies, checks, or production exports are changed.
  expect(new Set(archives.map(({ key }) => key)).size).toBe(archives.length)
  const temporary = mkdtempSync(join(tmpdir(), "pending-access-published-"))
  try {
    for (const requested of archives) await emitArchive(requested, temporary)
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
}, 600_000)
