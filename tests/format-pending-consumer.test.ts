import assert from "node:assert/strict"
import { Buffer } from "node:buffer"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { basename, dirname, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { gzipSync, gunzipSync } from "node:zlib"
import { test } from "bun:test"
import type * as TypeScript from "typescript"

// TEMPORARY DIAGNOSTIC ONLY. Copy this file and its companion manifest to the
// checkpoint's tests directory on a disposable branch. The manifest must come
// from the refreshed official publish manifest, never from this older workspace.
// No workflow, formatter config, dependency, golden, gzip fixture, or feature-PR
// file is added by this helper. Only installed Biome 2.5.15 may format sources.
type FormatManifest = {
  schema: "pending-consumer-canonical-format/v1"
  repository: "tscircuit/bus-lanes-solver"
  stackBasePullRequest: 203
  sourceCheckpointCommit: string
  publishManifestSha256: string
  publishManifestBase64: string
  biomeConfigSha256: string
  biomeVersion: "2.5.15"
  typescriptVersion: "5.9.3"
  additionalDiagnosticFiles: { path: string; sha256: string; bytes: number }[]
  files: { path: string; beforeSha256: string; beforeBytes: number }[]
  immutableFiles: { path: string; sha256: string; bytes: number; gitBlobSha1: string }[]
}
type AstNode = TypeScript.Node & Record<string, unknown>
type Primitive = string | number | boolean | null
type StructuralValue = Primitive | StructuralValue[] | {
  [key: string]: StructuralValue
}
type SavedSource = {
  path: string
  absolutePath: string
  before: Buffer
  beforeSha256: string
  beforeStructure: string
  kind: "typescript-ast" | "json-value"
}

const maximumOutputBytes = 2 * 1024 * 1024
const chunkCharacters = 16 * 1024
const marker = "PENDING_CONSUMER_FORMAT_V1"
const sha256 = (bytes: Buffer | string): string =>
  createHash("sha256").update(bytes).digest("hex")

// These are parser locations, derived caches/aliases, or emission metadata.
// Language-specific scalar fields are retained by default. Unknown structured
// fields reject the proof rather than being silently discarded.
const parserMetadata = new Set([
  "pos", "end", "parent", "original", "emitNode", "id",
  "modifierFlagsCache", "transformFlags", "multiLine", "jsDoc", "jsDocCache",
  "symbol", "localSymbol", "locals", "nextContainer", "flowNode",
  "endFlowNode", "returnFlowNode",
])

// A formatter may surround the entire value of a return statement with
// parentheses to wrap it across lines. Only this outer chain is transparent:
// parentheses inside calls, optional chains, directives, and operators retain
// their exact AST representation.
function returnValue(
  ts: typeof TypeScript,
  node: TypeScript.ReturnStatement,
): TypeScript.Expression | undefined {
  let expression = node.expression
  while (expression && ts.isParenthesizedExpression(expression)) {
    expression = expression.expression
  }
  return expression
}

// Exponentiation binds more tightly than bitwise AND, OR, or XOR. Biome may
// add readability parentheses to exactly that right-hand expression. Preserve
// all grouping inside the exponentiation, including its associativity.
function bitwiseExponentValue(
  ts: typeof TypeScript,
  node: TypeScript.BinaryExpression,
): TypeScript.Expression | undefined {
  if (node.operatorToken.kind !== ts.SyntaxKind.AmpersandToken &&
    node.operatorToken.kind !== ts.SyntaxKind.BarToken &&
    node.operatorToken.kind !== ts.SyntaxKind.CaretToken) return undefined
  let expression = node.right
  while (ts.isParenthesizedExpression(expression)) expression = expression.expression
  return ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.AsteriskAsteriskToken
    ? expression : undefined
}

function structuralAst(
  ts: typeof TypeScript,
  node: TypeScript.Node,
  source: TypeScript.SourceFile,
): StructuralValue {
  if (ts.isSourceFile(node)) {
    return {
      kind: node.kind,
      flags: node.flags,
      statements: Array.from(node.statements, (child) =>
        structuralAst(ts, child, source)),
      endOfFileToken: structuralAst(ts, node.endOfFileToken, source),
    }
  }
  const children = new Set<TypeScript.Node>()
  const childArrays = new Set<TypeScript.NodeArray<TypeScript.Node>>()
  ts.forEachChild(node, (child) => {
    children.add(child)
  }, (array) => {
    childArrays.add(array)
  })
  const result: { [key: string]: StructuralValue } = {}
  for (const key of Object.keys(node).sort()) {
    if (parserMetadata.has(key)) continue
    const value = (node as AstNode)[key]
    if (value === undefined) continue
    if (children.has(value as TypeScript.Node)) {
      const child = ts.isReturnStatement(node) && key === "expression"
        ? returnValue(ts, node)
        : ts.isBinaryExpression(node) && key === "right"
          ? bitwiseExponentValue(ts, node) ?? value as TypeScript.Node
        : value as TypeScript.Node
      assert(child)
      result[key] = structuralAst(ts, child, source)
    } else if (childArrays.has(value as TypeScript.NodeArray<TypeScript.Node>)) {
      result[key] = Array.from(value as TypeScript.NodeArray<TypeScript.Node>,
        (child) => structuralAst(ts, child, source))
    } else if (value === null || typeof value === "string" ||
      typeof value === "number" || typeof value === "boolean") {
      result[key] = value as Primitive
    } else {
      throw new Error(`Unclassified AST field ${ts.SyntaxKind[node.kind]}.${key}`)
    }
  }
  if (ts.isStringLiteral(node)) {
    // Permit a quote-delimiter change, but reject escape rewriting (including
    // accidental promotion of an escaped string into a "use strict" directive).
    const raw = node.getText(source)
    assert(raw[0] === '"' || raw[0] === "'")
    assert.equal(raw.at(-1), raw[0])
    result.rawStringBody = raw.slice(1, -1)
  }
  if (node.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral ||
    node.kind === ts.SyntaxKind.TemplateHead ||
    node.kind === ts.SyntaxKind.TemplateMiddle ||
    node.kind === ts.SyntaxKind.TemplateTail) {
    // Tagged templates can observe raw escapes; decoded .text is insufficient.
    result.rawTemplateToken = node.getText(source)
  }
  return result
}

function preservedComments(
  ts: typeof TypeScript,
  source: TypeScript.SourceFile,
): StructuralValue {
  const leaves: { kind: number; start: number; end: number }[] = []
  const transparentReturnParentheses = new Set<number>()
  const leadingTypeOperators = new Set<number>()
  const visit = (node: TypeScript.Node): void => {
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode &&
      node.kind <= ts.SyntaxKind.LastJSDocNode) return
    if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
      const first = node.getFirstToken(source)
      if (first?.kind === ts.SyntaxKind.BarToken ||
        first?.kind === ts.SyntaxKind.AmpersandToken) {
        leadingTypeOperators.add(first.getStart(source))
      }
    }
    if (ts.isReturnStatement(node)) {
      let expression = node.expression
      while (expression && ts.isParenthesizedExpression(expression)) {
        const open = expression.getFirstToken(source)
        const close = expression.getLastToken(source)
        assert(open?.kind === ts.SyntaxKind.OpenParenToken)
        assert(close?.kind === ts.SyntaxKind.CloseParenToken)
        transparentReturnParentheses.add(open.getStart(source))
        transparentReturnParentheses.add(close.getStart(source))
        expression = expression.expression
      }
    }
    if (ts.isBinaryExpression(node) && bitwiseExponentValue(ts, node)) {
      let expression = node.right
      while (ts.isParenthesizedExpression(expression)) {
        const open = expression.getFirstToken(source)
        const close = expression.getLastToken(source)
        assert(open?.kind === ts.SyntaxKind.OpenParenToken)
        assert(close?.kind === ts.SyntaxKind.CloseParenToken)
        transparentReturnParentheses.add(open.getStart(source))
        transparentReturnParentheses.add(close.getStart(source))
        expression = expression.expression
      }
    }
    const children = node.getChildren(source)
    if (children.length) {
      for (const child of children) visit(child)
    } else {
      const start = node.kind === ts.SyntaxKind.JsxText ? node.pos :
        node.getStart(source, false)
      if (node.end > start) leaves.push({ kind: node.kind, start, end: node.end })
    }
  }
  visit(source)
  leaves.sort((left, right) => left.start - right.start || left.end - right.end)
  const boundaries: StructuralValue[] = []
  let previousEnd = 0
  let tokenOrdinal = 0
  let boundary: StructuralValue[] = []
  let hasComment = false
  const flush = (): void => {
    if (hasComment) boundaries.push({ tokenOrdinal, items: boundary })
    boundary = []
    hasComment = false
  }
  const withEof = [...leaves,
    { kind: ts.SyntaxKind.EndOfFileToken, start: source.text.length,
      end: source.text.length }]
  for (let index = 0; index < withEof.length; index++) {
    const leaf = withEof[index]
    assert(leaf.start >= previousEnd, "Overlapping parser token spans")
    // Only gaps between parser-token spans are scanned. A regexp, template, or
    // JSX text containing comment-like characters remains an indivisible leaf.
    const gap = source.text.slice(previousEnd, leaf.start)
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, false,
      ts.LanguageVariant.Standard, gap)
    for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken;
      kind = scanner.scan()) {
      if (kind === ts.SyntaxKind.WhitespaceTrivia ||
        kind === ts.SyntaxKind.NewLineTrivia) continue
      assert(kind === ts.SyntaxKind.SingleLineCommentTrivia ||
        kind === ts.SyntaxKind.MultiLineCommentTrivia ||
        kind === ts.SyntaxKind.ShebangTrivia,
      `Unexpected nontrivia parser gap: ${ts.SyntaxKind[kind]}`)
      hasComment = true
      const text = scanner.getTokenText()
      const comment: { [key: string]: StructuralValue } = { kind, text }
      if (/@ts-(?:ignore|expect-error)\b/.test(text)) {
        // Moving a suppression onto/off the target code's line can change
        // typechecking despite an otherwise identical code AST and comment.
        let targetIndex = index
        while (transparentReturnParentheses.has(withEof[targetIndex].start)) {
          targetIndex++
        }
        comment.nextTokenLineDistance =
          source.getLineAndCharacterOfPosition(withEof[targetIndex].start).line -
          source.getLineAndCharacterOfPosition(
            previousEnd + scanner.getTextPos()).line
      }
      boundary.push(comment)
    }
    previousEnd = leaf.end
    // Do not shift comment anchors for the same transparent return wrappers.
    // Comments before and inside a wrapper still anchor to the same next
    // significant token, and suppression line distances remain checked.
    if (transparentReturnParentheses.has(leaf.start)) continue
    if (leadingTypeOperators.has(leaf.start) ||
      leaf.kind === ts.SyntaxKind.CommaToken ||
      leaf.kind === ts.SyntaxKind.SemicolonToken) {
      // Unrelated trailing separators must not shift every later comment's
      // anchor. At a comment-bearing boundary their order is still preserved.
      boundary.push({ kind: leaf.kind })
    } else {
      flush()
      if (leaf.kind !== ts.SyntaxKind.EndOfFileToken) tokenOrdinal++
    }
  }
  return boundaries
}

