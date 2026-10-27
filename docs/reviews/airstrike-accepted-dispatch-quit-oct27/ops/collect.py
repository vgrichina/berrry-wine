import sys,pathlib,json,hashlib,base64,time,concurrent.futures
import task as t
H=t.H;D=H/'retained';D.mkdir(exist_ok=True)
def read(path,label,terminal=False):
 code='import pathlib,sys,json,base64,time;p=pathlib.Path(sys.argv[1]);end=time.monotonic()+9\nwhile not p.exists() and time.monotonic()<end:time.sleep(.05)\nb=p.read_bytes();print(json.dumps(dict(bytes=len(b),data=base64.b64encode(b).decode())))'
 q=json.loads(t.api(code,label,[path],terminal=terminal));return base64.b64decode(q['data'])
def collect(path,label,size,terminal=False):
 n=(size+5699)//5700
 def chunk(i):
  code='import pathlib,sys,base64;f=open(sys.argv[1],"rb");f.seek(int(sys.argv[2]));print(base64.b64encode(f.read(5700)).decode())'
  return base64.b64decode(t.api(code,label+'-'+str(i),[path,str(i*5700)],terminal=terminal))
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:b=b''.join(pool.map(chunk,range(n)))
 assert len(b)==size;return b
mode=sys.argv[1]
if mode=='review':
 b=read(t.REMOTE+'/ops/game-evidence/review-request.json','review-request-'+sys.argv[2]);q=json.loads(b);(D/'review-request.json').write_bytes(b)
 meta=json.loads(t.api('import pathlib,sys,json;p=pathlib.Path(sys.argv[1]);print(json.dumps(dict(bytes=p.stat().st_size)))','frame-meta-'+q['token'],[q['path']]))
 assert meta['bytes']<=300000
 b=collect(q['path'],'frame-'+q['token'],meta['bytes']);assert hashlib.sha256(b).hexdigest()==q['sha256'];p=D/(q['token']+'.png');p.write_bytes(b)
 print(json.dumps(dict(path=str(p),request=q)))
elif mode in ('respond','reject'):
 q=json.loads((D/'review-request.json').read_text());state=sys.argv[2];selected=int(sys.argv[3])
 obs=dict(after=q['after'],focus='airstrike' if mode=='respond' else 'unknown',unobscured=mode=='respond',evidence=str(D/(q['token']+'.png')),keysReleased=True,state=state)
 if mode=='reject':obs['reviewReason']='Inspected actual800x600 frame: Console overlays startup screen; Press any key to start visible; unobscured gameplay/menu and seven menu rows unestablished. No input authorized.'
 if state=='menu':obs.update(header='Airstrike menu',items=['Resume game','Players setup','Toggle fullscreen','About the game','Release notes','Toggle debug mode','Quit game'],selected=selected)
 response={k:q[k] for k in ('session','token','sha256','after')};response['observation']=obs
 p=D/('review-'+q['token']+'.json');p.write_text(json.dumps(response))
 print(t.api('import pathlib,sys,json; p=pathlib.Path(sys.argv[1]);v=json.loads(sys.argv[2]);tmp=p.with_suffix(".tmp");tmp.write_text(json.dumps(v));tmp.replace(p);print("observation recorded")','respond-'+q['token'],[t.REMOTE+'/ops/game-evidence/'+p.name,json.dumps(response)]))
elif mode=='status':
 code='''import pathlib,json,sys
H=pathlib.Path(sys.argv[1]);D=H/'game-evidence';out={}
for n in ('guest-supervision.json','guest.stdout','guest.stderr'):
 p=H/n
 if p.exists():out[n]=p.read_text()[-1700:]
for n in ('result.json','spawn-status.json','review-request.json','owned-cleanup.json'):
 p=D/n
 if p.exists():out[n]=json.loads(p.read_text())
print(json.dumps(out))'''
 print(t.api(code,'status-'+str(time.time_ns()),[t.REMOTE+'/ops'],terminal=True))
elif mode=='startup':
 names=['startup.stdout','startup-supervision.json','startup-accepted.json','remote-closure.json','planned-argv.json']
 for i,n in enumerate(names):
  meta=json.loads(t.api('import pathlib,sys,json;print(json.dumps(dict(bytes=pathlib.Path(sys.argv[1]).stat().st_size)))','startup-meta-'+str(i),[t.REMOTE+'/ops/'+n]))
  (D/n).write_bytes(collect(t.REMOTE+'/ops/'+n,'startup-file-'+str(i),meta['bytes']))
 config=json.loads((D/'startup-accepted.json').read_text());actual=json.loads((D/'startup.stdout').read_text())
 env={'PATH':'/home/user/.nvm/versions/node/v24.22.1/bin:/usr/local/bin:/usr/bin:/bin','HOME':'/home/user','LANG':'C.UTF-8','TZ':'UTC','PYTHONDONTWRITEBYTECODE':'1'}
 assert actual['environmentSHA256']==hashlib.sha256(json.dumps(sorted(env.items()),separators=(',',':')).encode()).hexdigest()
 assert actual['node']==config['node'] and actual['execArgv']==config['base'][1:]
 assert 'Max data size             unlimited' in actual['limits'] and 'Max address space         unlimited' in actual['limits']
 assert json.loads((D/'startup-supervision.json').read_text())['cleanupComplete']
 print('startup actual environment/executable/flags/limits inspected PASS',actual['version'],len(actual['files']),actual['commas'])
elif mode=='failed-sources':
 for i,n in enumerate(('failed-startup/startup.cjs','failed-startup/remote.py','failed-pre-guest-guard/remote.py')):
  b=read(t.REMOTE+'/ops/'+n,'failed-source-'+str(i),terminal=True);p=D/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
 print('failed causal launcher/preflight source versions retained')
elif mode=='final':
 code='''import pathlib,json,sys,hashlib
H=pathlib.Path(sys.argv[1]);print(json.dumps([dict(path=str(p.relative_to(H)),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in H.rglob('*') if p.is_file() and p.name!='runtime-map.json' and p.suffix not in ('.py','.cjs')],separators=(',',':')))'''
 rows=json.loads(t.api(code,'final-inventory',[t.REMOTE+'/ops'],terminal=True));(D/'remote-inventory.json').write_text(json.dumps(rows,indent=2))
 for i,x in enumerate(rows):
  p=D/x['path']
  # Reuse identical original frames already retained for inspection.
  existing=D/(pathlib.Path(x['path']).stem.removeprefix('capture-')+'.png')
  if x['path'].endswith('.png') and existing.exists() and hashlib.sha256(existing.read_bytes()).hexdigest()==x['sha256']:b=existing.read_bytes()
  else:b=collect(t.REMOTE+'/ops/'+x['path'],'final-'+str(i),x['bytes'],terminal=not x['path'].endswith('.png'))
  assert hashlib.sha256(b).hexdigest()==x['sha256'];p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
 print('terminal diagnostics retained',len(rows))
