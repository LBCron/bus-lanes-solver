import assert from "node:assert/strict"
import { Buffer } from "node:buffer"
import { createHash } from "node:crypto"
import { gunzipSync, gzipSync } from "node:zlib"
import { test } from "bun:test"

type PublicPackage = { name: string; version: string; url?: string }
type RegistryVersion = {
  name: string
  version: string
  dist: { tarball: string; integrity: string; shasum: string }
}

// Exact declared Core and runtime-transitive public versions. No install, script, extraction, package alias,
// dependency resolution, routing, source, or constraint change is performed.
const packages: readonly PublicPackage[] = [
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
  {
    name: "@tscircuit/cad-collision-checking",
    version: "0.0.6",
    url: "https://jscdn.tscircuit.com/@tscircuit/cad-collision-checking/0.0.6.tgz",
  },
  { name: "poppygl", version: "0.0.38" },
  { name: "circuit-json-to-gltf", version: "0.0.164" },
  { name: "@tscircuit/jscad", version: "0.0.6" },
  {
    name: "@tscircuit/jscad-to-manifold",
    version: "0.0.1",
    url: "https://jscdn.tscircuit.com/@tscircuit/jscad-to-manifold/0.0.1.tgz",
  },
  { name: "react", version: "19.1.0" },
  { name: "@tscircuit/fanout-solver", version: "0.0.83" },
]

const maximumArchiveBytes = 2 * 1024 * 1024
const maximumOutputBytes = 2 * 1024 * 1024
// Leave room for runner/setup/test summaries and timestamps around our output.
const maximumTransportBytes = maximumOutputBytes - 128 * 1024
const maximumDownloadBytes = 32 * 1024 * 1024
const maximumInflatedBytes = 128 * 1024 * 1024
const maximumManifestBytes = 1024 * 1024
const segmentBytes = 256 * 1024
const chunkCharacters = 16 * 1024
const marker = "PENDING_CORE_DEP_INDEX_V1"

const sha256 = (bytes: Buffer | string): string =>
  createHash("sha256").update(bytes).digest("hex")

function boundedIndex(value: string | undefined, count: number): number {
  assert(value !== undefined && /^(?:0|[1-9][0-9]*)$/.test(value),
    "An explicit canonical nonnegative integer index is required")
  const index = Number(value)
  assert(Number.isSafeInteger(index) && index >= 0 && index < count,
    "Index is outside the fixed allowlist or segment range")
  return index
}

async function fetchBounded(url: string, maximumBytes: number): Promise<Buffer> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(60_000),
    redirect: "error",
  })
  assert(response.ok && response.body, `Public fetch failed: ${response.status}`)
  const declaredLength = response.headers.get("content-length")
  if (declaredLength !== null) {
    assert(/^[0-9]+$/.test(declaredLength))
    assert(Number(declaredLength) <= maximumBytes, "Public response exceeds bound")
  }
  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      total += next.value.byteLength
      assert(total <= maximumBytes, "Public response exceeds streaming bound")
      chunks.push(Buffer.from(next.value))
    }
  } finally {
    await reader.cancel()
    reader.releaseLock()
  }
  return Buffer.concat(chunks, total)
}

function tarString(bytes: Buffer): string {
  const end = bytes.indexOf(0)
  const value = bytes.subarray(0, end < 0 ? bytes.length : end)
  const text = value.toString("utf8")
  assert(Buffer.from(text).equals(value), "Invalid UTF-8 tar text")
  return text
}

function octal(bytes: Buffer): number {
  const text = tarString(bytes).trim()
  assert(/^[0-7]+$/.test(text), "Unsupported tar number encoding")
  const value = Number.parseInt(text, 8)
  assert(Number.isSafeInteger(value) && value >= 0)
  return value
}

