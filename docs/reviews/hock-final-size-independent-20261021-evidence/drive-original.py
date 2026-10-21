import subprocess,pathlib,time,json,datetime
r=pathlib.Path('/home/user/hock-show-return-repair/original-held')
r.mkdir(exist_ok=True)
args=['node','test/run.js','--no-build','--wasm=/home/user/hock-show-return-repair/repo/build/wine-assembly.wasm','--exe=/home/user/hock-accepted-canonical-runtime/intake/game/BBLOOGIE.EXE','--exe-guest-path=C:\\BBLOOGIE.EXE','--cwd=C:\\','--vfs-include=**/*','--quiet-api','--max-seconds=45','--max-batches=1000000','--real-ticks','--control-stdin','--trace-input','--trace-input-dispatch','--png='+str(r/'held-final.png')]
events=[(2.8,{'cmd':'dump-windows:before'}),(2.9,{'cmd':'dump-mem:0x41eca4:8'}),(3,{'action':'png','path':str(r/'held-before.png')}),(4,{'cmd':'mousemove:124:386'}),(5,{'cmd':'mousedown:124:386'}),(6,{'action':'png','path':str(r/'held-down.png')}),(7,{'cmd':'mouseup:124:386'}),(9.8,{'cmd':'dump-windows:selected'}),(9.9,{'cmd':'hwnd-png-pixels:65537:'+str(r/'held-back.png')}),(10,{'action':'png','path':str(r/'held-selected.png')}),(12,{'cmd':'mousemove:320:250'}),(13,{'cmd':'mousedown:320:250'}),(15,{'cmd':'mouseup:320:250'}),(18,{'action':'png','path':str(r/'held-action.png')}),(20,{'cmd':'mousemove:450:300'}),(21,{'cmd':'mousedown:450:300'}),(23,{'cmd':'mouseup:450:300'}),(30,{'action':'png','path':str(r/'held-30s.png')}),(40,{'action':'png','path':str(r/'held-40s.png')})]
(r/'held-command.json').write_text(json.dumps(args,indent=2))
start=time.monotonic(); records=[]
with (r/'held.log').open('w') as log:
 p=subprocess.Popen(args,cwd='/home/user/hock-show-return-repair/repo',stdin=subprocess.PIPE,stdout=log,stderr=subprocess.STDOUT,text=True)
 for at,cmd in events:
  time.sleep(max(0,start+at-time.monotonic()))
  if p.poll() is not None:break
  cmd['id']=len(records)+1;p.stdin.write(json.dumps(cmd)+'\n');p.stdin.flush()
  records.append({'wallSeconds':time.monotonic()-start,'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'command':cmd})
 p.stdin.close();rc=p.wait(timeout=20)
(r/'held-timings.json').write_text(json.dumps({'events':records,'exit':rc,'wallSeconds':time.monotonic()-start},indent=2));print('exit',rc);raise SystemExit(rc)
