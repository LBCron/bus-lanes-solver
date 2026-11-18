const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const repo = '/workspace/bus-lanes-work'
const ci = '/workspace/ddr-results/am3352-ci/190325d'
const headSha = '190325da97253ad7951f9dfd3b0046b4afcb5395'
const mainSha = '202b034659fb96bad44d11b8190f4044b675116f'
const nativeReferenceSha = 'ec82ec2442d6c03f680d3f9735b94877a3e83559'
const names = JSON.parse(fs.readFileSync(path.join(repo, 'scripts/pr-benchmark/samples.json')))
const galleries = ['am3352-native-carrier-regression', 'routed-am3352-placements', 'routed-am3352-surface-constraints']
const hash = value => crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex')

function differences(a, b, property = '', output = []) {
  if (typeof a === 'number' && typeof b === 'number') {
    if (a !== b) output.push({ path: property, left: a, right: b, absolute: Math.abs(a - b) })
    return output
  }
  if (a === b) return output
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    output.push({ path: property, left: a, right: b, absolute: null })
    return output
  }
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
  for (const key of keys) differences(a[key], b[key], property ? property + '.' + key : key, output)
  return output
}

function accepted(worker) {
  const report = worker?.report
  const validation = report?.validation
  return worker?.exitCode === 0 && worker.error === null && !worker.missing && !worker.timedOut &&
    report?.status === 'solved' && report.solved === true && report.error === null &&
    report.requestedSignals === 47 && report.routedSignals === 47 && report.fixedPowerDogbones === 161 &&
    report.inputUnchanged === true && report.fixedPowerPreserved === true &&
    validation?.valid === true && validation.complete === true && validation.matched === true &&
    validation.fixedDrc?.valid === true && validation.combinedDrc?.valid === true &&
    validation.fixedPowerTraces === 161 && validation.fixedPowerVias === 161 && validation.fixedPowerPadJoins === 161 &&
    validation.quality?.pairGaps?.length === 3 && validation.quality.pairGaps.every(pair => pair.matched && pair.sharedSectionPresent) &&
    validation.quality?.exteriorPairGaps?.length === 3 && validation.quality.exteriorPairGaps.every(pair => pair.matched)
}

const cases = names.map(name => JSON.parse(fs.readFileSync(path.join(ci, name, name + '.json'))))
if (cases.length !== 11 || cases.some((pair, index) => pair.sample !== names[index] ||
  pair.metadata.prSha !== headSha || pair.metadata.mainSha !== mainSha || pair.metadata.controllerSha !== mainSha ||
  pair.timeoutSeconds !== 3600 || !accepted(pair.main) || !accepted(pair.pr) ||
  pair.main.report.inputSha256 !== pair.pr.report.inputSha256)) {
  throw Error('Retained-reference comparison requires all 11 accepted and comparable final190 main/PR pairs')
}

const report = {
  generatedAt: new Date().toISOString(), ciSource: ci, ciHeadSha: headSha, ciMainSha: mainSha,
  ciSamples: cases.map(pair => pair.sample),
  claims: {
    freshCiHasGeometryHash: false,
    retainedImagesProveExactFreshCopperIdentity: false,
    label: 'Native gallery images are prior ec82 completed-route references. Older galleries retain their recorded provenance. Fresh final190 CI measurements are a separate comparison; exact fresh copper identity is not established.'
  },
  galleries: []
}