function sourceStructure(
  ts: typeof TypeScript,
  path: string,
  bytes: Buffer,
): string {
  const text = bytes.toString("utf8")
  assert(Buffer.from(text, "utf8").equals(bytes), `Invalid UTF-8 in ${path}`)
  if (path.endsWith(".json")) {
    // Deep equality is checked separately as well (notably -0 versus 0).
    return JSON.stringify(JSON.parse(text))
  }
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const diagnostics = (source as TypeScript.SourceFile & {
    parseDiagnostics: readonly TypeScript.Diagnostic[]
  }).parseDiagnostics
  assert.equal(diagnostics.length, 0,
    `Parse diagnostics in ${path}: ${diagnostics.map((d) => d.code).join(",")}`)
  return JSON.stringify({ ast: structuralAst(ts, source, source),
    comments: preservedComments(ts, source) })
}

export function verifyReturnParenthesesNormalization(ts: typeof TypeScript): void {
  const structure = (text: string): string =>
    sourceStructure(ts, "return-parentheses-proof.ts", Buffer.from(text))
  const equal = (before: string, after: string): void =>
    assert.equal(structure(before), structure(after))
  const different = (before: string, after: string): void =>
    assert.notEqual(structure(before), structure(after))

  equal("function f() { return !a || b !== 1 || c !== d; /* after */ }",
    "function f() { return (\n !a || b !== 1 || c !== d\n ); /* after */ }")
  equal("function f() { return (a, b); }",
    "function f() { return (((a, b))); }")
  equal("function f() { return a?.b; }", "function f() { return (a?.b); }")
  equal("function f() { return /* keep */ a; }",
    "function f() { return (/* keep */ a); }")
  equal("function f() { return /* @ts-ignore */ a; }",
    "function f() { return (/* @ts-ignore */ a); }")
  equal("type T = A | B; /* after */ type U = C;",
    "type T =\n | A\n | B; /* after */ type U = C;")
  equal("type T = A & B; /* after */ type U = C;",
    "type T =\n & A\n & B; /* after */ type U = C;")
  different("type T = A | B; /* after */ type U = C;",
    "type T = A & B; /* after */ type U = C;")
  different("type T = /* keep */ A | B;",
    "type T = A | /* keep */ B;")
  equal("function f() { return mask & 2 ** index; /* after */ }",
    "function f() { return mask & (2 ** index); /* after */ }")
  equal("function f() { return mask | 2 ** index; /* after */ }",
    "function f() { return mask | (2 ** index); /* after */ }")
  equal("function f() { return mask ^ 2 ** index; /* after */ }",
    "function f() { return mask ^ (2 ** index); /* after */ }")
  different("function f() { return mask & (2 ** index + 1); }",
    "function f() { return (mask & 2 ** index) + 1; }")
  different("function f() { return mask & ((2 ** index) ** next); }",
    "function f() { return mask & (2 ** (index ** next)); }")
  different("function f() { return (a || b) && c; }",
    "function f() { return a || (b && c); }")
  different("function f() { return (a?.b).c; }",
    "function f() { return a?.b.c; }")
  different("function f() { return (a?.b)(); }",
    "function f() { return a?.b(); }")
  different('function f() { "use strict"; return this; }',
    'function f() { ("use strict"); return this; }')
  different("function f() { return a; }", "function f() { return\n(a); }")
  different("function f() { return /* first */ a; }",
    "function f() { return /* changed */ (a); }")
  different("function f() { return (/* @ts-ignore */ a); }",
    "function f() { return (/* @ts-ignore */\n a); }")
  different('function f() { return "\\x61"; }',
    'function f() { return "a"; }')
  different('function f() { return tag`\\x61`; }',
    'function f() { return tag`a`; }')
}

