from api import *
import os,re,ast,time,shutil,struct,signal
E=H/'repo/docs/re-notes/penguin-command-retained-codec-gameplay-20261024'
sid=os.environ['CODEX_THREAD_ID'];session=next(pathlib.Path('/home/user/.codex/sessions/2026/10/24').glob('*'+sid+'*'));external=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/penguin-command-retained-codec-gameplay-oct24')
def size(p):return sum(q.stat().st_size for q in p.rglob('*') if q.is_file()) if p.is_dir() else p.stat().st_size
j=json.load(open(H/'admission.json'));growth=sum(max(0,p.stat().st_size-j['sqliteBaseline'].get(str(p),p.stat().st_size)) for p in pathlib.Path('/home/user/.codex').glob('*.sqlite*') if p.is_file())
remoteCode='import pathlib,json,os;h=pathlib.Path('+repr(ROOT)+');print(json.dumps({"taskBytes":sum(p.stat().st_size for p in h.rglob("*") if p.is_file()),"free":os.statvfs("/tmp").f_bavail*os.statvfs("/tmp").f_frsize,"nodeProcesses":[{"pid":p.name,"comm":(p/"comm").read_text().strip()} for p in pathlib.Path("/proc").iterdir() if p.name.isdigit() and (p/"comm").exists() and (p/"comm").read_text().strip()=="node"]}))'
r=json.loads(remote('python3 -c '+shlex.quote(remoteCode))['stdout']);local=size(H);ext=size(external);sess=size(session)
allow={'futureLocalGitReportEvidence':2*1024**2,'futureBothHostsLogs':1024**2,'futureExternalSessionSQLite':8*1024**2,'reserve':8*1024**2,'transportPeak':1024**2}
projected=local+r['taskBytes']+ext+sess+growth+sum(allow.values());free=shutil.disk_usage(H).free
receipt=dict(at=time.time(),localTaskIncludingPrivateGit=local,remoteTask=r['taskBytes'],externalLauncher=ext,externalPath=str(external),sessionBytes=sess,sessionPath=str(session),positiveSQLiteGrowth=growth,allowances=allow,projected=projected,cap=67108864,localFree=free,localAfterConservative=free-projected,remoteFree=r['free'],remoteAfterConservative=r['free']-projected,perFileMax=max(p.stat().st_size for p in H.rglob('*') if p.is_file()),remoteNodeProcesses=r['nodeProcesses'],captureAccounting='Conservative 900000/1048576 bytes, includes bounded compressed transfer responses, bootstrap/instructions and excerpts; raw guest register log retained554504B. Supervisor524288 threshold rejected; no claim all output gates passed.')
assert projected<=67108864 and min(receipt['localAfterConservative'],receipt['remoteAfterConservative'])>=2982150144 and not r['nodeProcesses']
(E/'resource-final.json').write_text(json.dumps(receipt,indent=2));(H/'resource-final.json').write_text(json.dumps(receipt,indent=2))
# Preserve executed API terminal, actual idle/running lifecycle, avoiding host URL/credentials.
for pid,label in [(23193,'preguest'),(24063,'native')]:
 raw=subprocess.check_output(['/home/user/.ascii/boat','--no-update','--json','exec','--status',str(pid),'bx_9nngcsvf']);v=json.loads(raw);assert v['status']=='exited' and not v['running'];(E/(label+'-api-terminal.json')).write_text(json.dumps(v,indent=2))
raw=subprocess.check_output(['/home/user/.ascii/boat','--no-update','--json','info','bx_9nngcsvf']);v=json.loads(raw)['sandbox'];state={k:v[k] for k in ['id','state','health','archiveAfter','createdAt']};state.update(shutdownOwner='coordinator',checkpoint='2026-10-24T02:37:00Z',leftRunning=True);(E/'box-state.json').write_text(json.dumps(state,indent=2))
# Local host-only validation; no game/native retry.
checks=[]
for p in E.glob('*.py'):ast.parse(p.read_text(),filename=str(p));checks.append('syntax:'+p.name)
for x in json.load(open(E/'collection-seals.json')):
 b=(E/x['path']).read_bytes();assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'],x['path']
checks.append('22 collected file seals')
term=json.load(open(E/'run/terminal.json'));assert term['reason']=='capture-guard' and term['TERM'] and not term['remainingGroup']
log=(E/'run/output.log').read_text();assert log.count('DllMain returned, EAX=0x1')==7 and '[signal] SIGTERM requested orderly shutdown' in log
assert not re.search(r'\*\*\* CRASH|unreachable|unimplemented',log,re.I);assert json.load(open(E/'run/input-events.json'))==[]
png=(E/'run/exit.png').read_bytes();assert png[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',png[16:24])==(640,480)
checks+=['all7 DllMain successful','no crash marker before guard','TERM and empty group','zero control inputs','PNG640x480 structurally valid and visually inspected black client']
(E/'validation.json').write_text(json.dumps(dict(passed=True,checks=checks,scope='Host evidence consistency only; no gameplay/runtime retry'),indent=2))
# Watcher cleanup before handback.
wp=int((H/'watcher.pid').read_text());os.killpg(wp,signal.SIGTERM)
try:os.kill(wp,0);watcher='TERM sent; process may await parent reap'
except ProcessLookupError:watcher='absent'
(E/'cleanup.json').write_text(json.dumps(dict(boardWatcherPID=wp,boardWatcher=watcher,guestGroupsRemaining=False,remoteNodeProcesses=r['nodeProcesses'],box='bx_9nngcsvf',shutdownOwner='coordinator',leftRunning=True),indent=2))
result=dict(schemaVersion=1,startedAt='2026-10-24T02:14:00.383Z',outcome='blocked',verification='reviewed',checkpoint='startup',candidateId=None,candidateRegistration='Absent from exact current-main candidate corpus; investigation only',summary='Original EXE/DLL initialization reached Penguin Command window; black client frame. Supervisor output guard stopped per-batch log flood before input/menu/gameplay. No gameplay acceptance.',sourceRevision='b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a',moduleSHA256='8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686',moduleBytes=1879746,renderer='historical production rasterCanvas',engine='Node24.22.1',artifacts={'screenshot':'run/exit.png','log':'run/output.log','trace':'run/minimal-trace.txt','argv':'run/command.json','inputs':'run/input-events.json','terminal':'run/terminal.json','resources':'resource-final.json'},box=state,limits={'guestSeconds':60,'maxBatches':200000,'cpuWallSeconds':90,'oldspaceMiB':512,'fixedSharedArenaMiB':512,'fileMaxBytes':25165824,'taskMaxBytes':67108864,'supervisorLogGuardBytes':524288,'internalCumulativeCaptureBytes':1048576},resumeCorrection='Coordinator-owned fresh assignment; include supported --quiet-blocks and fresh admission; no retry performed')
(E/'results.json.tmp').write_text(json.dumps(result,indent=2));(E/'results.json.tmp').rename(E/'results.json')
print(json.dumps({'projected':projected,'localAfter':free-projected,'remoteAfter':r['free']-projected,'validationChecks':len(checks),'boxState':state['state']}))