for (const directory of galleries) {
  const dir = path.join(repo, 'docs', directory)
  const benchmarkFile = path.join(dir, 'benchmark-results.json')
  const priorReports = JSON.parse(fs.readFileSync(benchmarkFile))
  const manifestFile = path.join(dir, 'artifact-manifest.json')
  const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile)) : null
  const originalSolverCommit = manifest?.solverCommit ?? manifest?.solverIdentity?.commit ?? null
  if (directory === 'am3352-native-carrier-regression' && originalSolverCommit !== nativeReferenceSha) {
    throw Error('Native reference gallery provenance differs from the recorded ec82 source')
  }
  const gallery = {
    directory: 'docs/' + directory,
    label: directory === 'am3352-native-carrier-regression' ? 'Prior ec82 completed-route references; fresh final190 measurements are separate.' : 'Prior completed-route references with original recorded provenance; solver commit is not recorded in this manifest.',
    benchmarkSha256: hash(fs.readFileSync(benchmarkFile)),
    manifestSha256: manifest ? hash(fs.readFileSync(manifestFile)) : null,
    originalSolverCommit, comparisons: [], pngIntegrity: []
  }
  for (const pair of cases) {
    const prior = priorReports.find(item => item.sample === pair.sample)
    if (!prior) {
      gallery.comparisons.push({ sample: pair.sample, missingPrior: true })
      continue
    }
    const head = pair.pr.report
    const base = pair.main.report
    const diff = differences(prior.validation, head.validation)
    const numeric = diff.filter(item => item.absolute !== null)
    const other = diff.filter(item => item.absolute === null)
    gallery.comparisons.push({
      sample: pair.sample, ciSha: pair.metadata.prSha, baseSha: pair.metadata.mainSha,
      priorInputSha256: prior.inputSha256 ?? null, ciInputSha256: head.inputSha256,
      inputIdentical: typeof prior.inputSha256 === 'string' ? prior.inputSha256 === head.inputSha256 : null,
      inputComparisonStatus: typeof prior.inputSha256 !== 'string' ? 'unavailable (prior input hash not recorded)' : prior.inputSha256 === head.inputSha256 ? 'identical' : 'different',
      priorIterations: prior.iterations, ciIterations: head.iterations,
      iterationsIdentical: prior.iterations === head.iterations, ciBaseIterations: base.iterations,
      ciBaseHeadValidationExact: JSON.stringify(base.validation) === JSON.stringify(head.validation),
      priorSolved: prior.solved, ciSolved: head.solved,
      layerCountsIdentical: JSON.stringify(prior.carrierLayerCounts) === JSON.stringify(head.carrierLayerCounts),
      priorValidationSha256: hash(prior.validation), ciValidationSha256: hash(head.validation),
      validationExact: diff.length === 0, numberDifferences: numeric.length,
      maxAbsoluteNumberDifference: numeric.length ? Math.max(...numeric.map(item => item.absolute)) : 0,
      numberDifferencesAbove1e9: numeric.filter(item => item.absolute > 1e-9).length,
      otherDifferences: other,
      largestDifferences: [...numeric].sort((a, b) => b.absolute - a.absolute).slice(0, 8),
      allDifferences: diff
    })
  }
  const images = Array.isArray(manifest) ? manifest : manifest?.images ?? []
  for (const image of images) {
    const filename = image.pngFile ?? image.file ?? image.filename
    const file = filename ? path.join(dir, filename) : null
    const exists = file !== null && fs.existsSync(file) && fs.statSync(file).isFile()
    const recorded = image.pngSha256 ?? image.sha256 ?? null
    const actual = exists ? hash(fs.readFileSync(file)) : null
    gallery.pngIntegrity.push({
      sample: image.sample ?? (filename ? path.basename(filename).replace(/-solved\.png$/, '') : null),
      pngFile: filename ? path.basename(filename) : null,
      recordedSha256: recorded, actualSha256: actual, missing: !exists,
      hashMatches: exists && recorded !== null && recorded === actual,
      recordedSignalTracesSha256: image.signalTracesSha256 ?? null,
      recordedOutputSha256: image.outputSha256 ?? null
    })
  }
  report.galleries.push(gallery)
}

fs.writeFileSync('/workspace/ddr-results/am3352-gallery/retained-reference-comparison.json', JSON.stringify(report, null, 2) + '\n')
for (const gallery of report.galleries) {
  console.log(gallery.directory, gallery.originalSolverCommit)
  for (const pair of gallery.comparisons) console.log(pair.sample, JSON.stringify({ input: pair.inputIdentical, iterations: [pair.priorIterations, pair.ciIterations], exact: pair.validationExact, numericDiff: pair.numberDifferences, maxAbs: pair.maxAbsoluteNumberDifference, large: pair.numberDifferencesAbove1e9, other: pair.otherDifferences?.length, baseHeadExact: pair.ciBaseHeadValidationExact }))
  console.log('png integrity', gallery.pngIntegrity.length, gallery.pngIntegrity.every(image => image.hashMatches))
}
