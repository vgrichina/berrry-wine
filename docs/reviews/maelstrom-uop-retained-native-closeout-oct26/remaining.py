import sys,json,hashlib,subprocess,base64,pathlib
from stage import *
OLD=pathlib.Path('/tmp/maelstrom-uop-canonical-native-qualification-oct26/ops')
checkpoint=json.load(open(OLD/'checkpoint-native.json'))
fixture=hashlib.sha256((R/'test/maelstrom-diagnostic-canonical-native.cjs').read_bytes()).hexdigest()
checkpoint['reused']=checkpoint.pop('completed');checkpoint['completed']=[]
checkpoint['fixtureCorrection']='wrong-select-return only: accepted completionChecks[2] preserves reason3/mode4; standing path is transport only. Seven prior branch-independent cases reused without rerun.'
def save():
 p=O/'checkpoint-native.tmp';p.write_text(json.dumps(checkpoint,indent=2));p.replace(O/'checkpoint-native.json')
save()
for ev in list(checkpoint['remaining']):
 case,mode=ev.rsplit('-',1);compat=mode=='compat'
 subprocess.run([sys.executable,str(O/'account.py'),'resource-'+ev+'.json'],check=True,stdout=subprocess.DEVNULL)
 cmd=['python3',REMOTE+'/ops/remote-run.py','native',ev,'/home/user/.nvm/versions/node/v24.22.1/bin/node','--max-old-space-size=512','--require','/home/user/maelstrom-uop-canonical-native-qualification-oct26/ops/native-module-bound.cjs',REMOTE+'/repo/test/maelstrom-diagnostic-canonical-native.cjs',case]+(['--compat'] if compat else [])
 try:
  call(cmd,'case-'+ev,65)
 except Exception:
  for ext in ['stdout','stderr']:
   r=py('import pathlib;print(pathlib.Path('+repr(REMOTE+'/ops/'+ev+'.'+ext)+').read_text())','failure-'+ev+'-'+ext);(O/('failure-'+ev+'.'+ext)).write_text(r['stdout']);print(r['stdout'][:8192],flush=True)
  checkpoint['blocker']='first remaining failure '+ev;save();raise
 # Preserve complete state, original outputs, and supervisor admission/execution.
 code='import pathlib,json,gzip,base64;O=pathlib.Path('+repr(REMOTE+'/ops')+');names='+repr(['native-result-'+ev+'.json','native-preflight-'+ev+'.json','attempt-'+ev+'.json','execution-'+ev+'.json',ev+'.stdout',ev+'.stderr'])+';d={n:(O/n).read_text() for n in names};print(base64.b64encode(gzip.compress(json.dumps(d).encode(),mtime=0)).decode())'
 r=py(code,'retrieve-'+ev);b=base64.b64decode(r['stdout']);(O/('evidence-'+ev+'.json.gz')).write_bytes(b)
 import gzip
 files=json.loads(gzip.decompress(b));d=json.loads(files['native-result-'+ev+'.json']);assert d['status']=='PASS'
 row={k:d[k] for k in ['status','scenario','compat','moduleSHA256','capture','equivalent','warm']};row.update(fixtureSHA256=fixture,helperSHA256='3ea873bc5c18283fc6045b55d00a2e957eaff46b4372534dd59fba18354a9f6f',integration='e745cc29a1a3b859625aa0cd335abee0b185da71',evidence='evidence-'+ev+'.json.gz',evidenceSHA256=hashlib.sha256(b).hexdigest())
 checkpoint['completed'].append(row);checkpoint['remaining'].remove(ev);save()
 print(json.dumps(dict(case=ev,status=d['status'],capture=d['capture']['status'],equivalent=d['equivalent'])),flush=True)