function paxValues(bytes: Buffer): Record<string, string> {
  const result: Record<string, string> = Object.create(null)
  let offset = 0
  while (offset < bytes.length) {
    const space = bytes.indexOf(32, offset)
    assert(space > offset)
    const lengthText = bytes.subarray(offset, space).toString("ascii")
    assert(/^[1-9][0-9]*$/.test(lengthText))
    const length = Number(lengthText)
    assert(Number.isSafeInteger(length) && length > space - offset + 2)
    assert(offset + length <= bytes.length && bytes[offset + length - 1] === 10)
    const entry = bytes.subarray(space + 1, offset + length - 1)
    const equals = entry.indexOf(61)
    assert(equals > 0)
    const key = entry.subarray(0, equals).toString("utf8")
    const value = entry.subarray(equals + 1).toString("utf8")
    assert(Buffer.from(key).equals(entry.subarray(0, equals)))
    assert(Buffer.from(value).equals(entry.subarray(equals + 1)))
    result[key] = value
    offset += length
  }
  return result
}

// Read exactly one regular manifest in memory. No archive path is written or
// executed. PAX and GNU long names are resolved before recognizing the path.
function packageManifest(archive: Buffer): Buffer {
  const tar = gunzipSync(archive, { maxOutputLength: maximumInflatedBytes })
  let offset = 0
  let localPax: Record<string, string> = Object.create(null)
  const globalPax: Record<string, string> = Object.create(null)
  let longName: string | undefined
  let found: Buffer | undefined
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every((value) => value === 0)) {
      assert(tar.subarray(offset).every((value) => value === 0),
        "Nonzero data follows tar end marker")
      break
    }
    const expectedChecksum = octal(header.subarray(148, 156))
    let checksum = 0
    for (let index = 0; index < 512; index++) {
      checksum += index >= 148 && index < 156 ? 32 : header[index]
    }
    assert.equal(checksum, expectedChecksum, "Tar header checksum mismatch")
    const type = header[156]
    const extension = type === 120 || type === 103 || type === 76 || type === 75
    const headerSize = octal(header.subarray(124, 136))
    const overrideSize = localPax.size ?? globalPax.size
    let size = headerSize
    if (!extension && overrideSize !== undefined) {
      assert(/^(?:0|[1-9][0-9]*)$/.test(overrideSize))
      size = Number(overrideSize)
      assert(Number.isSafeInteger(size) && size >= 0)
    }
    const start = offset + 512
    assert(start + size <= tar.length, "Truncated tar entry")
    const content = tar.subarray(start, start + size)
    offset = start + Math.ceil(size / 512) * 512
    if (type === 120 || type === 103) {
      assert(size <= maximumManifestBytes, "Oversized PAX metadata")
      if (type === 120) localPax = paxValues(content)
      else Object.assign(globalPax, paxValues(content))
      continue
    }
    if (type === 76) {
      assert(size <= maximumManifestBytes, "Oversized GNU name")
      longName = tarString(content)
      continue
    }
    if (type === 75) continue // Long link targets are never followed.
    const prefix = tarString(header.subarray(345, 500))
    const name = tarString(header.subarray(0, 100))
    const path = localPax.path ?? globalPax.path ?? longName ??
      (prefix ? prefix + "/" + name : name)
    localPax = Object.create(null)
    longName = undefined
    if (path.replace(/^\.\//, "") !== "package/package.json") continue
    assert(type === 0 || type === 48, "Package manifest is not a regular file")
    assert(found === undefined, "Duplicate package manifest")
    assert(size > 0 && size <= maximumManifestBytes, "Invalid manifest size")
    found = content
  }
  assert(found, "Archive has no regular package/package.json")
  return found
}

function transportBody(metadata: Record<string, unknown>, bytes: Buffer): string {
  const encoded = bytes.toString("base64")
  const parts = Math.ceil(encoded.length / chunkCharacters)
  const lines = [marker + "_BEGIN " + JSON.stringify(metadata)]
  for (let part = 0; part < parts; part++) {
    const payload = encoded.slice(part * chunkCharacters, (part + 1) * chunkCharacters)
    lines.push(marker + "_CHUNK " + JSON.stringify({
      index: metadata.index,
      segment: metadata.segment ?? null,
      part,
      parts,
      payloadSha256: sha256(payload),
      payload,
    }))
  }
  const body = lines.join("\n") + "\n"
  return body + marker + "_END " + JSON.stringify({
    index: metadata.index,
    segment: metadata.segment ?? null,
    parts,
    base64Characters: encoded.length,
    bodySha256: sha256(body),
  }) + "\n"
}

