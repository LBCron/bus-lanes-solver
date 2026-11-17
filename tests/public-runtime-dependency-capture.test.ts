import { test, expect } from "bun:test"
import { Buffer } from "node:buffer"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join, resolve } from "node:path"

type PublicPackage = { name: string; version: string }
type PackedPackage = PublicPackage & {
  filename: string
  integrity: string
  shasum: string
}

async function emitPublicPackage({
  requested,
  temporary,
}: {
  requested: PublicPackage
  temporary: string
}): Promise<void> {
  const packedPackages: PackedPackage[] = JSON.parse(
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
  expect(packedPackages).toHaveLength(1)
  const packed = packedPackages[0]!
  expect(packed.name).toBe(requested.name)
  expect(packed.version).toBe(requested.version)
  expect(basename(packed.filename)).toBe(packed.filename)
  const bytes = readFileSync(join(temporary, packed.filename))
  expect(createHash("sha1").update(bytes).digest("hex")).toBe(packed.shasum)
  const metadata = {
    name: packed.name,
    version: packed.version,
    filename: packed.filename,
    integrity: packed.integrity,
    shasum: packed.shasum,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
  }
  const encoded = bytes.toString("base64")
  const lines = [
    "PENDING_ACCESS_NPM_METADATA " + JSON.stringify(metadata),
    "PENDING_ACCESS_NPM_TARBALL_BEGIN " + packed.name,
  ]
  for (let offset = 0; offset < encoded.length; offset += 120)
    lines.push(encoded.slice(offset, offset + 120))
  lines.push("PENDING_ACCESS_NPM_TARBALL_END " + packed.name)
  await Bun.write(Bun.stdout, lines.join("\n") + "\n")
}

test("capture exact public dependency tarballs for local native validation", async () => {
  // Temporary diagnostic transport only. Existing tests and workflows remain
  // unchanged; no solver result or benchmark claim comes from this capture.
  const packages: PublicPackage[] = [
    { name: "yalps", version: "0.6.4" },
    { name: "heap", version: "0.2.7" },
    { name: "@tscircuit/checks", version: "0.0.264" },
    { name: "circuit-json", version: "0.0.538" },
    { name: "circuit-to-svg", version: "0.0.453" },
    { name: "@flatten-js/core", version: "1.6.2" },
    { name: "@tscircuit/math-utils", version: "0.0.38" },
  ]
  const root = resolve(import.meta.dir, "..")
  for (const name of ["@types/bun", "bun-types"]) {
    const installed: PublicPackage = JSON.parse(
      readFileSync(join(root, "node_modules", name, "package.json"), "utf8"),
    )
    expect(installed.name).toBe(name)
    expect(installed.version).toMatch(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/)
    packages.push({ name, version: installed.version })
  }
  const temporary = mkdtempSync(join(tmpdir(), "pending-access-public-deps-"))
  try {
    for (const requested of packages)
      await emitPublicPackage({ requested, temporary })
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
}, 300_000)
