import json, pathlib, hashlib, datetime
root = pathlib.Path("/workspace/ddr-results")
base_dir = root/"core-main"
head_dir = root/"core-head-native-inner"
base = json.loads((base_dir/"results.json").read_text())
head = json.loads((head_dir/"results.json").read_text())
expected_circuits={"h3","a64","stmp157","orangecrab","a13","h616","butterstick","glider","imx6","icepi"}
assert len(base["cases"])==10 and len(head["cases"])==10, "Comparison requires all ten fresh case outcomes"
assert {c["circuit"] for c in base["cases"]}==expected_circuits=={c["circuit"] for c in head["cases"]}
assert all(c.get("assessment") is not None for c in base["cases"]+head["cases"]), "Missing assessment is incomplete validation, not zero physical errors"
assert hashlib.sha256((root/"packages/bus-main/dist/index.js").read_bytes()).hexdigest()=="fa6390c904b678f7dc197d0d3d671a28e273554369f8475457ea86374c5dad8c"
assert hashlib.sha256((root/"packages/bus-head-native-inner/dist/index.js").read_bytes()).hexdigest()=="940e910143a475e280ed3cdc7a0bb262daf98c0fdb075d82b95cbfb2b496f2f8"
base_by = {c["circuit"]:c for c in base["cases"]}
assert all(base_by[c["circuit"]]["assessment"]["requestedNets"]==c["assessment"]["requestedNets"] for c in head["cases"])

physical_keys = ["trace_overlap", "pad_trace", "via_trace", "via_pad", "via_spacing", "contiguous", "via_in_pad", "hole_trace", "width"]
def info(c):
    a = c.get("assessment") or {}
    f = a.get("findings", {})
    return {"status":c["status"], "connected":a.get("connectedNets"), "requested":a.get("requestedNets"), "wallSeconds":c["wallMs"]/1000, "peakRssMb":c["peakRssMb"], "physicalFindings":sum(f.get(k,0) for k in physical_keys), "geometryErrors":len(a.get("geometryErrors",[])), "findings":f, "wireLengthMm":a.get("wireLengthMm"), "phases":[{"phase":x["phase"],"status":x["status"],"connections":x["connections"],"durationSeconds":x["durationMs"]/1000 if x["durationMs"] is not None else None} for x in (c.get("progress") or {}).get("phases",[])]}
rows = []
for c in head["cases"]:
    b = base_by[c["circuit"]]
    bi, hi = info(b), info(c)
    rows.append({"circuit":c["circuit"],"main":bi,"head":hi,"connectedDelta":hi["connected"]-bi["connected"] if hi["connected"] is not None and bi["connected"] is not None else None})
