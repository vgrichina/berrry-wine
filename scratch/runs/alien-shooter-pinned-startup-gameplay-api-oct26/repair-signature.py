from work import *
OLD='/tmp/alien-shooter-current-gameplay-api-oct26'
# Preserve full first invocation before any changed-dependency invocation.
j=py('import pathlib,json;h=pathlib.Path('+repr(R)+');p=h/"guest";assert (p/"terminal.json").exists();p.rename(h/"guest-first-signature-omission");(h/"guest").mkdir();print((h/"guest-first-signature-omission/terminal.json").read_text())');save('first-invocation-terminal.json',json.loads(j['stdout']))
t=json.loads(j['stdout']);assert t['elapsed']<31 and not t['remainingOwnedLive']
transfer([(OLD+'/runner/lib/host-import-sigs.generated.json',O/'host-import-sigs.generated.json')])
# A changed-input correction, not replay of an outstanding step. First disconnected request preserved remotely.
s=(O/'supervisor.py').read_text().replace("(89 if OP=='guest' else 119)","(57 if OP=='guest' else 119)").replace("wallGuest=89","wallGuest=57")
(O/'supervisor-remaining.py').write_text(s)
a=json.loads((O/'guest-args.json').read_text());a=[x.replace('--max-seconds=85','--max-seconds=54') for x in a];(O/'guest-remaining-args.json').write_text(json.dumps(a))
transfer([('supervisor-remaining.py',O/'supervisor-remaining.py'),('guest-args.json',O/'guest-remaining-args.json')])
j=py('import pathlib,hashlib,json;h=pathlib.Path('+repr(OLD)+');ps=["runner/lib/host-import-sigs.generated.json","runner/test/run.js","runner/src/api_table.json","current.wasm","runner/test/binaries/candidates/reflexive-alien-shooter/game/AlienShooter.exe"];print(json.dumps({p:hashlib.file_digest((h/p).open("rb"),"sha256").hexdigest() for p in ps}))');save('corrected-immediate-identities.json',j)
# Probe exact dynamic worker dependency construction without guest execution.
j=py('''import subprocess,os,json,pathlib,resource
h=pathlib.Path('''+repr(R)+''');a=json.loads((h/'guest-args.json').read_text());env=dict(os.environ)
for k in ['WINE_RUN_EXTRA_ARGS','WINE_REGION_MAP','NODE_OPTIONS','NODE_PATH']:env.pop(k,None)
def lim():
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
code="const fs=require('fs');let s=JSON.parse(fs.readFileSync('lib/host-import-sigs.generated.json'));require('./lib/d3d-command-stream');fs.accessSync('lib/d3d-render-worker.js');console.log(JSON.stringify({signatureCount:Object.keys(s.sigs).length,limits:fs.readFileSync('/proc/self/limits','utf8')}))"
p=subprocess.run(a[:3]+['-e',code],cwd='''+repr(OLD+'/runner')+''',env=env,preexec_fn=lim,capture_output=True,text=True,timeout=20);print(json.dumps(dict(exit=p.returncode,stdout=p.stdout,stderr=p.stderr)));assert p.returncode==0
''');save('dynamic-worker-startup.json',j)
save('signature-manifest-addendum.json',dict(target=OLD+'/runner/lib/host-import-sigs.generated.json',**json.loads((O/'signature-recovery-verified.json').read_text()),firstInvocationPreserved=True,remainingGuestWallCap=57,previousGuestElapsed=t['elapsed'],aggregateMaxWall=t['elapsed']+57))
print('CORRECTED READY',flush=True)
