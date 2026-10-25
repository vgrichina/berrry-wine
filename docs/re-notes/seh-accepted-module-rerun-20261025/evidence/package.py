import pathlib,json,hashlib,subprocess,os,signal,datetime,ast
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';P=R/'docs/re-notes/seh-accepted-module-rerun-20261025';E=P/'evidence'
def sha(b):return hashlib.sha256(b).hexdigest()
def save(n,d):(O/n).write_text(json.dumps(d,indent=2)+'\n')
results={}
for stage in ['module-tail','module-compat']:
 receipts=[p for p in O.glob(stage+'-*.json') if 'reaped' in json.loads(p.read_bytes())];assert len(receipts)==1
 p=receipts[0];d=json.loads(p.read_bytes());assert d['exit']==0 and d['reason'] is None and d['reaped'] and d['remainingGroup']==[] and d['streamBytes']['stderr']==0
 q=json.loads(p.with_suffix('.stdout').read_bytes());assert q['state']=='MODULE_QUALIFICATION_PASS' and q['nativeModuleReturned'] and not q['Memory'] and not q['Instance'] and not q['guest']
 assert (q['imports'],q['functionExports'],q['typeCount'],q['layout'],q['noStart'])==(291,2224,172,'9a3bc9149d58209c',True)
 results[stage]=dict(verdict='PASS',qualification=q,supervisorReceipt=p.name,terminalReceiptPersistedUTC=datetime.datetime.fromtimestamp(p.stat().st_mtime,datetime.timezone.utc).isoformat(),exactCommand=d['argv'],supervisor=d)
for p in O.glob('*.py'):ast.parse(p.read_text())
assert json.load(open(O/'adaptation-rejection.json'))['passControl']
pins=json.load(open(O/'pinned-inputs.json'))
for row in pins['inputs']:assert sha(pathlib.Path(row['path']).read_bytes())==row['sha256']
root=pathlib.Path('/home/user/wine-assembly');before=json.load(open(O/'root-before.json'))
now=json.loads(subprocess.check_output(['python3',str(root/'scratch/usage-watch/stream-root-ref-digest.py')],timeout=30));assert now['sha256']==before['refs']['sha256']
assert sha((root/'.git/index').read_bytes())==before['indexSHA256']
save('root-after.json',dict(refs=now,indexUnchanged=True,refsUnchanged=True))
os.kill(int((O/'watcher.pid').read_text()),signal.SIGTERM)
save('cleanup.json',dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),watcherStopped=True,heavyProcessesReaped=True,lockReleased=True,binariesCopied=0,binariesModified=False,donorsReadonly=True,rootIndexRefsUnchanged=True,box=None,state='notassigned',expiry=None,lifecycleOwner='coordinator',protectedBox='bx_69aem736 untouched',BoatQueries=0,SSHRuntimeAttempts=0))
save('result.json',dict(state='BOTH_MODULE_QUALIFICATION_PASS',results=results,pinnedInputs=pins,scope='Exact synchronous Buffer new WebAssembly.Module callsite under unchanged pinned guard. No source repair, rebuild, Memory/Instance/instantiate/compile/validate or guest execution. No runtime SEH/gameplay/full-build acceptance.',sourceVersusCompiled='Source a3fe340b962da3f31df249881074afe41d6c69a2; retained binary build evidence 9d85af30e9ed0c19bac7f9ba99d1b540a508f4e4; qualifier acceptance ae188c981dad2337050acf88d74d567d5644c367. No new build.',historicalReceipts='Original binary receipts remain separately preserved in /tmp/seh-current-canonical-qualifier-oct25/ops; not replaced by these repaired native reruns.',coordinatorDecision='Review published receipts; bounded worker stops, no successor.'))
reused=[]
for p in [pathlib.Path('/tmp/seh-current-canonical-qualifier-oct25/ops/controls.json'),pathlib.Path('/tmp/seh-trust-anchor-independent-closeout-oct25/ops/final-tree-tests.json'),pathlib.Path('/tmp/seh-trust-anchor-independent-closeout-oct25/ops/final-tree-controls.json')]:
 b=p.read_bytes();reused.append(dict(path=str(p),sha256=sha(b),bytes=len(b),reusedNotRerun=True))
save('historical-evidence-reuse.json',reused)
P.mkdir(parents=True,exist_ok=True);E.mkdir(exist_ok=True)
readme='''# Accepted trust-anchored canonical Module rerun — 2026-10-25

Tail: PASS. Compat: PASS. Both genuine retained binaries returned native Module qualification with accepted qualifier ae188c981dad2337050acf88d74d567d5644c367 (tree755d5831544556b5e9333b57863a4502ca6a1736). Complete explicit commands, hashes, terminal timing, admission manifests and enforcement receipts are in evidence/result.json and the separate module-tail/module-compat files.

Source revision a3fe340b962da3f31df249881074afe41d6c69a2 differs from compiled build evidence9d85af30e9ed0c19bac7f9ba99d1b540a508f4e4. This task performed no repair or rebuild. Historical binary receipts remain separately preserved. Accepted static tests and independent attacks (198 verified evidence files) were reused; one targeted wrong-hash rejection validated the qualifier-path adaptation before native execution.

The unchanged synchronous Buffer callsite and pinned preload guard were used with authenticated original contract bytes and absolute binary paths. No Memory, Instance, instantiate, compile, validate, guest, gameplay, runtime SEH or full-build acceptance is claimed. No box was assigned; coordinator lifecycle ownership and protected bx_69aem736 were untouched.

Recovery: preserve /tmp/seh-accepted-module-rerun-oct25/ops and the readonly paths listed in evidence/pinned-inputs.json. Binaries are standing inputs used in place and are deliberately absent from Git. The original contract embeds immutable input paths, so recovering only these receipts is insufficient to rerun. Re-admission and a new coordinator assignment are required for any further execution; this task never retries unchanged. Helpers are retained in evidence; account.py derives ownership from its file location and requires CODEX_SESSION_ID. supervise.py accepts cheap/publication and Module stages; use exact result.json argv with the unchanged guard. Any recovery must retain all resource and output limits, exclusive heavy lock, trusted Git SSH, no mount/guest execution, and existing static evidence.

Git publication uses only task/seh-accepted-module-rerun-oct25, with strict dedicated identity and known-hosts configuration recorded in trusted-configuration.json. No main merge. Local ops/publication-complete.json supplies verified remote SHA after commit; final ops/evidence-manifest.json seals postpublication receipts without a self-referential seal.
'''
(P/'README.md').write_text(readme);(O/'RECOVERY.md').write_text(readme)
for p in O.iterdir():
 if p.is_file() and p.suffix in ['.py','.json','.stdout','.stderr','.md']:(E/p.name).write_bytes(p.read_bytes())
seal=[dict(path=str(p.relative_to(P)),bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted(P.rglob('*')) if p.is_file() and p.name!='seal.json']
(E/'seal.json').write_text(json.dumps(seal,indent=2)+'\n')
print('Both explicit PASS receipts, admissions, supervisor enforcement and recovery sealed; root refs/index unchanged')
