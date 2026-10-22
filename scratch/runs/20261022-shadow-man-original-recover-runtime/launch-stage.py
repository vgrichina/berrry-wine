"""External 255s TERM/260s KILL bound, owned group cleanup, exact saved command."""
import datetime,hashlib,json,os,pathlib,signal,subprocess,time
R=pathlib.Path('/home/user/shadow-man-original-oct22');O=R/'setup-run';O.mkdir()
pins=json.loads((R/'runtime-expected.json').read_text())
def digest(p):
    with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def prepost(name):
    n=0
    for x in pins['runtime']:
        p=R/'runtime'/x['path'];assert p.stat().st_size==x['size'] and digest(p)==x['sha256'],str(p);n+=1
    for x in pins['runner']:
        p=R/x['path'];assert p.stat().st_size==x['size'] and digest(p)==x['sha256'],str(p);n+=1
    for x in json.loads((R/'recovery/extracted-members.json').read_text())['extractedMembers']:
        p=R/'recovery/source/Demos/Shadowman'/x['name'];assert p.stat().st_size==x['bytes'] and digest(p)==x['sha256'];n+=1
    (O/name).write_text(json.dumps(dict(passAll=True,files=n,at=datetime.datetime.now(datetime.timezone.utc).isoformat()),indent=2)+'\n')
prepost('preflight.json')
cmd=['node','test/run.js','--exe='+str(R/'recovery/source/Demos/Shadowman/Setup.exe'),'--no-build','--wasm='+str(R/'runtime/build/wine-assembly.wasm'),'--vfs-include=**/*','--dll-seed='+str(R/'recovery/source/Demos/Shadowman/_Setup.dll')+','+str(R/'runtime/test/binaries/dlls/msvcrt.dll'),'--spawn-processes','--pipe-child-args=--control=8124','--control=8123','--capture-launch='+str(O/'capture'),'--reg-export='+str(O/'final-registry.json'),'--save-vfs='+str(O/'vfs'),'--max-seconds=240','--max-batches=1000000000','--stuck-after=0','--no-close','--quiet-api','--quiet-blocks','--png='+str(O/'final.png')]
(O/'command.json').write_text(json.dumps(cmd,indent=2)+'\n')
env=dict(os.environ,NODE_PATH=str(R/'runner/node_modules'))
start=time.monotonic();at=datetime.datetime.now(datetime.timezone.utc).isoformat();term=False;kill=False
with (O/'output.log').open('w') as log:
    p=subprocess.Popen(cmd,cwd=R/'runtime',env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
    (O/'pid.json').write_text(json.dumps(dict(pid=p.pid,pgid=p.pid,startedAt=at)))
    try:p.wait(timeout=255)
    except subprocess.TimeoutExpired:
        term=True;os.killpg(p.pid,signal.SIGTERM)
        try:p.wait(timeout=max(0,260-(time.monotonic()-start)))
        except subprocess.TimeoutExpired:kill=True;os.killpg(p.pid,signal.SIGKILL);p.wait()
    finally:
        try:os.killpg(p.pid,signal.SIGTERM)
        except ProcessLookupError:pass
(O/'exit.json').write_text(json.dumps(dict(exitCode=p.returncode,elapsedSeconds=time.monotonic()-start,startedAt=at,finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),externalTERM=term,externalKILL=kill),indent=2)+'\n')
prepost('postflight.json')
print((O/'exit.json').read_text())
