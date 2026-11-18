"""Read-only launch provenance:352 recorded direct-package files, not all transitive files."""
import hashlib,json,pathlib
manifest_path=pathlib.Path('/workspace/ddr-results/core-main-installed-provenance.json')
manifest=json.loads(manifest_path.read_text());root=pathlib.Path('/workspace/core/node_modules');count=0
for name,recorded in manifest['packages'].items():
 if name=='@tscircuit/bus-lanes-solver':continue
 package=root/name;actual_version=json.loads((package/'package.json').read_text())['version'];assert actual_version==recorded['version'],name
 for relative,expected in recorded['fileSha256'].items():
  assert hashlib.sha256((package/relative).read_bytes()).hexdigest()==expected,(name,relative);count+=1
 print(name,len(recorded['fileSha256']),'recorded files match')
assert count==352
print('352 recorded direct-dependency files match original installation; no exhaustive transitive-file assertion')