type StructuralDifference = {
  path: string
  before: string
  after: string
}

function compactValue(value: unknown): string {
  if (value === undefined) return "undefined"
  if (value !== null && typeof value === "object") {
    if (Array.isArray(value)) return `array(length=${value.length})`
    const object = value as Record<string, unknown>
    return `object(keys=${Object.keys(object).slice(0, 8).join(",")};kind=${object.kind ?? "none"})`
  }
  const encoded = JSON.stringify(value)
  return encoded.length <= 180 ? encoded : encoded.slice(0, 177) + "..."
}

function firstStructuralDifference(
  before: unknown,
  after: unknown,
  path = "$",
): StructuralDifference | undefined {
  if (Object.is(before, after)) return undefined
  if (before === null || after === null || typeof before !== "object" ||
    typeof after !== "object" || Array.isArray(before) !== Array.isArray(after)) {
    return { path: path.slice(0, 700), before: compactValue(before), after: compactValue(after) }
  }
  const previous = before as Record<string, unknown>
  const current = after as Record<string, unknown>
  if (Array.isArray(before) && Array.isArray(after) && before.length !== after.length) {
    return { path: (path + ".length").slice(0, 700),
      before: String(before.length), after: String(after.length) }
  }
  const keys = [...new Set([...Object.keys(previous), ...Object.keys(current)])].sort()
  for (const key of keys) {
    const difference = firstStructuralDifference(previous[key], current[key],
      path + "." + key)
    if (difference) return difference
  }
  return undefined
}