summary = {"mainCases":len(base["cases"]),"headCases":len(head["cases"]),"mainPassed":sum(c["status"]=="passed" for c in base["cases"]),"headPassed":sum(c["status"]=="passed" for c in head["cases"]),"mainConnected":sum((c.get("assessment") or {}).get("connectedNets",0) for c in base["cases"]),"headConnected":sum((c.get("assessment") or {}).get("connectedNets",0) for c in head["cases"]),"requestedNets":sum((c.get("assessment") or {}).get("requestedNets",0) for c in base["cases"]),"mainPhysicalFindings":sum(info(c)["physicalFindings"] for c in base["cases"]),"headPhysicalFindings":sum(info(c)["physicalFindings"] for c in head["cases"]),"mainGeometryErrors":sum(info(c)["geometryErrors"] for c in base["cases"]),"headGeometryErrors":sum(info(c)["geometryErrors"] for c in head["cases"]),"partialDeclines":[r["circuit"] for r in rows if r["connectedDelta"] is not None and r["connectedDelta"]<0],"baselinePassBoardsPreserved":all(any(r["circuit"]==i and r["head"]["status"]=="passed" for r in rows) for i in ["h616","glider"])}
metadata_keys=["coreCommit","benchmarkRevision","assessmentRevision","fixtureHashes","bunVersion","platform","cpu","dependencies","timeoutSeconds","geometryOnly"]
comparison = {"headBusSourceCommit":"190325da97253ad7951f9dfd3b0046b4afcb5395","headDistributionSha256":hashlib.sha256((root/"packages/bus-head-native-inner/dist/index.js").read_bytes()).hexdigest(),"mainSourceCommit":"202b034659fb96bad44d11b8190f4044b675116f","mainDistributionSha256":hashlib.sha256((root/"packages/bus-main/dist/index.js").read_bytes()).hexdigest(),"baselinePath":str(base_dir),"headPath":str(head_dir),"recordedAtUtc":datetime.datetime.now(datetime.timezone.utc).isoformat(),"metadataEqual":{k:base.get(k)==head.get(k) for k in metadata_keys},"summary":summary,"cases":rows,"caveats":["Original pinned main and final pinned head are fresh solves with same fixtures/harness/budgets/runtime/dependency tree and serial local resources. They run at different times; full-board walltimes are observational, not an isolated bus speedup.","A timeout can include valid retained partial routes. It is not a completed board.","This core benchmark does not request or establish bus length matching, pair skew or coupling acceptance; routing-only pass must not be called a length-matching pass."]}
assert all(comparison["metadataEqual"].values()), "Metadata differs; do not publish a same-harness comparison"
(root/"final-core-comparison.json").write_text(json.dumps(comparison,indent=2)+"\n")
lines=["# Final core DDR comparison", "", f"Pinned main `{comparison['mainSourceCommit']}` versus final head `{comparison['headBusSourceCommit']}`.", "", f"Fresh complete boards: **{summary['mainPassed']}/10 → {summary['headPassed']}/10**. Connected requested nets: **{summary['mainConnected']}/{summary['requestedNets']} → {summary['headConnected']}/{summary['requestedNets']}**. Head has {summary['headPhysicalFindings']} native physical findings and {summary['headGeometryErrors']} geometry errors.", "", "| Case | Main status | Main nets | Head status | Head nets | Delta | Main s | Head s | Head physical / geometry |", "|---|---|---:|---|---:|---:|---:|---:|---:|"]
for r in rows:
    b,h=r["main"],r["head"]
    lines.append(f"| {r['circuit']} | {b['status']} | {b['connected']}/{b['requested']} | {h['status']} | {h['connected']}/{h['requested']} | {r['connectedDelta']:+d} | {b['wallSeconds']:.2f} | {h['wallSeconds']:.2f} | {h['physicalFindings']} / {h['geometryErrors']} |")
lines += ["", "Baseline H616 and Glider passes preserved: "+str(summary["baselinePassBoardsPreserved"])+".", "Partial connectivity declines: "+(", ".join(summary["partialDeclines"]) or "none")+".", "", "## Per-stage evidence", ""]
for r in rows:
    lines.append("### "+r["circuit"])
    lines.append("")
    for side in ["main","head"]:
        parts=[]
        for x in r[side]["phases"]:
            t=f"{x['durationSeconds']:.3f}s" if x['durationSeconds'] is not None else "unfinished"
            parts.append(f"{x['phase']} {x['status']} ({x['connections']} requests, {t})")
        lines.append(side+": "+"; ".join(parts)+".")
    lines.append("")
lines += ["## Limits and provenance", ""]+["- "+s for s in comparison["caveats"]]
lines += ["", "Commands, hashes, source revisions, resource limits, baseline report and raw per-case outputs are retained in `/workspace/ddr-results/core-head-native-inner/provenance.json`, `/workspace/ddr-results/core-main/provenance.json`, both `results.json` files, and `/workspace/ddr-results/core-head-native-inner.run.log`."]
(root/"final-core-comparison.md").write_text("\n".join(lines)+"\n")
print(json.dumps(summary,indent=2))
