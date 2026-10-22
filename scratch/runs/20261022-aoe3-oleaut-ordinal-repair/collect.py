import pathlib,subprocess,json,base64,hashlib
E=pathlib.Path(__file__).resolve().parent
code='''import pathlib,json,base64,hashlib,datetime,os,socket
r=pathlib.Path('/home/user/aoe3-oleaut-repair-oct22');e=r/'evidence'; original=pathlib.Path('/home/user/aoe3-original-oct22')
pins=[]
for root,entries in [(original/'runtime',json.loads((original/'runtime-pins.json').read_text())),(original/'installed',json.loads((original/'installed-audit/installed-manifest.json').read_text())['files'])]:
 for x in entries:
  p=root/x['path'];ok=p.stat().st_size==x['size'] and hashlib.file_digest(p.open('rb'),'sha256').hexdigest()==x['sha256'];pins.append(dict(path=str(p),ok=ok));assert ok,p
(e/'original-pins-final.json').write_text(json.dumps(dict(count=len(pins),passAll=all(x['ok'] for x in pins),at=datetime.datetime.now(datetime.timezone.utc).isoformat()),indent=2))
ports={}
for port in [8123,8124]:
 s=socket.socket();s.settimeout(1);ports[str(port)]=s.connect_ex(('127.0.0.1',port));s.close()
(e/'process-state.json').write_text(json.dumps(dict(portsConnectEx=ports,processes=os.popen("ps -eo pid,args | grep -E 'node.*(aoe3-oleaut-repair|diagnostic-run|test/run.js)' | grep -v grep").read(),at=datetime.datetime.now(datetime.timezone.utc).isoformat(),freeBytes=os.statvfs(r).f_bavail*os.statvfs(r).f_frsize),indent=2))
# Compact the two complete 373-entry pin checks for transport while retaining them.
import gzip
for name in ['original-pins-before.json','original-pins-after.json']:
 p=e/name
 if p.exists():
  (e/(name+'.gz')).write_bytes(gzip.compress(p.read_bytes()));p.unlink()
print(json.dumps({p.name:base64.b64encode(p.read_bytes()).decode() for p in e.iterdir() if p.is_file()}))
'''
p=subprocess.run(['boat','exec','--json','--timeout','30','bx_32262dnp','--','python3','-c',code],capture_output=True,text=True);(E/'collect-receipt.json').write_text(p.stdout);r=json.loads(p.stdout);assert p.returncode==0 and r['exitCode']==0 and not r.get('stdoutTruncated'),r
raw=E/'raw';raw.mkdir(exist_ok=True);files=json.loads(r['stdout']);out=[]
for name,encoded in files.items():
 assert pathlib.Path(name).name==name
 d=base64.b64decode(encoded);(raw/name).write_bytes(d);out.append(dict(path='raw/'+name,bytes=len(d),sha256=hashlib.sha256(d).hexdigest()))
(E/'collected-manifest.json').write_text(json.dumps(out,indent=2)+'\n');print('collected',len(out),'files',sum(x['bytes'] for x in out),'bytes')
