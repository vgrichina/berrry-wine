from common import *
mode=sys.argv[1]
if mode=='stage-helpers':
 for n in ('startup.js','guest-args.json','launch.py','remote-transport.py'):send((H/n).read_bytes(),n)
 send(HELPER.read_bytes(),'penguin_capture_contract.py')
 print('staged pinned capture helper and owned runtime configuration')
elif mode=='launch':
 assert time.time()<1793098980
 # Use a detached owning supervisor; its completion receipt is inspected separately.
 code='import pathlib,subprocess,os,json;h=pathlib.Path('+repr(REMOTE)+');o=(h/"launcher.stdout").open("wb");e=(h/"launcher.stderr").open("wb");p=subprocess.Popen(["python3",str(h/"launch.py")],cwd=h,stdin=subprocess.DEVNULL,stdout=o,stderr=e,start_new_session=True);(h/"launcher-pid.json").write_text(json.dumps(dict(pid=p.pid,pgid=p.pid)));print(json.dumps(dict(pid=p.pid,status="pending-not-startup-proof")))'
 j,raw=py(code);save('launch-ack.json',j);print(j['stdout'])
elif mode=='inspect':
 code='import pathlib,json,hashlib,os;h=pathlib.Path('+repr(REMOTE)+');names=["launcher.stdout","launcher.stderr","execution/receipt.json","execution/startup.stdout","execution/startup.stderr","execution/guest.stdout","execution/guest.stderr","startup-mount-receipt.json","profile.json"];r={n:dict(bytes=(h/n).stat().st_size,sha256=hashlib.sha256((h/n).read_bytes()).hexdigest()) for n in names if (h/n).exists()};r["captures"]=[dict(name=p.name,bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in (h/"captures").glob("*.png")];q=json.loads((h/"execution/receipt.json").read_text()) if (h/"execution/receipt.json").exists() else {};r["receipt"]={k:q.get(k) for k in ("status","error","guest_starts","text_bytes")};r["phases"]=[{k:p.get(k) for k in ("stage","status","pid","reason","error","returncode","peak_rss","cleaned")} for p in q.get("phases",[])];print(json.dumps(r,separators=(",",":")))'
 j,raw=py(code);save('runtime-inspection.json',json.loads(j['stdout']));print(j['stdout'][:1800])
elif mode=='fetch-diagnostics':
 # Bounded text/artifact retrieval, original streams retain distinct filenames.
 names=['launcher.stdout','launcher.stderr','execution/receipt.json','execution/startup.stdout','execution/startup.stderr','execution/guest.stdout','execution/guest.stderr','startup-mount-receipt.json','profile.json','launcher-pid.json']
 for n in names:
  code='import pathlib,json;h=pathlib.Path('+repr(REMOTE)+');p=h/'+repr(n)+';print(json.dumps(dict(exists=p.exists(),bytes=p.stat().st_size if p.exists() else 0)))'
  j,_=py(code);meta=json.loads(j['stdout'])
  if not meta['exists']:continue
  assert meta['bytes']<=2*M
  b=bytearray()
  for offset in range(0,meta['bytes'],4096):
   code='import pathlib,base64;print(base64.b64encode(pathlib.Path('+repr(REMOTE+'/'+n)+').read_bytes()['+str(offset)+':'+str(offset+4096)+']).decode())'
   j,_=py(code);b.extend(base64.b64decode(j['stdout'].strip(),validate=True))
  assert len(b)==meta['bytes'];p=H/'runtime'/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
 print('distinct runtime diagnostics retained')
elif mode=='capture-plan':
 before=used();j,raw=remote('python3 '+shlex.quote(REMOTE+'/remote-transport.py')+' '+str(before));meta=json.loads(j['stdout']);save('actual-capture-plan.json',meta);save('capture-ledger-start.json',dict(usedBeforePlan=before,planResponseIndex=len(list((H/'api').glob('*.raw')))-1,planResponseBytes=len(raw)));print(json.dumps(dict(images=meta['images'],total=meta['total'],recordCount=meta['recordCount'])))
elif mode=='recover-plan':
 j,raw=remote('cat '+shlex.quote(REMOTE+'/actual-capture-plan.json'));save('actual-capture-plan.json',json.loads(j['stdout']));print('retained remote plan restored; no plan recomputation or guest execution')
