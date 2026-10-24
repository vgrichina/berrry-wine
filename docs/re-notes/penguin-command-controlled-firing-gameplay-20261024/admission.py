import pathlib,os,json,shutil,time,hashlib
H=pathlib.Path('/tmp/penguin-controlled-firing-oct24');root=pathlib.Path('/home/user/wine-assembly')
def tree(p):return sum(x.stat().st_size for x in p.rglob('*') if x.is_file() and not x.is_symlink())
sessions=list(pathlib.Path('/home/user/.codex/sessions').rglob('*'+os.environ['CODEX_SESSION_ID']+'*.jsonl'))
sql={str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*.sqlite*') if p.is_file()}
alloc={'remotePayload':15719953,'checkoutGit':3*1048576,'localRecipesEvidence':4*1048576,'remoteEvidenceTemp':3*1048576,'externalSessionLauncherAndFuture':16*1048576,'positiveSQLiteFuture':8*1048576,'transportTemp':3*1048576,'reserve':8*1048576}
peak=sum(alloc.values());free=shutil.disk_usage('/tmp').free
j=dict(at=time.time(),allocations=alloc,peak=peak,cap=67108864,localFree=free,localAfter=free-peak,floor=2982150144,sqliteBaseline=sql,sessions=[str(x) for x in sessions],sessionInitial=sum(x.stat().st_size for x in sessions),launcherInitial=tree(root/'scratch/usage-watch/penguin-command-controlled-firing-gameplay-oct24'),textCaptureCharged=180000,textCaptureCap=1048576,standingInputs='immutable exact 287-file accepted manifest, module, source, CRT and pngjs; no local payload materialization',passAdmission=peak<=67108864 and free-peak>=2982150144)
(H/'admission.json').write_text(json.dumps(j,indent=2)+'\n');assert j['passAdmission'],j
print(json.dumps(j))
