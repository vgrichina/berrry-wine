import pathlib,json,subprocess,hashlib,base64,time,os
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';REMOTE='/home/user/maelstrom-uop-retained-native-closeout-oct26';BOX='bx_h44cmz3t'
def call(args,label='api',timeout=60):
 p=subprocess.run(['boat','--json','exec',BOX,'--timeout',str(timeout),'--',*args],capture_output=True,text=True,timeout=timeout+30)
 assert len(p.stdout)+len(p.stderr)<=131072,'capture overflow'
 r=json.loads(p.stdout)
 with (O/'api-commands.jsonl').open('a') as f:f.write(json.dumps(dict(label=label,at=time.time(),result=r))+'\n')
 assert p.returncode==0 and r.get('success') and r.get('exitCode')==0,(label,r)
 return r
def py(code,label='python',timeout=60):return call(['python3','-c',code],label,timeout)
def put(p,remote):
 p=pathlib.Path(p);b=p.read_bytes();h=hashlib.sha256(b).hexdigest()
 for off in range(0,len(b),49152):
  code='import pathlib,base64;p=pathlib.Path('+repr(remote)+');p.parent.mkdir(parents=True,exist_ok=True);b=base64.b64decode('+repr(base64.b64encode(b[off:off+49152]).decode())+');'
  code+= 'assert not p.exists();p.write_bytes(b)' if off==0 else 'assert p.stat().st_size=='+str(off)+';p.open("ab").write(b)'
  py(code,'stage-'+p.name+'-'+str(off))
 # Independent API command reopens all final bytes. No execution until hash matches.
 r=py('import pathlib,hashlib,json;p=pathlib.Path('+repr(remote)+');b=p.read_bytes();assert len(b)=='+str(len(b))+';assert hashlib.sha256(b).hexdigest()=='+repr(h)+';print(json.dumps(dict(path=str(p),bytes=len(b),sha256=hashlib.sha256(b).hexdigest())))','readback-'+p.name)
 row=json.loads(r['stdout'])
 with (O/'transfers.jsonl').open('a') as f:f.write(json.dumps(row)+'\n')
 return row
if __name__=='__main__':
 C=pathlib.Path('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23');S=pathlib.Path('/tmp/maelstrom-errno-api-canonical-native-oct25/ops')
 m=json.load(open(C/'docs/re-notes/shadow-man-span-static-canonical-20261023/manifest.json'))
 put(S/'sources.json.gz',REMOTE+'/ops/sources.json.gz');put(S/'compressed-projection.json',REMOTE+'/ops/compressed-projection.json')
 put(C/'docs/re-notes/shadow-man-span-static-canonical-20261023/manifest.json',REMOTE+'/canonical/docs/re-notes/shadow-man-span-static-canonical-20261023/manifest.json')
 for row in m['files']:
  if not row['path'].startswith('src/'):put(C/row['path'],REMOTE+'/canonical/'+row['path'])
 for n,p in dict(net='/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/SDL_net.dll',exe='/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe',crt='/home/user/wine-assembly/test/binaries/dlls/msvcrt.dll').items():put(p,REMOTE+'/ops/anchors/'+n)
 for n in ['maelstrom-native-errno-latch.cjs','maelstrom-select-completion-hook.cjs','maelstrom-original-errno-adapter.cjs','maelstrom-diagnostic-canonical-build.cjs']:put(R/'tools'/n,REMOTE+'/repo/tools/'+n)
 guard=pathlib.Path('/home/user/wine-assembly-shadow-man-native-bound-canonical-oct23/docs/re-notes/shadow-man-native-bound-canonical-20261023/native-module-bound.cjs');assert hashlib.sha256(guard.read_bytes()).hexdigest()=='47ce2e2b835be33eab6b2b24f027ecaab8ceb61c559890e51548c78199beb197';put(guard,REMOTE+'/ops/native-module-bound.cjs')
 print(json.dumps(dict(status='PASS',staged=json.loads(py('import pathlib,json;p=pathlib.Path('+repr(REMOTE)+');print(json.dumps(dict(allocated=sum(max(f.stat().st_size,f.stat().st_blocks*512) for f in p.rglob("*") if f.is_file()))))','size')['stdout']))))
