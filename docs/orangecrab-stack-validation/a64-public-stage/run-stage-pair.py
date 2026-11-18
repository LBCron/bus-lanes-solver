import datetime,hashlib,json,os,pathlib,re,signal,subprocess,sys,time
config_path=pathlib.Path(sys.argv[1]).resolve()
config=json.loads(config_path.read_text())
assert re.fullmatch(r"[0-9a-f]{40}", config["head"].get("sourceCommit") or ""), "Root must supply final source before any run"
assert re.fullmatch(r"[0-9a-f]{64}", config["head"].get("distributionSha256") or ""), "Root must supply final frozen bundle hash"
assert hashlib.sha256((pathlib.Path(config["head"]["packageDirectory"])/"dist/index.js").read_bytes()).hexdigest()==config["head"]["distributionSha256"]
assert "<" not in config["newOutputPaths"]["pairDirectory"]
base_result=json.loads((pathlib.Path(config["baselineDirectory"])/"results.json").read_text())
assert len(base_result["cases"])==10, "Finish the fresh baseR ten-case core run before the isolated pair"
core_result=json.loads((pathlib.Path(config["newOutputPaths"]["coreDirectory"])/"results.json").read_text())
assert len(core_result["cases"])==10, "Finish the new ten-case core run before the isolated stage pair"
out=pathlib.Path(config["newOutputPaths"]["pairDirectory"])
assert not out.exists(), 'Preserve prior pair results; output directory already exists'
out.mkdir()
runner='/workspace/ddr-results/prepared-post-handbook/a64-public-stage.ts'
bun='/workspace/.tools/bun-1.4.3/node_modules/bun/bin/bun.exe'
records=[]
for label in ['main','head']:
    prefix=str(out/label)
    command=[bun,runner,label,prefix,str(config_path)]
    rec={'label':label,'command':command,'cwd':'/workspace/core','externalLimitSeconds':120,'watchdog':'Python subprocess.communicate(timeout=120); SIGKILL entire isolated child process group on timeout','startedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'running'}
    ext=out/f'{label}.external.json'
    ext.write_text(json.dumps(rec,indent=2)+'\n')
    start=time.monotonic()
    with (out/f'{label}.run.log').open('w') as log:
        proc=subprocess.Popen(command,cwd='/workspace/core',stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
        rec['pid']=proc.pid
        try:
            proc.communicate(timeout=120)
            rec['status']='exited'
        except subprocess.TimeoutExpired:
            os.killpg(proc.pid,signal.SIGKILL)
            proc.communicate()
            rec['status']='external_timeout'
    rec.update({'externalWallSeconds':time.monotonic()-start,'exitCode':proc.returncode,'endedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()})
    ext.write_text(json.dumps(rec,indent=2)+'\n')
    records.append(rec)
    resultfile=out/f'{label}.result.json'
    result=json.loads(resultfile.read_text()) if resultfile.exists() else {}
    print(json.dumps({'label':label,'external':rec,'resultStatus':result.get('status'),'solveSeconds':result.get('solveSeconds'),'iterations':result.get('solverIterations'),'nativeDrcValid':result.get('nativeDrcValid')}),flush=True)
main=json.loads((out/'main.result.json').read_text()) if (out/'main.result.json').exists() else {'completed':False,'status':'startup_failed_no_worker_result'}
head=json.loads((out/'head.result.json').read_text()) if (out/'head.result.json').exists() else {'completed':False,'status':'startup_failed_no_worker_result'}
complete=all(x.get('completed') is True for x in [main,head]) and all(x['status']=='exited' and x['exitCode']==0 for x in records)
comparison={'finalConfig':config,'main':main,'head':head,'external':records,'freshSeparateProcesses':True,'serialExecution':True,'otherLocalHeavyWorkHeldByRoot':True,'completedAndValidated':complete,'harnessSha256':hashlib.sha256(pathlib.Path(runner).read_bytes()).hexdigest(),'wrapperSha256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()}
if complete:
    assert main['adaptedInputJsonSha256']==head['adaptedInputJsonSha256']
    assert main['requestedRoutesJsonSha256']==head['requestedRoutesJsonSha256']==main['referenceRequestedRoutesJsonSha256']
    assert main['fixedTraceJsonSha256']==head['fixedTraceJsonSha256']
    assert all(x['nativeDrcValid'] and x['nativeConnectivityValid'] and x['fixedTracePrefixUnchanged'] and x['adaptedInputUnchanged'] and x['requestedRouteArraysEqualOriginalMainOutput'] for x in [main,head])
    comparison.update({'requestedRouteArraysEqualBetweenFreshRuns':True,'allEightRouteArraysEqualOriginalMain':True,'solverWallRatioMainOverHead':main['solveSeconds']/head['solveSeconds'],'solverWallReductionPercent':100*(main['solveSeconds']-head['solveSeconds'])/main['solveSeconds'],'scope':'One fresh isolated public A64 phase-3 byte2 solve on exact captured raw stage input; not a full-board speedup or length-matching acceptance claim.'})
(out/'comparison.json').write_text(json.dumps(comparison,indent=2)+'\n')
print(json.dumps({'completedAndValidated':complete,'solverWallRatioMainOverHead':comparison.get('solverWallRatioMainOverHead'),'solverWallReductionPercent':comparison.get('solverWallReductionPercent')}),flush=True)
