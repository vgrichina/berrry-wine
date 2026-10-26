import pathlib,json,subprocess,os,shutil,time,hashlib,sys
from api import py,REMOTE
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo'
cases=[('errno0',False),('errno37',False),('errno0',True),('errno4',True),('errno37',True)]
controls=['wrong-select-return','wrong-native-target','wrong-return-pc','wrong-ebp','unsafe-errno','return-without-call','block-mode','stale-start','foreign-thread','foreign-regbank','postframe','unsafe-caller','uop-mode','code16-mode','nested-call','foreign-thread-ret','foreign-regbank-ret']
cases += [(n,c) for c in [False,True] for n in controls]
done=[]
for case,compat in cases:
 ident=case+('-compat' if compat else '-tail')
 if (O/('checkpoint-'+ident+'.json')).exists():done.append(ident);continue
 subprocess.run(['python3',str(O/'account.py')],env=dict(os.environ,CASE_ID=ident),stdout=subprocess.DEVNULL,check=True)
 admission=(O/('admission-'+ident+'.json')).read_text()
 py('import pathlib;pathlib.Path('+repr(REMOTE+'/ops/local-stage-admission.json')+').chmod(0o644);pathlib.Path('+repr(REMOTE+'/ops/local-stage-admission.json')+').write_text('+repr(admission)+')','local-admission-'+ident)
 args=['/home/user/.nvm/versions/node/v24.22.1/bin/node','--max-old-space-size=256','--require',REMOTE+'/ops/anchor-paths.cjs',REMOTE+'/repo/test/maelstrom-diagnostic-canonical-native.cjs',case]+(['--compat'] if compat else [])+['--preflight']
 code='import subprocess,os,sys; a='+repr(args)+'; r=subprocess.call(["python3",'+repr(REMOTE+'/ops/supervise-v2.py')+',"cheap",*a],env=dict(os.environ,CASE_ID='+repr(ident+'-preflight')+')); sys.exit(r)'
 try:
  pre=py(code,'preflight-'+ident,90)
  (O/('api-preflight-'+ident+'.json')).write_text(json.dumps(pre,indent=2))
  args=[args[0],'--max-old-space-size=512','--require',REMOTE+'/ops/native-module-bound.cjs','--require',REMOTE+'/ops/anchor-paths.cjs',REMOTE+'/repo/test/maelstrom-diagnostic-canonical-native.cjs',case]+(['--compat'] if compat else [])
  code='import subprocess,os,sys; a='+repr(args)+'; r=subprocess.call(["python3",'+repr(REMOTE+'/ops/supervise-v2.py')+',"native",*a],env=dict(os.environ,CASE_ID='+repr(ident)+')); sys.exit(r)'
  native=py(code,'native-'+ident,90)
  (O/('api-native-'+ident+'.json')).write_text(json.dumps(native,indent=2))
 except Exception as ex:
  (O/'first-failure.json').write_text(json.dumps(dict(case=ident,error=str(ex),completed=done,remaining=[n+('-compat' if c else '-tail') for n,c in cases if n+('-compat' if c else '-tail') not in done],at=time.time()),indent=2))
  print('STOP '+ident+': '+str(ex),flush=True);sys.exit(1)
 # Archive exact result/progress/preflight bytes losslessly after each group.
 code='''import pathlib,json,hashlib,gzip,time
O=pathlib.Path(REMOTE)/'ops'; ident=IDENT
p=O/('native-result-'+ident+'.json');j=json.loads(p.read_text());assert j['status']=='PASS'
rows=[]
for prefix in ['native-result-','native-progress-','native-preflight-']:
 p=O/(prefix+ident+'.json');b=p.read_bytes();q=p.with_suffix('.json.gz');q.write_bytes(gzip.compress(b,mtime=0));rows.append(dict(path=q.name,rawBytes=len(b),rawSHA256=hashlib.sha256(b).hexdigest(),sha256=hashlib.sha256(q.read_bytes()).hexdigest()));p.unlink()
cp=dict(candidate='44e344fdb26daab9a07210656597902ba27cb5f7',fixtureSHA256='ddb0d889541d32dddd881b168d6a69a85610050c1d56679765cec1c1531c65e2',moduleSHA256=j['moduleSHA256'],result=j['status'],case=ident,capture=j['capture'],equivalent=j['equivalent'],evidence=rows,completed=DONE,remaining=REMAINING,at=time.time())
p=O/('checkpoint-'+ident+'.json');p.write_text(json.dumps(cp,indent=2));t=O/'checkpoint-native.tmp';t.write_text(json.dumps(cp,indent=2));t.replace(O/'checkpoint-native.json')
files=[p for p in O.iterdir() if p.is_file() and (p.name.startswith(('native-','cheap-','mode-','checkpoint-','admission-')))]
assert sum(p.stat().st_size for p in files)<=2097152,'aggregate retained capture exceeds2MiB'
print(json.dumps(cp))
'''.replace('REMOTE',repr(REMOTE)).replace('IDENT',repr(ident)).replace('DONE',repr(done+[ident])).replace('REMAINING',repr([n+('-compat' if c else '-tail') for n,c in cases if n+('-compat' if c else '-tail') not in done+[ident]]))
  # Native result checkpoint is authoritative; no model substitution.
 cp=json.loads(py(code,'checkpoint-'+ident)['stdout']);(O/('checkpoint-'+ident+'.json')).write_text(json.dumps(cp,indent=2));done.append(ident)
 print('PASS '+ident,flush=True)
(O/'native-complete.json').write_text(json.dumps(dict(completed=done,at=time.time()),indent=2))