test("indexed Core public transport rejects implicit and out-of-range selection", () => {
  assert.equal(packages.length, 25)
  assert.equal(new Set(packages.map((entry) => entry.name + "@" + entry.version)).size, 25)
  assert.equal(boundedIndex("0", 18), 0)
  assert.equal(boundedIndex("17", 18), 17)
  for (const bad of [undefined, "", "00", "-1", "18", "1.0", "NaN", "0;1"]) {
    assert.throws(() => boundedIndex(bad, 18))
  }
  const bytes = Buffer.alloc(segmentBytes, 123)
  const output = transportBody({ index: 0, segment: 1 }, bytes)
  assert(Buffer.byteLength(output) < maximumTransportBytes)
})

test("indexed Core public transport reads one checked regular manifest without extraction", () => {
  const entry = (name: string, content: string, type = 48): Buffer => {
    const body = Buffer.from(content)
    const header = Buffer.alloc(512)
    header.write(name, 0, 100)
    header.write(body.length.toString(8).padStart(11, "0") + "\0", 124, 12)
    header.fill(32, 148, 156)
    header[156] = type
    const checksum = header.reduce((sum, value) => sum + value, 0)
    header.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, 8)
    return Buffer.concat([header, body, Buffer.alloc((512 - body.length % 512) % 512)])
  }
  const manifest = '{"name":"example","version":"1.2.3"}'
  const regular = entry("package/package.json", manifest)
  const archive = (...entries: Buffer[]): Buffer =>
    gzipSync(Buffer.concat([...entries, Buffer.alloc(1024)]))
  assert.equal(packageManifest(archive(regular)).toString(), manifest)
  assert.throws(() => packageManifest(archive(regular, regular)), /Duplicate/)
  assert.throws(() => packageManifest(archive(entry("package/package.json", "", 50))),
    /not a regular file/)
  assert.throws(() => packageManifest(archive(entry("package/other.json", manifest))),
    /no regular/)
  const corrupted = Buffer.from(regular)
  corrupted[0] ^= 1
  assert.throws(() => packageManifest(archive(corrupted)), /checksum mismatch/)
  const pax = (value: string): string => {
    let length = value.length + 3
    while ((String(length).length + 1 + value.length + 1) !== length) {
      length = String(length).length + 1 + value.length + 1
    }
    return String(length) + " " + value + "\n"
  }
  assert.equal(packageManifest(archive(
    entry("PaxHeader", pax("path=package/package.json"), 120),
    entry("different-name", manifest),
  )).toString(), manifest)
  assert.equal(packageManifest(archive(
    entry("LongName", "package/package.json\0", 76),
    entry("different-name", manifest),
  )).toString(), manifest)
})

