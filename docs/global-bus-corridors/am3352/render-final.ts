import { join } from 'node:path'
import { SAMPLE_NAMES, renderComparison, summarizeComparison } from '/workspace/bus-lanes-work/scripts/pr-benchmark/report.ts'

const root = '/workspace/ddr-results/am3352-ci/190325d'
const samples = await Promise.all(SAMPLE_NAMES.map(sample => Bun.file(join(root, sample, sample + '.json')).json()))
const options = {
  samples,
  mainSha: '202b034659fb96bad44d11b8190f4044b675116f',
  prSha: '190325da97253ad7951f9dfd3b0046b4afcb5395',
  controllerSha: '202b034659fb96bad44d11b8190f4044b675116f',
  prNumber: 218,
  timeoutSeconds: 3600,
  runUrl: 'https://github.com/tscircuit/bus-lanes-solver/actions/runs/44382576930',
}
const summary = summarizeComparison(options)
if (!summary.artifactComplete || !summary.inputComparable || !summary.metadataComparable || summary.main.accepted !== 11 || summary.pr.accepted !== 11) {
  throw Error('Final report requires all 11 accepted comparable fresh base/head pairs')
}
await Bun.write(join(root, 'comparison.md'), renderComparison(options))
await Bun.write(join(root, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify({ artifactComplete: summary.artifactComplete, inputComparable: summary.inputComparable, metadataComparable: summary.metadataComparable, main: summary.main, pr: summary.pr, lost: summary.lost, gained: summary.gained, matched: summary.matched }, null, 2))
