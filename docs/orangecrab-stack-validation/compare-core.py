import datetime,hashlib,json,pathlib,re,sys
cfg_path=pathlib.Path(sys.argv[1]).resolve();cfg=json.loads(cfg_path.read_text())
assert re.fullmatch('[0-9a-f]{40}',cfg['head'].get('sourceCommit') or ''),'Final source required'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
bd=pathlib.Path(cfg['baselineDirectory']);hd=pathlib.Path(cfg['newOutputPaths']['coreDirectory']);rd=pathlib.Path(cfg['newOutputPaths']['reportDirectory']);pd=pathlib.Path(cfg['newOutputPaths']['pairDirectory'])
assert all('<' not in str(p) for p in [hd,rd,pd]),'Replace all pending output paths after final SHA is known'
for label in ['baseline','head']:
 p=pathlib.Path(cfg[label]['packageDirectory'])/'dist/index.js';assert sha(p)==cfg[label]['distributionSha256'],f'{label} frozen hash changed'
b=json.loads((bd/'results.json').read_text());h=json.loads((hd/'results.json').read_text())
assert b['schemaVersion']==h['schemaVersion']==1
bprov=json.loads((bd/'provenance.json').read_text());assert sha(bd/'results.json')==bprov['resultsSha256']
assert bprov['busSourceCommit']==cfg['baseline']['sourceCommit'] and bprov['busDistributionSha256']==cfg['baseline']['distributionSha256']
hprov=json.loads((hd/'provenance.json').read_text());assert sha(hd/'results.json')==hprov['resultsSha256']
assert hprov['busSourceCommit']==cfg['head']['sourceCommit'] and hprov['busDistributionSha256']==cfg['head']['distributionSha256']
ids={'h3','a64','stmp157','orangecrab','a13','h616','butterstick','glider','imx6','icepi'}
assert len(b['cases'])==len(h['cases'])==10
assert {c['circuit'] for c in b['cases']}==ids=={c['circuit'] for c in h['cases']}
assert all(c.get('assessment') is not None for c in b['cases']+h['cases']),'Missing validation is incomplete evidence'
keys=['coreCommit','benchmarkRevision','assessmentRevision','fixtureHashes','bunVersion','platform','cpu','dependencies','timeoutSeconds','geometryOnly']
equal={k:b[k]==h[k] for k in keys};assert all(equal.values()),'Changed harness/deps/fixtures/runtime/budgets need a new baseline'
assert h['coreCommit']==cfg['coreCommit'] and h['benchmarkRevision']==h['assessmentRevision']==cfg['benchmarkFingerprint']
assert h['timeoutSeconds']==cfg['timeoutSeconds']==120 and not h['geometryOnly']
assert h['bunVersion']=='1.4.3' and h['platform']=='linux x64' and h['cpu']=='AMD EPYC 7763 64-Core Processor'
assert all(p['cacheStatus']=='disabled' for c in b['cases']+h['cases'] for p in c['progress']['phases'])
physical=['trace_overlap','pad_trace','via_trace','via_pad','via_spacing','contiguous','via_in_pad','hole_trace','width']
bby={c['circuit']:c for c in b['cases']}
def row(c):
 a=c['assessment'];f=a['findings'];return {'status':c['status'],'connected':a['connectedNets'],'requested':a['requestedNets'],'wallSeconds':c['wallMs']/1000,'physicalFindings':sum(f.get(k,0) for k in physical),'geometryErrors':len(a['geometryErrors']),'nativeFindings':f,'nativeConnectivityFindings':f.get('missing_traces',0)+f.get('disconnected_ports',0),'phases':c['progress']['phases']}
rows=[];phases=[]
for c in h['cases']:
 name=c['circuit'];bc=bby[name];br,hr=row(bc),row(c);assert br['requested']==hr['requested'];rows.append({'circuit':name,'main':br,'head':hr,'connectedDelta':hr['connected']-br['connected']})
 bp={p['phase']:p for p in bc['progress']['phases']}
 for p in c['progress']['phases']:
  q=bp.get(p['phase'])
  if p['solver']!='BusLanesPipelineSolver' or p['status']!='completed' or not q or q['status']!='completed':continue
  paths=[bd/name/f"phase-{q['stage']+1}-start.srj.json",bd/name/f"phase-{q['stage']+1}-end.srj.json",hd/name/f"phase-{p['stage']+1}-start.srj.json",hd/name/f"phase-{p['stage']+1}-end.srj.json"]
  x={'circuit':name,'phase':p['phase'],'allCapturesPresent':all(v.exists() for v in paths),'paths':[str(v) for v in paths]}
  if x['allCapturesPresent']:
   bi,bo,hi,ho=[json.loads(v.read_text()) for v in paths];x.update({'startSrjEqual':bi==hi,'endSrjEqual':bo==ho,'sha256':[sha(v) for v in paths]})
  phases.append(x)
