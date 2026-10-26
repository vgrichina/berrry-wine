import pathlib,subprocess,os,json,sys,time,hashlib
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';F=R/'test/maelstrom-diagnostic-canonical-native.cjs'
cases=['errno4','errno0','errno37','wrong-select-return','wrong-native-target','wrong-return-pc','wrong-ebp','unsafe-errno','return-without-call','block-mode','stale-start','foreign-thread','foreign-regbank','postframe','unsafe-caller','uop-mode','code16-mode','nested-call','foreign-thread-ret','foreign-regbank-ret']
guard='/home/user/wine-assembly-shadow-man-native-bound-canonical-oct23/docs/re-notes/shadow-man-native-bound-canonical-20261023/native-module-bound.cjs'
done=[]
for compat in [False,True]:
 for case in cases:
  ident=case+('-compat' if compat else '-tail')
  if ident=='errno4-tail':
   j=json.load(open(O/('native-result-'+ident+'.json')));assert j['status']=='PASS';done.append(ident);continue
  args=['node','--max-old-space-size=256',str(F),case]+(['--compat'] if compat else [])+['--preflight']
  # Cheap signature/isolation checks precede each scarce native case.
  env=dict(os.environ,CASE_ID=ident+'-preflight',PYTHONDONTWRITEBYTECODE='1')
  if subprocess.call([sys.executable,str(O/'supervise.py'),'cheap',*args],env=env,stdout=subprocess.DEVNULL):sys.exit('preflight failed '+ident)
  args=['node','--max-old-space-size=512','--require',guard,str(F),case]+(['--compat'] if compat else [])
  env['CASE_ID']=ident
  rc=subprocess.call([sys.executable,str(O/'supervise.py'),'native',*args],env=env,stdout=subprocess.DEVNULL)
  if rc:
   (O/'batch-first-failure.json').write_text(json.dumps(dict(case=ident,exit=rc,completed=done),indent=2));sys.exit('STOP first failure '+ident)
  j=json.load(open(O/('native-result-'+ident+'.json')));assert j['status']=='PASS';done.append(ident)
  cp=dict(candidate='44e344fdb26daab9a07210656597902ba27cb5f7',fixtureSHA256=hashlib.sha256(F.read_bytes()).hexdigest(),completed=done,moduleHashes=[r['sha256'] for r in json.load(open(O/'build-outputs.json'))],remaining='remaining listed cases then publication',at=time.time())
  tmp=O/'checkpoint-native.tmp';tmp.write_text(json.dumps(cp,indent=2));tmp.replace(O/'checkpoint-native.json')
  print('PASS '+ident,flush=True)
print(json.dumps(dict(status='PASS',nativeCases=len(done),cases=done)))
