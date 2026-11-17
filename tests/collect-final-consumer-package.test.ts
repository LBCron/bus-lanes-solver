import { expect, test } from "bun:test"
import { Buffer } from "node:buffer"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

interface Request {
  sourceCommit: string
  sourceTree: string
  officialBuildRecord: string
  archiveUrl: string
  packageName: string
  packageVersion: string
  logicCommit: string
  ownerManifestSha256: string
  maxArchiveBytes: number
  rawSegmentBytes: number
}

function hash(bytes: Buffer, algorithm = "sha256"): string {
  return createHash(algorithm).update(bytes).digest("hex")
}

function validate(request: Request): void {
  for (const value of [request.sourceCommit, request.sourceTree, request.logicCommit])
    if (!/^[0-9a-f]{40}$/.test(value)) throw Error("An exact official source identity is required")
  if (!/^[0-9a-f]{64}$/.test(request.ownerManifestSha256)) throw Error("An exact owner manifest identity is required")
  const url = new URL(request.archiveUrl)
  const prefix = "/tscircuit/bus-lanes-solver/@tscircuit/bus-lanes-solver@"
  if (url.protocol !== "https:" || url.hostname !== "pkg.pr.new" || url.port || url.username || url.password || url.search || url.hash ||
    !url.pathname.startsWith(prefix)) throw Error("Use the actual official public package URL")
  const suffix = url.pathname.slice(prefix.length)
  if (!/^[0-9a-f]{7,40}$/.test(suffix) || !request.sourceCommit.startsWith(suffix)) throw Error("The official package URL must identify the exact source revision")
  const build = new URL(request.officialBuildRecord)
  if (build.protocol !== "https:" || build.hostname !== "github.com" || build.port || build.username || build.password ||
    !build.pathname.startsWith("/tscircuit/bus-lanes-solver/")) throw Error("An official build record is required")
  if (request.packageName !== "@tscircuit/bus-lanes-solver" || !/^\d+\.\d+\.\d+$/.test(request.packageVersion)) throw Error("Unexpected package identity")
  if (request.maxArchiveBytes !== 2 * 1024 * 1024 || request.rawSegmentBytes !== 64 * 1024) throw Error("Keep the bounded public transport limits")
}

function segments(bytes: Buffer, size: number): Buffer[] {
  return Array.from({ length: Math.ceil(bytes.length / size) }, (_, index) => bytes.subarray(index * size, Math.min(bytes.length, (index + 1) * size)))
}

async function download(request: Request): Promise<Buffer> {
  const response = await fetch(request.archiveUrl, { signal: AbortSignal.timeout(60_000) })
  if (!response.ok || !response.body) throw Error("The official public archive is unavailable")
  const reader = response.body.getReader(), chunks: Buffer[] = []
  let total = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      total += next.value.length
      if (total > request.maxArchiveBytes) throw Error("Official archive exceeds the bounded transport size")
      chunks.push(Buffer.from(next.value))
    }
  } finally {
    await reader.cancel()
  }
  if (!total) throw Error("Official archive is empty")
  return Buffer.concat(chunks, total)
}

test("final package transport helpers reject missing identities and preserve segment bytes", () => {
  const sample: Request = {
    sourceCommit: "0729cafff1c433f0ded063b27a478933ae31d43d",
    sourceTree: "412f44cc22ea292a6b1ff92a58967f165908036e",
    logicCommit: "bb0ce50beb79b8149eb9e7c170919bbbfc4bb995",
    ownerManifestSha256: "36ca790451f06637be51c20c5b6e6368c699d24e40575096261ea577d1db93d9",
    officialBuildRecord: "https://github.com/tscircuit/bus-lanes-solver/pull/213",
    archiveUrl: "https://pkg.pr.new/tscircuit/bus-lanes-solver/@tscircuit/bus-lanes-solver@0729caf",
    packageName: "@tscircuit/bus-lanes-solver", packageVersion: "0.0.61",
    maxArchiveBytes: 2 * 1024 * 1024, rawSegmentBytes: 64 * 1024,
  }
  expect(() => validate(sample)).not.toThrow()
  expect(() => validate({ ...sample, sourceCommit: "MISSING" })).toThrow()
  expect(() => validate({ ...sample, archiveUrl: sample.archiveUrl.replace("0729caf", "60629c2") })).toThrow()
  expect(() => validate({ ...sample, archiveUrl: sample.archiveUrl + "?token=secret" })).toThrow()
  expect(() => validate({ ...sample, maxArchiveBytes: 3 * 1024 * 1024 })).toThrow()
  const bytes = Buffer.alloc(2 * sample.rawSegmentBytes + 5)
  for (let index = 0; index < bytes.length; index++) bytes[index] = index % 251
  const parts = segments(bytes, sample.rawSegmentBytes)
  expect(parts.map(part => part.length)).toEqual([65536, 65536, 5])
  expect(Buffer.concat(parts.map(part => Buffer.from(part.toString("base64"), "base64")))).toEqual(bytes)
  expect(hash(bytes)).toBe(hash(Buffer.concat(parts)))
})

