import pathlib,json,os,sys,hashlib,time,subprocess,shlex
sys.path.insert(0,'/tmp/penguin-retained-codec-oct24');from api import remote,send
H=pathlib.Path('/tmp/penguin-quiet-gameplay-oct24');P=pathlib.Path('/tmp/penguin-retained-codec-oct24'); E=H/'repo/docs/re-notes/penguin-command-quiet-original-gameplay-20261024';E.mkdir(parents=True,exist_ok=True)
def size(p):return sum(x.stat().st_size for x in p.rglob('*') if x.is_file() and not x.is_symlink()) if p.exists() else 0
code='import pathlib,os,json;h=pathlib.Path("/tmp/penguin-retained-codec-oct24");p=[x for x in h.rglob("*") if x.is_file()];print(json.dumps(dict(bytes=sum(x.stat().st_size for x in p),max=max(x.stat().st_size for x in p),free=os.statvfs("/tmp").f_bavail*os.statvfs("/tmp").f_frsize)))'
r=json.loads(remote('python3 -c '+shlex.quote(code))['stdout'])
a=json.load(open(P/'admission.json'));sql=sum(max(0,p.stat().st_size-a['sqliteBaseline'].get(str(p),0)) for p in pathlib.Path('/home/user/.codex').glob('*.sqlite*') if p.is_file())
sessions=[p for p in pathlib.Path('/home/user/.codex/sessions/2026/10/24').glob('*.jsonl') if '01a16baa-fa55' in p.name];sessions+=sorted(pathlib.Path('/home/user/.codex/sessions/2026/10/24').glob('*.jsonl'),key=lambda p:p.stat().st_mtime)[-1:]
external=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/penguin-command-retained-codec-gameplay-oct24')
charged={'priorLocal':size(P),'priorRemote':r['bytes'],'newLocal':size(H),'priorExternal':size(external),'sessions':sum(p.stat().st_size for p in set(sessions)),'positiveSQLite':sql,'futureLocalGitEvidence':3*1024**2,'futureRemoteLogsEvidence':2*1024**2,'futureSessionEventsSQLite':10*1024**2,'transport':1024**2,'reserve':8*1024**2}
total=sum(charged.values());free=os.statvfs('/tmp').f_bavail*os.statvfs('/tmp').f_frsize
j=dict(at=time.time(),charged=charged,projected=total,cap=67108864,localFree=free,remoteFree=r['free'],localAfter=free-total,remoteAfter=r['free']-total,remoteMax=r['max'],sessions=[str(p) for p in set(sessions)],capture='prior900000 retained + current conservative60000 =960000/1048576; no reset; compact future responses',passAdmission=total<=67108864 and min(free-total,r['free']-total)>=2982150144)
(E/'admission.json').write_text(json.dumps(j,indent=2));assert j['passAdmission'],j
# retain manifest and exact previous receipts locally, never overwrite donors
for name in ['admission.json','preflight.json','runtime-standing.json','resource-final.json']:
 (E/('prior-'+name)).write_bytes((P/'repo/docs/re-notes/penguin-command-retained-codec-gameplay-20261024'/name).read_bytes())
# new supervisor, immutable runner/payload in place, all new outputs separate
s=(P/'supervise.py').read_text().replace("E=H/'run'","E=pathlib.Path('/tmp/penguin-quiet-gameplay-oct24/run')").replace("'--quiet-api','--no-close'","'--quiet-api','--quiet-blocks','--no-close'").replace("inbox=H/'input.ndjson'","inbox=pathlib.Path('/tmp/penguin-quiet-gameplay-oct24/input.ndjson')")
s=s.replace("E.mkdir(exist_ok=False)","E.mkdir(parents=True,exist_ok=False)")
s=s.replace("if elapsed>4 and not sent:","if elapsed>2 and not sent:")
(H/'supervise.py').write_text(s);(E/'supervise.py').write_text(s)
send(s.encode(),'/tmp/penguin-quiet-gameplay-oct24/supervise.py')
(E/'admission.json').write_text(json.dumps(j,indent=2));print(json.dumps({'projected':total,'cap':67108864,'pass':True}))
