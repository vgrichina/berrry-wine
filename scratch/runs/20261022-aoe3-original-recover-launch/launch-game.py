"""One bounded original launch on assigned Boat, with pre/post byte verification."""
import datetime,hashlib,json,os,pathlib,subprocess,time
R=pathlib.Path('/home/user/aoe3-original-oct22'); O=R/'game-run'
assert not O.exists(), 'one launch only; output must be fresh'
O.mkdir()
def save(n,x):(O/n).write_text(json.dumps(x,indent=2)+'\n')
def verify():
 pins=json.loads((R/'runtime-pins.json').read_text())
 pins += [dict(x,path='../installed/'+x['path']) for x in json.loads((R/'installed-audit/installed-manifest.json').read_text())['files']]
 for x in pins:
  p=R/'runtime'/x['path']
  with p.open('rb') as f:h=hashlib.file_digest(f,'sha256').hexdigest()
  assert p.stat().st_size==x['size'] and h==x['sha256'],str(p)
 return dict(files=len(pins),at=datetime.datetime.now(datetime.timezone.utc).isoformat(),passAll=True)
save('preflight.json',verify())
command=json.loads((R/'installed-audit/launch-command.json').read_text())
env=dict(os.environ,NODE_PATH=str(R/'runner/node_modules'))
start=time.time()
with (O/'output.log').open('w') as out:
 p=subprocess.Popen(['timeout','--signal=TERM','--kill-after=15','660']+command,cwd=R/'runtime',env=env,stdout=out,stderr=subprocess.STDOUT)
 save('launch.json',dict(pid=p.pid,command=command,at=datetime.datetime.now(datetime.timezone.utc).isoformat(),node=subprocess.check_output(['node','--version'],text=True).strip(),hardTimeoutSeconds=660))
 code=p.wait()
save('exit.json',dict(exitCode=code,elapsedSeconds=time.time()-start,at=datetime.datetime.now(datetime.timezone.utc).isoformat()))
save('postflight.json',verify())
print(json.dumps(dict(exitCode=code,elapsedSeconds=time.time()-start)))