export function verifyCompactDifferenceDiagnostics(): void {
  assert.equal(firstStructuralDifference({ a: [1, 2] }, { a: [1, 2] }), undefined)
  assert.deepEqual(firstStructuralDifference({ ast: { kind: 1 } }, { ast: { kind: 2 } }),
    { path: "$.ast.kind", before: "1", after: "2" })
  assert.deepEqual(firstStructuralDifference({ a: [] }, { a: {} }),
    { path: "$.a", before: "array(length=0)", after: "object(keys=;kind=none)" })
  assert.deepEqual(firstStructuralDifference({ a: [] }, { a: [0] }),
    { path: "$.a.length", before: "0", after: "1" })
  assert(compactValue("a".repeat(10_000)).length <= 180)
}

function git(repositoryRoot: string, args: string[]): Buffer {
  return execFileSync("git", args, { cwd: repositoryRoot,
    maxBuffer: maximumOutputBytes })
}

test("TEMP diagnostic: transport exact canonical consumer formatting", async () => {
  const repositoryRoot = realpathSync(process.cwd())
  const helperPath = realpathSync(fileURLToPath(import.meta.url))
  const manifestPath = realpathSync(fileURLToPath(new URL(
    "./format-pending-consumer.manifest.json", import.meta.url)))
  const manifestBytes = readFileSync(manifestPath)
  const manifest: FormatManifest = JSON.parse(manifestBytes.toString("utf8"))
  assert.equal(manifest.schema, "pending-consumer-canonical-format/v1")
  assert.equal(manifest.repository, "tscircuit/bus-lanes-solver")
  assert.equal(manifest.stackBasePullRequest, 203)
  assert.match(manifest.sourceCheckpointCommit, /^[0-9a-f]{40}$/)
  assert.match(manifest.publishManifestSha256, /^[0-9a-f]{64}$/)
  assert.match(manifest.biomeConfigSha256, /^[0-9a-f]{64}$/)
  assert.equal(manifest.biomeVersion, "2.5.15")
  assert.equal(manifest.typescriptVersion, "5.9.3")
  assert(manifest.files.length > 0, "Checkpoint file list is not populated")
  const publishManifestBytes = Buffer.from(manifest.publishManifestBase64, "base64")
  assert.equal(publishManifestBytes.toString("base64"), manifest.publishManifestBase64)
  assert.equal(sha256(publishManifestBytes), manifest.publishManifestSha256)
  const published = JSON.parse(publishManifestBytes.toString("utf8")) as {
    repository: string
    baseHead: string
    productionFileCount: number
    testAndNativeFileCount: number
    files: {
      repositoryPath: string; bytes: number; sha256: string
    }[]
  }
  assert.equal(published.repository, manifest.repository)
  assert.equal(published.baseHead, "779b9df28e7978760daf7f96df6a2d1a65c471b6")
  assert.equal(published.files.length,
    published.productionFileCount + published.testAndNativeFileCount)
  const publishedFiles = new Map<string, { bytes: number; sha256: string }>()
  for (const file of published.files) {
    assert(!publishedFiles.has(file.repositoryPath),
      `Duplicate published source ${file.repositoryPath}`)
    publishedFiles.set(file.repositoryPath, file)
  }
  const helperRelative = relative(repositoryRoot, helperPath).split(sep).join("/")
  const manifestRelative = relative(repositoryRoot, manifestPath).split(sep).join("/")
  assert(!helperRelative.startsWith("../"))
  assert(!manifestRelative.startsWith("../"))
  git(repositoryRoot, ["merge-base", "--is-ancestor",
    manifest.sourceCheckpointCommit, "HEAD"])
  const diagnosticChanges = git(repositoryRoot, ["diff", "--name-only", "-z",
    manifest.sourceCheckpointCommit, "HEAD"]).toString("utf8").split("\0")
    .filter(Boolean)
  const diagnosticAllowlist = new Set([helperRelative, manifestRelative])
  const addedFiles = new Set(git(repositoryRoot, ["diff", "--diff-filter=A",
    "--name-only", "-z", manifest.sourceCheckpointCommit, "HEAD"])
    .toString("utf8").split("\0").filter(Boolean))
  for (const diagnostic of manifest.additionalDiagnosticFiles) {
    assert((diagnostic.path.startsWith("tests/") &&
      diagnostic.path.endsWith(".test.ts")) ||
      diagnostic.path === ".github/workflows/pending-consumer-final-format.yml")
    assert(!diagnostic.path.includes("\\"))
    assert.equal(diagnostic.path.split("/").filter((part) =>
      part === "" || part === "." || part === "..").length, 0)
    assert(!diagnosticAllowlist.has(diagnostic.path))
    assert(addedFiles.has(diagnostic.path),
      "Additional diagnostic helper must be newly added after checkpoint")
    assert.match(diagnostic.sha256, /^[0-9a-f]{64}$/)
    assert(Number.isSafeInteger(diagnostic.bytes) && diagnostic.bytes > 0)
    const diagnosticPath = resolve(repositoryRoot, diagnostic.path)
    assert(diagnosticPath.startsWith(repositoryRoot + sep))
    assert.equal(realpathSync(diagnosticPath), diagnosticPath)
    assert(lstatSync(diagnosticPath).isFile())
    const diagnosticBytes = readFileSync(diagnosticPath)
    assert.equal(diagnosticBytes.length, diagnostic.bytes)
    assert.equal(sha256(diagnosticBytes), diagnostic.sha256)
    assert(diagnosticBytes.equals(git(repositoryRoot,
      ["show", `HEAD:${diagnostic.path}`])))
    diagnosticAllowlist.add(diagnostic.path)
  }
  assert(diagnosticChanges.every((path) => diagnosticAllowlist.has(path)),
  "Diagnostic branch changed checkpoint sources or configuration")
  const immutableSnapshots = new Map<string, Buffer>()
  for (const file of manifest.immutableFiles) {
    assert(!file.path.includes("\\"))
    assert.equal(file.path.split("/").filter((part) =>
      part === "" || part === "." || part === "..").length, 0)
    assert(!immutableSnapshots.has(file.path))
    assert(!manifest.files.some((selected) => selected.path === file.path))
    assert.match(file.sha256, /^[0-9a-f]{64}$/)
    assert.match(file.gitBlobSha1, /^[0-9a-f]{40}$/)
    const absolutePath = resolve(repositoryRoot, file.path)
    assert(absolutePath.startsWith(repositoryRoot + sep))
    assert.equal(realpathSync(absolutePath), absolutePath)
    assert(lstatSync(absolutePath).isFile())
    const bytes = readFileSync(absolutePath)
    assert.equal(bytes.length, file.bytes)
    assert.equal(sha256(bytes), file.sha256)
    assert.equal(createHash("sha1").update(Buffer.concat([
      Buffer.from(`blob ${bytes.length}\0`), bytes,
    ])).digest("hex"), file.gitBlobSha1)
    assert(bytes.equals(git(repositoryRoot,
      ["show", `${manifest.sourceCheckpointCommit}:${file.path}`])))
    const ownerFile = publishedFiles.get(file.path)
    if (ownerFile) {
      assert.equal(ownerFile.sha256, file.sha256)
      assert.equal(ownerFile.bytes, file.bytes)
    }
    immutableSnapshots.set(file.path, bytes)
  }
  assert(published.files.every((file) => immutableSnapshots.has(file.repositoryPath) ||
    manifest.files.some((selected) => selected.path === file.repositoryPath)),
  "Every owner source must be formatted or checked as immutable")
  const configPath = resolve(repositoryRoot, "biome.json")
  const configBefore = readFileSync(configPath)
  assert.equal(sha256(configBefore), manifest.biomeConfigSha256)
  assert(configBefore.equals(git(repositoryRoot,
    ["show", `${manifest.sourceCheckpointCommit}:biome.json`])))
  const require = createRequire(resolve(repositoryRoot, "package.json"))
  const ts = require("typescript") as typeof TypeScript
  assert.equal(ts.version, "5.9.3")
  verifyReturnParenthesesNormalization(ts)
  verifyCompactDifferenceDiagnostics()
  const biomePackagePath = require.resolve("@biomejs/biome/package.json")
  const biomePackage = JSON.parse(readFileSync(biomePackagePath, "utf8"))
  assert.equal(biomePackage.name, "@biomejs/biome")
  assert.equal(biomePackage.version, "2.5.15")
  const biomeBin = resolve(dirname(biomePackagePath),
    typeof biomePackage.bin === "string" ? biomePackage.bin : biomePackage.bin.biome)
  const runBiome = (args: string[]): string =>
    execFileSync(process.execPath, [biomeBin, ...args], {
      cwd: repositoryRoot, encoding: "utf8", maxBuffer: maximumOutputBytes,
      stdio: ["ignore", "pipe", "pipe"],
    })
  const cliVersion = runBiome(["--version"]).trim()
  assert.match(cliVersion, /^Version:\s*2\.5\.15$/)
  const seen = new Set<string>()
  const saved: SavedSource[] = []
  for (const requested of manifest.files) {
    assert.equal(typeof requested.path, "string")
    assert(!requested.path.includes("\\"))
    assert.equal(requested.path.split("/").filter((part) =>
      part === "" || part === "." || part === "..").length, 0)
    assert(/\.(ts|tsx|json)$/.test(requested.path))
    assert(!requested.path.startsWith(".github/"))
    assert(!requested.path.split("/").some((part) =>
      part === ".git" || part === "node_modules"))
    assert(!/^(?:biome|package|tsconfig(?:\.[^.]+)?)\.json$/.test(
      basename(requested.path)), "Formatter/config manifests are outside source scope")
    assert(!seen.has(requested.path), `Duplicate source ${requested.path}`)
    seen.add(requested.path)
    assert.match(requested.beforeSha256, /^[0-9a-f]{64}$/)
    assert(Number.isSafeInteger(requested.beforeBytes) && requested.beforeBytes > 0)
    const publishedFile = publishedFiles.get(requested.path)
    assert(publishedFile, `${requested.path} is absent from refreshed publish manifest`)
    assert.equal(requested.beforeSha256, publishedFile.sha256)
    assert.equal(requested.beforeBytes, publishedFile.bytes)
    const absolutePath = resolve(repositoryRoot, requested.path)
    assert(absolutePath.startsWith(repositoryRoot + sep))
    assert.equal(realpathSync(absolutePath), absolutePath, "Symlink source rejected")
    assert(lstatSync(absolutePath).isFile())
    assert(absolutePath !== helperPath && absolutePath !== manifestPath)
    const before = readFileSync(absolutePath)
    assert.equal(before.length, requested.beforeBytes)
    assert.equal(sha256(before), requested.beforeSha256)
    assert(before.equals(git(repositoryRoot,
      ["show", `${manifest.sourceCheckpointCommit}:${requested.path}`])),
    `Source ${requested.path} differs from official checkpoint`)
    saved.push({ path: requested.path, absolutePath, before,
      beforeSha256: requested.beforeSha256,
      beforeStructure: sourceStructure(ts, requested.path, before),
      kind: requested.path.endsWith(".json") ? "json-value" : "typescript-ast" })
  }
  let verified = false
  try {
    // Only the canonical formatter is invoked: no lint/check unsafe fixes,
    // config overrides, alternate versions, or extra input paths.
    const rejections: {
      path: string
      status: "rejected"
      stage: string
      beforeSha256: string
      afterSha256?: string
      difference?: StructuralDifference
      error?: string
    }[] = []
    const rejectedPaths = new Set<string>()
    for (const source of saved) {
      try {
        runBiome(["format", "--write", source.path])
      } catch (error) {
        rejectedPaths.add(source.path)
        rejections.push({ path: source.path, status: "rejected", stage: "format-write",
          beforeSha256: source.beforeSha256,
          error: (error instanceof Error ? error.message : String(error)).slice(0, 700) })
      }
    }
    const checked: { source: SavedSource; after: Buffer; afterStructure: string }[] = []
    for (const source of saved) {
      if (rejectedPaths.has(source.path)) continue
      let after: Buffer | undefined
      try {
        runBiome(["format", source.path])
        after = readFileSync(source.absolutePath)
        const afterStructure = sourceStructure(ts, source.path, after)
        const difference = firstStructuralDifference(JSON.parse(source.beforeStructure),
          JSON.parse(afterStructure))
        if (difference) {
          rejections.push({ path: source.path, status: "rejected", stage: "structure-or-comments",
            beforeSha256: source.beforeSha256, afterSha256: sha256(after), difference })
          continue
        }
        if (source.kind === "json-value") {
          assert.deepEqual(JSON.parse(after.toString("utf8")),
            JSON.parse(source.before.toString("utf8")))
        }
        checked.push({ source, after, afterStructure })
      } catch (error) {
        rejections.push({ path: source.path, status: "rejected", stage: "format-or-structure-build",
          beforeSha256: source.beforeSha256,
          afterSha256: after ? sha256(after) : undefined,
          error: (error instanceof Error ? error.message : String(error)).slice(0, 700) })
      }
    }
    assert(readFileSync(configPath).equals(configBefore), "Biome config changed")
    for (const [path, bytes] of immutableSnapshots) {
      assert(readFileSync(resolve(repositoryRoot, path)).equals(bytes),
        `Ignored/native/provenance source changed: ${path}`)
    }
    if (rejections.length) {
      // Evaluate every source first. Only compact failure descriptions and
      // hashes are emitted; no source packet is accepted or printed on failure.
      const diagnostics = rejections.map((rejection) =>
        marker + "_REJECTED " + JSON.stringify(rejection)).join("\n") + "\n" +
        marker + "_REJECTED_SUMMARY " + JSON.stringify({ status: "rejected",
          files: saved.length, rejectedFiles: rejections.length,
          immutableFileCount: immutableSnapshots.size,
          checkedUnchangedStructure: checked.length,
          diagnosticHead: git(repositoryRoot, ["rev-parse", "HEAD"]).toString("utf8").trim(),
          inputManifestSha256: sha256(manifestBytes),
          noFormattedSourcePacketsEmitted: true }) + "\n"
      assert(Buffer.byteLength(diagnostics) <= 128 * 1024,
        "Compact rejection diagnostics exceed their bound")
      assert.equal(await Bun.write(Bun.stdout, diagnostics), Buffer.byteLength(diagnostics))
      assert.fail(`Canonical formatting rejected ${rejections.length}/${saved.length} sources; see compact rejection records`)
    }
    assert.equal(checked.length, saved.length)
    const header = { schema: manifest.schema, repository: manifest.repository,
      sourceCheckpointCommit: manifest.sourceCheckpointCommit,
      diagnosticHead: git(repositoryRoot, ["rev-parse", "HEAD"]).toString("utf8").trim(),
      publishManifestSha256: manifest.publishManifestSha256,
      inputManifestSha256: sha256(manifestBytes),
      biomeConfigSha256: manifest.biomeConfigSha256,
      biomePackageVersion: biomePackage.version, biomeCliVersion: cliVersion,
      typescriptVersion: ts.version, fileCount: saved.length,
      immutableFileCount: immutableSnapshots.size,
      immutableManifestSha256: sha256(JSON.stringify(manifest.immutableFiles)) }
    const lines = [marker + "_BEGIN " + JSON.stringify(header)]
    let changedFiles = 0
    let rawBytes = 0
    let gzipBytes = 0
    for (const { source, after, afterStructure } of checked) {
      const changed = !after.equals(source.before)
      if (changed) changedFiles++
      rawBytes += after.length
      const compressed = gzipSync(after, { level: 9 })
      assert(gunzipSync(compressed).equals(after))
      gzipBytes += compressed.length
      const encoded = compressed.toString("base64")
      const parts = Math.ceil(encoded.length / chunkCharacters)
      lines.push(marker + "_FILE " + JSON.stringify({ path: source.path,
        beforeSha256: source.beforeSha256, afterSha256: sha256(after),
        beforeBytes: source.before.length, afterBytes: after.length, changed,
        verification: source.kind, structureSha256: sha256(afterStructure),
        gzipSha256: sha256(compressed), gzipBytes: compressed.length,
        base64Characters: encoded.length, parts }))
      for (let part = 0; part < parts; part++) {
        const payload = encoded.slice(part * chunkCharacters,
          (part + 1) * chunkCharacters)
        lines.push(marker + "_CHUNK " + JSON.stringify({ path: source.path,
          part, parts, payloadSha256: sha256(payload), payload }))
      }
    }
    assert(readFileSync(configPath).equals(configBefore), "Biome config changed")
    const body = lines.join("\n") + "\n"
    const output = body + marker + "_END " + JSON.stringify({
      files: saved.length, changedFiles, rawBytes, gzipBytes,
      bodySha256: sha256(body) }) + "\n"
    assert(Buffer.byteLength(output, "utf8") <= maximumOutputBytes,
      "Complete formatted transport exceeds 2 MiB; no partial records emitted")
    assert.equal(await Bun.write(Bun.stdout, output),
      Buffer.byteLength(output, "utf8"))
    verified = true
  } finally {
    // Failed verification restores the exact bytes and remains a failed test.
    // Only bounded rejection diagnostics may precede a failure. No partial or
    // unverified source bytes are emitted or accepted as formatted source.
    if (!verified) {
      for (const source of saved) writeFileSync(source.absolutePath, source.before)
    }
  }
})
