import control as c,pathlib,hashlib,json,tarfile,time,os
O=c.O;P=O.parent;I=P/'input-consumption';M=1048576
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  while b:=f.read(65536):h.update(b)
 return h.hexdigest()
v=c.admission();available=v['budget']-v['reserve']-v['used'];need=((1881806+4095)//4096)*4096
assert need>available
roots=[pathlib.Path(x) for x in v['sizes']]
local=sorted({str(p) for r in roots for p in r.rglob('*.wasm')})
assert not local,local
archives=[pathlib.Path('/tmp/tuxracer-software-render-msvcrt-retest-oct30/packet.tar.gz'),pathlib.Path('/tmp/tuxracer-glcolor4dv-canonical-enter-runtime-oct30-report-corrected/candidate.tar.gz'),pathlib.Path('/tmp/tuxracer-vertex-color-gameplay-owner-policy-oct30/candidate-delta.tar.gz')]
pre=json.loads((P/'preflight.json').read_text());expected=[pre['archive']['sha256'],pre['candidateArchiveSHA'],pre['deltaSHA']];mods=[]
for p,h in zip(archives,expected):
 assert sha(p)==h
 with tarfile.open(p) as t:
  for row in t.getmembers():
   if row.name.endswith('.wasm'):
    b=t.extractfile(row).read();hh=hashlib.sha256(b).hexdigest();assert hh!='5a39225e1a8381ce1c4530d2ce7cd6311bd75576d10968c20e963baf033d41eb'
    mods.append(dict(archive=str(p),member=row.name,bytes=len(b),sha256=hh))
tree=json.loads((O/'snapshot-tree.json').read_text());assert not tree['truncated']
row=next(x for x in tree['entries'] if x['path']=='tuxracer-render/build/wine-assembly.wasm');assert row['size']==1881806
pins={str(p):dict(bytes=p.stat().st_size,sha256=sha(p)) for p in [I/'main-scheduler-observer.js',I/'run.pinned.js',I/'README.md',I/'publication.json',I/'boundary-run.pinned.js.json',I/'regression-controls.json',P/'source-manifest.json',P/'limit-controls.json',P/'remote-worker.py',P/'control.py']}
assert pins[str(I/'run.pinned.js')]['sha256']=='f96e9bb924700ee571e2904e097f80742ff55638399898ae1dc32454af05b02d'
assert json.loads((I/'boundary-run.pinned.js.json').read_text())['PASS']
assert all(x['rejected'] for x in json.loads((I/'regression-controls.json').read_text()).values())
rec=dict(status='BLOCKED_BEFORE_PROVISIONING',at=time.time(),cause='Accepted module absent from charged local roots and all three retained archives; exact stopped-snapshot module bytes cannot be restored locally within allocation plus mandatory reserve.',admission=v,availableBeforeReserve=available,moduleAllocatedBytes=need,minimumModuleOnlyShortfall=need-available,acceptedModule=dict(bytes=1881806,sha256='5a39225e1a8381ce1c4530d2ce7cd6311bd75576d10968c20e963baf033d41eb'),localModulePaths=local,archiveModules=mods,snapshot=dict(id=tree['snapshotId'],box=tree['sandboxId'],module=row,contentHashExposed=False,treeSHA256=sha(O/'snapshot-tree.json')),pins=pins,compile=False,newBoat=None,guestRuns=0,newRenders=0,pollDeltas=None,causalConclusion='unknown',coverage='No new source-boundary acceptance or runtime performed; unchanged prior observer tests referenced only.',preflight=dict(moduleClosure=False,provisioning=False,API16KiBSmoke='not attempted because exact-input/allocation prerequisite failed',mount='unchanged prior receipt exists; no runtime configuration executed',nodeStartup='not attempted; no runtime executable/environment allocated'),limits=dict(local=64*M,reserve=8*M,remote=256*M,remoteReserve=8*M,CPU=90,wall=120,capture=524288,generatedFile=12*M,pythonDATA=128*M,gitChildDATA=256*M,supervisorRSS=128*M,groupRSS=512*M,RAMAdmission=False,diskFloor=1610612736,remainingAggregate=267292672),next='Coordinator must reconcile retained local footprint and supply a verified accepted module execution/transfer route that fits local64MiB including8MiB reserve, selected new PNGs and report growth. Snapshot pull supports --path; restoring the module alone does not currently fit. No compile or old-box resume. A snapshot-backed new allocation still requires exact pre-provisioning hash verification and supported transfer/capture smoke, not size-only tree metadata.')
c.save('preflight-blocker.json',rec)
proof={}
for box in ['bx_jdx249hm','bx_7ky4nfwq']:
 b=c.run('old-box-state-'+box,['/home/user/.ascii/boat','--no-update','--json','info',box],cwd=O,wall=40);s=json.loads(b).get('sandbox',json.loads(b));assert s['state']=='stopped';proof[box]={k:s.get(k) for k in ['state','snapshotVerifiedAt','stoppedAt','archiveAfter']}
c.save('lifecycle.json',dict(newBoat=None,provisioned=False,oldBoxes=proof,stopRequired=False,reason='No new Boat allocated; stopped boxes only queried, never resumed or mutated.'))
(O/'README.md').write_text('# Tux Racer post-title poll runtime: preflight blocked\n\nNo new game execution, renders, compile, source change or Boat allocation occurred. Cause remains unknown; guest polling stop, scheduler gating and host queue consumption were not distinguished. Prior observer acceptance is reused, not presented as runtime coverage.\n\nFresh charged footprint was '+str(v['used'])+' bytes with '+str(available)+' bytes before the mandatory8MiB reserve inside64MiB. The accepted1881806-byte module needs1884160 allocated bytes by itself: minimum shortfall '+str(need-available)+' bytes before new PNG/log/publication growth. The historical55459840-byte baseline predates retained input-consumption artifacts and this launch. RAM is observational; host disk passes.\n\nThe accepted module is absent from every charged local root and all three hash-verified retained archives. The standing packet contains a different historical module (see preflight-blocker.json). Its accepted hash is known from prior runtime receipts, but its actual bytes remain in stopped bx_jdx249hm snapshot40ad564a-7673-4d96-8842-a6163a971d0f. Supported snapshot tree confirms the path and1881806-byte size and exposes no content hash. This is not full exact-module verification. CLI snapshot pull supports a selected --path; even that single-file recovery exceeds the current headroom. No pull, fork, new or resume was issued.\n\nRecover the unchanged diagnostic from dbabdfc2a3e0386580d9feb3d7cd3b8eb5155262; use the exact prior README command, runner, source manifest and CPU90/wall120 controls. Resolve module availability and allocation first, including selected PNG and closeout growth, then complete canonical mount, Node startup and supported16KiB API transfer/capture smoke before the one new allocation/run. Do not compile, raise CPU or infer a production defect. Old stopped boxes remain untouched.\n')
print(json.dumps(dict(status=rec['status'],used=v['used'],available=available,moduleOnlyShortfall=need-available)))
