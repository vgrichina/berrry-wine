
import pathlib,json,hashlib,socket,subprocess,os
r=pathlib.Path('/home/user/aoe3-oleaut-repair-oct22');e=r/'evidence/host-census-canonical-20261022T1237Z';rows=json.loads((e/'source-manifest.json').read_text());drift=[]
for x in rows:
 p=r/x['path'];h=hashlib.sha256(p.read_bytes()).hexdigest()
 if h!=x['sha256']:drift.append({'path':x['path'],'actual':h,'expected':x['sha256']})
assert not drift
out={p.name:p.read_text() for p in e.iterdir() if p.is_file() and p.name not in ['source-manifest.json','census-before.json']}
ports={}
for port in [8123,8124]:
 s=socket.socket();ports[port]=s.connect_ex(('127.0.0.1',port));s.close()
state=dict(sourceFiles=len(rows),postBuildSourceDrift=drift,sourceManifestSHA256=hashlib.sha256((e/'source-manifest.json').read_bytes()).hexdigest(),sourceFingerprint=hashlib.sha256(b''.join(x['path'].encode()+b'\0'+x['sha256'].encode()+b'\n' for x in rows)).hexdigest(),portsConnectEx=ports,processes=subprocess.run(['pgrep','-a','-f','node|chrome|chromium'],capture_output=True,text=True).stdout,free=os.statvfs(r).f_bavail*os.statvfs(r).f_frsize,missingFirstBlocker=str(r/'fonts/Terminal.fon'),firstBlockerPresent=(r/'fonts/Terminal.fon').exists())
(e/'final-integrity.json').write_text(json.dumps(state,indent=2));out['final-integrity.json']=json.dumps(state,indent=2)
print(json.dumps(out))