test("capture the exact final official consumer package", async () => {
  const request = JSON.parse(readFileSync(new URL("./collect-final-consumer-package.manifest.json", import.meta.url), "utf8")) as Request
  validate(request)
  const actualParent = execFileSync("git", ["rev-parse", "HEAD^"], { encoding: "utf8" }).trim()
  const actualTree = execFileSync("git", ["rev-parse", request.sourceCommit + "^{tree}"], { encoding: "utf8" }).trim()
  expect(actualParent).toBe(request.sourceCommit)
  expect(actualTree).toBe(request.sourceTree)
  execFileSync("git", ["merge-base", "--is-ancestor", request.logicCommit, request.sourceCommit])
  const group = Number(process.env.PENDING_CONSUMER_CAPTURE_GROUP)
  if (!Number.isInteger(group) || group < 0 || group > 3 || process.env.PENDING_CONSUMER_CAPTURE_GROUP === undefined)
    throw Error("Select one bounded public capture group0..3")
  const bytes = await download(request)
  const temporary = mkdtempSync(join(tmpdir(), "final-pending-public-"))
  try {
    const archive = join(temporary, "consumer.tgz")
    writeFileSync(archive, bytes)
    const packageBytes = execFileSync("tar", ["-xOf", archive, "package/package.json"], { maxBuffer: 1024 * 1024 })
    const manifest = JSON.parse(packageBytes.toString())
    expect(manifest.name).toBe(request.packageName)
    expect(manifest.version).toBe(request.packageVersion)
    if (manifest.gitHead) expect(manifest.gitHead).toBe(request.sourceCommit)
    const executable = execFileSync("tar", ["-xOf", archive, "package/dist/index.js"], { maxBuffer: 8 * 1024 * 1024 })
    expect(executable.length).toBeGreaterThan(0)
    const parts = segments(bytes, request.rawSegmentBytes)
    const metadata = {
      schema: "pending-consumer-final-public-capture/v1", key: "consumer-final-" + request.sourceCommit,
      ...request, archiveGitHead: manifest.gitHead,
      sourceBinding: manifest.gitHead ? "archive-gitHead-and-official-build-record" : "official-build-record-required-separately",
      diagnosticCommit: process.env.GITHUB_SHA,
      archive: { bytes: bytes.length, sha256: hash(bytes), sha1: hash(bytes, "sha1"), integrity: "sha512-" + createHash("sha512").update(bytes).digest("base64") },
      executable: { path: "package/dist/index.js", bytes: executable.length, sha256: hash(executable), sha1: hash(executable, "sha1") },
      packageManifestSha256: hash(packageBytes), exports: manifest.exports,
      dependencies: manifest.dependencies ?? {}, peerDependencies: manifest.peerDependencies ?? {}, optionalDependencies: manifest.optionalDependencies ?? {},
      segments: parts.map((part, index) => ({ index, offset: index * request.rawSegmentBytes, bytes: part.length, sha256: hash(part) })),
    }
    await Bun.write(Bun.stdout, "PENDING_CONSUMER_FINAL_METADATA " + JSON.stringify(metadata) + "\n")
    await Bun.write(Bun.stdout, "PENDING_CONSUMER_FINAL_GROUP " + group + "\n")
    for (const [index, part] of parts.entries()) {
      // At most512KiB raw (~700KiB base64) per job, rather than one log whose
      // total size grows to the archive-wide2MiB transport bound.
      if (Math.floor(index / 8) !== group) continue
      const encoded = part.toString("base64")
      const lines = ["PENDING_CONSUMER_FINAL_SEGMENT_BEGIN " + index]
      for (let offset = 0; offset < encoded.length; offset += 120) lines.push(encoded.slice(offset, offset + 120))
      lines.push("PENDING_CONSUMER_FINAL_SEGMENT_END " + index)
      await Bun.write(Bun.stdout, lines.join("\n") + "\n")
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
}, 120_000)