test.skipIf(process.env.PENDING_ACCESS_PACKAGE_INDEX === undefined)(
  "capture one exact allowlisted public Core native-H3 dependency",
  async () => {
    const index = boundedIndex(process.env.PENDING_ACCESS_PACKAGE_INDEX, packages.length)
    const requested = packages[index]
    let source = requested.url
    let registryIntegrity: string | undefined
    let registryShasum: string | undefined
    if (source === undefined) {
      const registryUrl = "https://registry.npmjs.org/" +
        encodeURIComponent(requested.name) + "/" + requested.version
      const registry: RegistryVersion = JSON.parse(
        (await fetchBounded(registryUrl, maximumManifestBytes)).toString("utf8"))
      assert.equal(registry.name, requested.name)
      assert.equal(registry.version, requested.version)
      const archiveUrl = new URL(registry.dist.tarball)
      assert.equal(archiveUrl.protocol, "https:")
      assert.equal(archiveUrl.hostname, "registry.npmjs.org")
      assert.equal(archiveUrl.port + archiveUrl.username + archiveUrl.password +
        archiveUrl.search + archiveUrl.hash, "")
      assert.equal(archiveUrl.pathname,
        "/" + requested.name + "/-/" + requested.name.split("/").at(-1) +
          "-" + requested.version + ".tgz")
      source = archiveUrl.href
      registryIntegrity = registry.dist.integrity
      registryShasum = registry.dist.shasum
      assert.equal(typeof registryIntegrity, "string")
      assert.match(registryShasum, /^[0-9a-f]{40}$/)
    }
    // Source is either the exact immutable Core URL above or the exact npm
    // version's checked registry URL. Redirects and arbitrary URLs are rejected.
    const bytes = await fetchBounded(source, maximumDownloadBytes)
    const integrity = "sha512-" + createHash("sha512").update(bytes).digest("base64")
    const shasum = createHash("sha1").update(bytes).digest("hex")
    if (registryIntegrity !== undefined) {
      assert(registryIntegrity.split(" ").includes(integrity), "Npm integrity mismatch")
      assert.equal(shasum, registryShasum, "Npm archive SHA1 mismatch")
    }
    const manifestBytes = packageManifest(bytes)
    const manifestText = manifestBytes.toString("utf8")
    assert(Buffer.from(manifestText).equals(manifestBytes))
    const manifest = JSON.parse(manifestText)
    assert.equal(manifest.name, requested.name)
    assert.equal(manifest.version, requested.version)
    const metadata: Record<string, unknown> = {
      schema: "pending-core-public-package-index/v1",
      index,
      name: requested.name,
      version: requested.version,
      filename: "core-public-" + index + ".tgz",
      source,
      integrityMode: requested.url ? "declared-public-url" : "npm-registry",
      registryIntegrityVerified: registryIntegrity !== undefined,
      registryIntegrity,
      registryShasum,
      integrity,
      shasum,
      sha256: sha256(bytes),
      bytes: bytes.length,
      packageManifestSha256: sha256(manifestBytes),
      allowlistSha256: sha256(JSON.stringify(packages)),
      dependencies: manifest.dependencies ?? {},
      peerDependencies: manifest.peerDependencies ?? {},
      optionalDependencies: manifest.optionalDependencies ?? {},
      archiveLimitBytes: maximumArchiveBytes,
      outputLimitBytes: maximumOutputBytes,
      transportLimitBytes: maximumTransportBytes,
      runtimeBun: Bun.version,
      diagnosticCommit: process.env.GITHUB_SHA ?? null,
      diagnosticRun: process.env.GITHUB_RUN_ID ?? null,
      noInstallOrScriptsExecuted: true,
    }
    const segmentCount = Math.ceil(bytes.length / segmentBytes)
    let output: string
    if (process.env.PENDING_ACCESS_PACKAGE_SEGMENT !== undefined) {
      const segment = boundedIndex(process.env.PENDING_ACCESS_PACKAGE_SEGMENT, segmentCount)
      const start = segment * segmentBytes
      const selected = bytes.subarray(start, Math.min(start + segmentBytes, bytes.length))
      Object.assign(metadata, {
        mode: "explicit-archive-segment",
        segment,
        segmentCount,
        segmentOffset: start,
        segmentBytes: selected.length,
        segmentSha256: sha256(selected),
      })
      output = transportBody(metadata, selected)
    } else {
      const estimatedBytes = Math.ceil(bytes.length / 3) * 4 +
        Buffer.byteLength(JSON.stringify(metadata)) +
        Math.ceil(Math.ceil(bytes.length / 3) * 4 / chunkCharacters) * 400 + 4096
      if (bytes.length > maximumArchiveBytes || estimatedBytes > maximumTransportBytes) {
        // No partial archive or oversized log is emitted. A subsequent job can
        // request one bounded segment using the explicit segment index above.
        Object.assign(metadata, {
          mode: "metadata-only-oversized",
          reason: bytes.length > maximumArchiveBytes ? "archive-limit" : "transport-limit",
          plannedSegmentBytes: segmentBytes,
          plannedSegmentCount: segmentCount,
        })
        output = marker + "_OVERSIZED " + JSON.stringify(metadata) + "\n"
      } else {
        metadata.mode = "complete-archive"
        output = transportBody(metadata, bytes)
      }
    }
    assert(Buffer.byteLength(output) <= maximumTransportBytes,
      "Public package output exceeds hard bound; nothing emitted")
    assert.equal(await Bun.write(Bun.stdout, output), Buffer.byteLength(output))
  },
  180_000,
)
