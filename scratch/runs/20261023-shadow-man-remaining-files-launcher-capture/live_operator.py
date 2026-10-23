"""Remote helper: live ctl snapshot/PNG only; input requires external inspection."""
import pathlib,time,json,subprocess,socket,traceback
R=pathlib.Path('/home/user/shadow-man-launcher-configuration-capture-oct23');F=R/'fixed';O=R/'mutable/output/session';RT=R/'immutable/runtime'
g=json.loads((F/'preguest-gate.json').read_text());port=g['controlPort'];start=time.monotonic()
def ctl(args,label):
 p=subprocess.run(['node',str(RT/'tools/ctl.js'),'-s',':'+str(port),*args],capture_output=True,text=True,timeout=3,env=g['environment']);r=dict(args=args,exit=p.returncode,stdout=p.stdout,stderr=p.stderr,elapsed=time.monotonic()-start);(F/(label+'.json')).write_text(json.dumps(r,indent=2)+'\n');assert p.returncode==0,label;return r
try:
 while True:
  with socket.socket() as s:
   s.settimeout(.05)
   if s.connect_ex(('127.0.0.1',port))==0:break
  assert time.monotonic()-start<10,'endpoint unavailable';time.sleep(.05)
 endpoint=time.monotonic()
 while True:
  snap=ctl(['snapshot'],'launcher-live-snapshot')
  if 'Konfiguration' in snap['stdout'] and '1024' in snap['stdout']:break
  assert time.monotonic()-endpoint<7,'launcher controls unavailable';time.sleep(.1)
 ctl(['png',str(O/'launcher-before.png')],'launcher-live-png')
 (F/'launcher-ready-for-inspection.json').write_text(json.dumps(dict(time=time.time(),elapsed=time.monotonic()-start)))
except Exception as e:
 (F/'live-operator-failure.json').write_text(json.dumps(dict(type=type(e).__name__,detail=str(e),elapsed=time.monotonic()-start)))
 (F/'operator-stop.json').write_text(json.dumps(dict(reason='live-capture-failed')))
