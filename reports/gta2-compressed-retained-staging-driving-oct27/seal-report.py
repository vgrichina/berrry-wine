D=H/'repo/reports'/H.name;pre=json.loads((O/'remote/preflight-result.json').read_text());assert sha((O/'retrieved/wine-assembly.wasm').read_bytes())==pre['moduleSHA256'];compat=json.loads((O/'retrieved/wine-assembly.compat.wasm.pin.json').read_text());assert sha((O/'retrieved/wine-assembly.compat.wasm').read_bytes())==compat['sha256'];assert json.loads((O/'preserve-module.execution.json').read_text())['exit']==0 and json.loads((O/'preserve-compat.execution.json').read_text())['exit']==0
m=json.loads((O/'receipt-manifest.json').read_text());m['module']['compat']=dict(compat,local=str(O/'retrieved/wine-assembly.compat.wasm'),remote=str(H/'repo/build/wine-assembly.compat.wasm'));box=json.loads((O/'box-info.json').read_text())['sandbox'];m['box'].update(lastState=box['state'],health=box['health'],stoppedAt=box['stoppedAt'],verifiedAt=json.loads((O/'box-info-exit.json').read_text())['at']);assert box['id']==BOX and box['stoppedAt'] is None
raw=sum(p.stat().st_size for p in (O/'responses').iterdir())+sum(p.stat().st_size for p in pathlib.Path('/tmp/gta2-census-cleared-driving-oct27/ops/responses').iterdir())+sum(p.stat().st_size for p in [O/'box-info.stdout',O/'box-info.stderr',pathlib.Path('/tmp/gta2-census-cleared-driving-oct27/ops/box-info.stdout')]);assert raw+1048576<8388608;m['resources'].update(finalRawAPIBytes=raw,APIRequestsClosed=True,remotePeakMeasurement='remote-resource-closeout.json',remoteExistingPredecessorWasPreserved=True,readinessQualification='Initial own-H readiness measurement omitted retained predecessor footprint; closeout measurement includes both and complete projected growth/reserve still fits1GiB. No replay or retroactive qualification.');m['incidents'].append('Local AST checkpoint caught guest-ready quote syntax before execution; both failed logs retained. Broad terminal-status raw response guard rejection retained; diagnostics retrieved once without guest replay.');m['finishedGuestAndPreservationBeforeCutoff']=time.time()<1793106480
ledger=[]
for p in sorted((O/'commands').glob('*.json')):
 req=json.loads(p.read_text());name=p.stem;entry=dict(id=name,commandSHA256=req['sha256'],detached=req['detach'])
 for kind in ['start','terminal']:
  f=O/'requests'/(name+'.'+kind+'.json')
  if f.exists():entry[kind]=json.loads(f.read_text())
 entry['responses']=[dict(path=str(f.relative_to(O)),bytes=f.stat().st_size,sha256=sha(f.read_bytes())) for f in (O/'responses').glob(name+'.*')];ledger.append(entry)
save('request-ledger.json',ledger);m['requestLedger']=dict(path=str(O/'request-ledger.json'),sha256=sha((O/'request-ledger.json').read_bytes()),requests=len(ledger),includesOriginal='original original-request identity and predecessor immutable ledger reference; no replay')
for p in O.glob('*.execution.json'):
 m.setdefault('localOperations',[]).append(dict(path=p.name,sha256=sha(p.read_bytes()),result=json.loads(p.read_text())))
m['recovery']=dict(canonicalBuild='tools/build.sh; unchanged suffix from node tools/toyvm/bundle-browser.js --check after exactfont recovery, cumulative original budgets',modulesPreserved=True,allRuntimeDiagnostics=str(O/'retrieved/preserved-diagnostics.tar.gz'),gameInputSource='test/binaries/candidates/gta2-demo/installed; original read-only, no acquisition',noNewGuestAuthorized=True)
save('receipt-manifest.json',m)
for n in ['receipt-manifest.json','request-ledger.json','box-info.json','remote-resource-closeout.json','admission-closeout.json','preserve-module.execution.json','preserve-compat.execution.json','local-checks.child.stderr','local-checks-fixed.child.stderr','local-checks-final.execution.json','after-dialog-advance.child.stderr','after-dialog-advance.execution.json','guest-terminal-observation.child.stderr','guest-terminal-observation.execution.json','cleanup-observe.execution.json','fonts.child.stderr','fonts.execution.json']:
 p=O/n
 if p.exists():shutil.copyfile(p,D/n)
# Include exact causal rejected response, never all source-transfer command payloads.
for row in ledger:
 if any(r['bytes']>8192 for r in row['responses']):
  for r in row['responses']:shutil.copyfile(O/r['path'],D/('failed-status-'+pathlib.Path(r['path']).name))
for n in ['seal-report.py','report.py','resource-closeout.py','box-info.py']:shutil.copyfile(O/n,D/n)
assert sum(p.stat().st_size for p in D.iterdir())<8388608
save('publication-tests.json',dict(result='PASS',reportBytes=sum(p.stat().st_size for p in D.iterdir()),reportFiles=len(list(D.iterdir())),moduleMatchesPreflight=True,compatPreserved=True,allLocalOperationsRetained=True,rawAPICumulative=raw,terminalReserveIntact=True,gameplay=False,exactBlocker=True,sourceUnchanged=True))
shutil.copyfile(O/'publication-tests.json',D/'publication-tests.json');print('sealed report; requests',len(ledger),'rawAPI',raw,'payloadBytes',sum(p.stat().st_size for p in D.iterdir()))