assert sum(r['main']['requested'] for r in rows)==606
summary={'mainPassed':sum(c['status']=='passed' for c in b['cases']),'headPassed':sum(c['status']=='passed' for c in h['cases']),'mainConnected':sum(r['main']['connected'] for r in rows),'headConnected':sum(r['head']['connected'] for r in rows),'requested':sum(r['main']['requested'] for r in rows),'partialDeclines':[r['circuit'] for r in rows if r['connectedDelta']<0],'baselinePassBoardsPreserved':all(r['head']['status']=='passed' for r in rows if r['main']['status']=='passed'),'mainPhysicalFindings':sum(r['main']['physicalFindings'] for r in rows),'headPhysicalFindings':sum(r['head']['physicalFindings'] for r in rows),'mainGeometryErrors':sum(r['main']['geometryErrors'] for r in rows),'headGeometryErrors':sum(r['head']['geometryErrors'] for r in rows)}
summary['h616AndGliderPassedBoth']=all(next(r for r in rows if r['circuit']==name)[side]['status']=='passed' for name in ['h616','glider'] for side in ['main','head'])
pair=json.loads((pd/'comparison.json').read_text()) if (pd/'comparison.json').exists() else None
if pair:
 assert pair['head']['sourceCommit']==cfg['head']['sourceCommit'] and pair['head']['bundleSha256']==cfg['head']['distributionSha256'],'Prior revision timing is not final revision timing'
orange=next(c for c in h['cases'] if c['circuit']=='orangecrab');oa=orange['assessment'];orange_ok=orange['status']=='passed' and oa['connectedNets']==oa['requestedNets']==50 and orange['progress']['renderCompleted'] and not orange['progress']['errors'] and all(p['status']=='completed' for p in orange['progress']['phases']) and not oa['geometryErrors'] and not any(oa['findings'].values())
report={'finalConfig':cfg,'configSha256':sha(cfg_path),'metadataEqual':equal,'summary':summary,'cases':rows,'completedByteGeometry':phases,'freshOrangeCrabCompletedCaptureEligible':orange_ok,'orangeCrabFreshCircuitPath':str(hd/'orangecrab/circuit.json') if orange_ok else None,'freshA64Pair':pair,'resultsSha256':{'main':sha(bd/'results.json'),'head':sha(hd/'results.json')},'recordedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
rd.mkdir(parents=True,exist_ok=True);assert not (rd/'core-comparison.json').exists(),'Preserve prior comparison report'
(rd/'core-comparison.json').write_text(json.dumps(report,indent=2)+'\n')
lines=['# Final core DDR comparison','',f"Complete boards {summary['mainPassed']}/10 → {summary['headPassed']}/10; connected nets {summary['mainConnected']}/{summary['requested']} → {summary['headConnected']}/{summary['requested']}. Baseline pass boards preserved: {summary['baselinePassBoardsPreserved']}. Partial declines: {', '.join(summary['partialDeclines']) or 'none'}.",'','| Case | Main | Main nets | Head | Head nets | Main s | Head s | Main/head physical findings | Main/head geometry errors |','|---|---|---:|---|---:|---:|---:|---:|---:|']
for r in rows:
 m,n=r['main'],r['head'];lines.append(f"| {r['circuit']} | {m['status']} | {m['connected']}/{m['requested']} | {n['status']} | {n['connected']}/{n['requested']} | {m['wallSeconds']:.2f} | {n['wallSeconds']:.2f} | {m['physicalFindings']}/{n['physicalFindings']} | {m['geometryErrors']}/{n['geometryErrors']} |")
lines+=['',f"Fresh OrangeCrab completed-capture eligible: {orange_ok}. A timeout or retained partial circuit cannot be exported as a successful board.",'',f"Comparable completed bus-stage starts: {sum(x.get('startSrjEqual',False) for x in phases)}; equal completed end SRJs among those: {sum(x.get('startSrjEqual',False) and x.get('endSrjEqual',False) for x in phases)}. All per-case native finding categories, stage outcomes and capture hashes are retained in JSON.",'']
if pair and pair['completedAndValidated']:
 m,n=pair['main'],pair['head'];lines += [f"Fresh isolated A64 phase-3 main/head solver walltime: {m['solveSeconds']:.3f}s → {n['solveSeconds']:.3f}s. Both full outputs equal original main: {m['fullOutputEqualOriginalMainOutput'] and n['fullOutputEqualOriginalMainOutput']}; fixed copper,8connections/16endpoints and native DRC validated. This timing claim applies only to this fresh final pair.",'']
else:lines+=['No fresh final-revision A64 pair is present. The190 measurement is prior evidence and does not establish this head’s timing.','']
lines+=['Full-board timings are observational; OrangeCrab has shown deadline variance. Do not call routing-only passes length-matching passes. The core harness does not establish per-bus length skew, pair skew or coupling acceptance.','',f"Main source `{cfg['baseline']['sourceCommit']}`, dist `{cfg['baseline']['distributionSha256']}`. Final head source `{cfg['head']['sourceCommit']}`, dist `{cfg['head']['distributionSha256']}`.",f"Core `{cfg['coreCommit']}`, fixture package `{cfg['benchmarkPackagePin']}`, harness `{cfg['benchmarkFingerprint']}`; identical recorded runtime/dependencies/fixtures/budgets. Resource provenance and exact commands must be finalized in the new run’s provenance.json."]
(rd/'core-comparison.md').write_text('\n'.join(lines)+'\n');print(json.dumps(summary,indent=2))
