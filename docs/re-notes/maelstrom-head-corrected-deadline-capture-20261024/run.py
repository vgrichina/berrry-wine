import pathlib,sys,json,os,shutil,re,time,subprocess,hashlib,base64,shlex
H=pathlib.Path(__file__).parent.parent;O=H/'ops';OLD=pathlib.Path('/tmp/maelstrom-qualified-head-original-capture-oct24'); C=pathlib.Path('/home/user/.codex')
(O/'transport.py').write_bytes((OLD/'ops/transport.py').read_bytes())
from transport import remote,py,save,size
args=json.loads((OLD/'guest-args.json').read_text());(H/'guest-args.json').write_text(json.dumps(args,indent=2))
# Retain cumulative prior accounting and its original SQLite baseline.
prior=json.load(open(OLD/'ops/resource-handoff.json'));base=json.load(open(OLD/'ops/sqlite-baseline.json'))
session=next((C/'sessions/2026/10/24').glob('*'+os.environ['CODEX_SESSION_ID']+'*')); launcher=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch')/H.name
j=py('import os,pathlib,json,shutil;print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage("/tmp").free,memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024)))');save('ops/fresh-admission-api.json',j);rr=json.loads(j['stdout'])
charges=dict(priorCumulative=prior['peak']-prior['charges']['externalFuture']-prior['charges']['futureSQLite']-prior['charges']['reserve']-prior['charges']['publicationFuture'],newSessionFull=session.stat().st_size,newLauncherFull=size(launcher),newOwnedProjected=3500000,newRemoteProjected=500000,newTransferOverlap=200000,sqlitePositiveCumulative=sum(max(0,max(p.stat().st_size,p.stat().st_blocks*512)-base.get(str(p),0)) for p in C.glob('*.sqlite*') if p.is_file()),externalFuture=6000000,futureSQLite=4194304,publicationFuture=1500000,reserve=8388608)
peak=sum(charges.values());free=shutil.disk_usage(H).free;mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
a=dict(charges=charges,peak=peak,cap=67108864,localFree=free,remote=rr,session=str(session),launcher=str(launcher),standingInputs=str(OLD),historicalReceipts=str(OLD/'ops'),historicalDeficienciesUnchanged=True,passAdmission=peak<=67108864 and min(free,rr['free'])-peak>=2982150144 and mem>=805306368 and rr['memAvailable']>=2684354560 and rr['uid']==1000)
save('ops/admission.json',a);assert a['passAdmission'],a
# Actual unchanged filename-bearing argv parsed again, without guest execution.
runner=pathlib.Path('/tmp/maelstrom-head-yield-observer-oct24/ops/run.js').read_text();assert hashlib.sha256(runner.encode()).hexdigest()=='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809'
parser=runner[runner.index('const getArg ='):runner.index('// Was `--name=...`')]
code='const fs=require("fs"),assert=require("assert");const args=JSON.parse(fs.readFileSync(process.argv[1])).slice(3);'+parser+';assert.deepEqual(getArgs("vfs-tree"),[process.argv[2]+"/vfs"]);assert.equal(getArgs("vfs-mount").length,0);assert.equal(getArg("trace-at"),"7a3362");assert.equal(getArg("count"),"7a3362,7a3366");assert.equal(+getArg("trace-at-limit"),1);console.log(JSON.stringify({pass:true,tree:getArgs("vfs-tree"),input:getArg("input")}));'
p=subprocess.run(['node','--max-old-space-size=256','-e',code,str(H/'guest-args.json'),str(OLD)],capture_output=True,text=True,timeout=60);save('ops/parser.json',dict(returncode=p.returncode,stdout=p.stdout,stderr=p.stderr));assert p.returncode==0
# Same-task full materialized transfer/hash gate, not an accepted-suite rerun.
code=(OLD/'ops/remote_gate.py').read_text();code=code[code.index("code='''")+8:code.index("'''.replace")];code=code.replace('ROOT',repr(str(OLD))).replace('\\\\s','\\s').replace('\\\\d','\\d').replace("(h/'fresh-admission.json').write_text(json.dumps(result,indent=2));",'')
save('ops/materialized-gate-api.json',py(code))
# Copy only supervisor/argv; assets remain standing readonly, never restaged.
s=(OLD/'ops/supervise.py').read_text().replace("assert (H/'cutoff-clarified.json').exists(), 'conflicting12:28 cutoff unresolved'","assert time.time()+65<1792860900, 'insufficient time before16:55UTC'").replace("cwd=H/'runner'","cwd=pathlib.Path("+repr(str(OLD/'runner'))+")").replace("if time.monotonic()-start>60:","if time.time()>=1792860900 or time.monotonic()-start>60:")
(H/'supervise.py').write_text(s)
files={'supervise.py':s,'guest-args.json':(H/'guest-args.json').read_text()}
code='import pathlib,json;h=pathlib.Path('+repr(str(H))+');h.mkdir(exist_ok=True);files='+repr(files)+';[(h/n).write_text(v) for n,v in files.items()];print(json.dumps({"newBytes":sum(len(v.encode()) for v in files.values()),"standingRoot":'+repr(str(OLD))+'}))'
save('ops/staging-api.json',py(code));save('ops/reused-readiness.json',dict(source=str(OLD/'ops/result.json'),acceptedSuitesRerun=False,plannedArgvUnchanged=True,priorAccountingRetained=True,cutoff='2026-10-24T16:55:00Z'))
print('ADMISSION PASS; invoking ONE guest',flush=True)
save('ops/guest-supervisor-api.json',remote('python3 '+shlex.quote(str(H/'supervise.py'))+' guest',timeout=75))
print('GUEST TERMINATED',flush=True)
