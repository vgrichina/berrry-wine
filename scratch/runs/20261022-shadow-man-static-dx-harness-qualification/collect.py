import pathlib,subprocess,json,base64,hashlib,concurrent.futures
E=pathlib.Path(__file__).resolve().parent;D=E/'remote-evidence';D.mkdir(exist_ok=True)
R='/home/user/shadow-man-dsetup-canonical-qualification-oct22/evidence-static-dx-harness-qualification'
receipts=[]
def api(code):
 import shlex
 p=subprocess.run(['boat','exec','--json','bx_f3gs8qm2','python3 -c '+shlex.quote(code)],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 j=json.loads(p.stdout);assert j['exitCode']==0 and not j.get('stdoutTruncated') and not j.get('stderrTruncated'),j
 receipts.append({k:v for k,v in j.items() if k not in ['stdout','stderr']})
 return j['stdout']
manifest=json.loads(api('import pathlib,json,hashlib;R=pathlib.Path('+repr(R)+');print(json.dumps([dict(path=str(p.relative_to(R)),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in R.rglob("*") if p.is_file()]))'))
def copy(row):
 p=D/row['path'];p.parent.mkdir(exist_ok=True,parents=True)
 data=bytearray()
 for offset in range(0,row['bytes'],24000):
  code='import pathlib,base64;print(base64.b64encode(pathlib.Path('+repr(R+'/'+row['path'])+').read_bytes()['+str(offset)+':'+str(offset+24000)+']).decode())'
  data.extend(base64.b64decode(api(code)))
 assert len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256'],row
 p.write_bytes(data)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(copy,manifest))
(E/'evidence-transfer.json').write_text(json.dumps(dict(manifest=manifest,receipts=receipts,method='authorized Boat API exec reads; SCP SSH permission denied, not retried'),indent=2)+'\n')
print('Collected',len(manifest),'files',sum(r['bytes'] for r in manifest),'bytes; all SHA256 verified')
