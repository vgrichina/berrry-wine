import pathlib,json,subprocess,base64,zlib
E=pathlib.Path('/home/user/wine-assembly-aoe3-reviewed-canonical-localization-oct22/scratch/runs/20261022-aoe3-reviewed-canonical-localization'); rows=json.loads((E/'build-input-manifest.json').read_text()); payload='PAYLOAD'
code='''import pathlib,json,hashlib,base64,zlib
r=pathlib.Path('/home/user/aoe3-oleaut-repair-oct22');rows=json.loads(zlib.decompress(base64.b64decode(INPUT)));out=[]
for x in rows:
 p=r/x['path']
 if not p.is_file():out.append(dict(x,status='missing'));continue
 data=p.read_bytes();oid=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\\0'+data).hexdigest()
 if oid!=x['gitBlob']:out.append(dict(x,status='different',actual=oid))
print(json.dumps(dict(differences=out,filesCompared=len(rows),deps={str(p):p.exists() for p in [pathlib.Path('/home/user/aoe3-original-oct22/runner/node_modules'),r/'tools/watx-src']})))'''.replace('INPUT',repr(payload))
results=[]
for start in range(0,len(rows),400):
 payload=base64.b64encode(zlib.compress(json.dumps(rows[start:start+400]).encode())).decode()
 part=code.replace('PAYLOAD',payload)
 p=subprocess.run(['boat','exec','--json','--timeout','30','bx_32262dnp','--','python3','-c',part],capture_output=True,text=True); x=json.loads(p.stdout);assert x['exitCode']==0;results.append(x)
(E/'mapping-inventory.json').write_text(json.dumps(results,indent=2))
for x in results:
 y=json.loads(x['stdout']);print(json.dumps(y))
p=subprocess.run(['git','ls-remote','https://github.com/vgrichina/berrry-wine.git','refs/heads/main','refs/heads/task/aoe3-oleaut-independent-sparse-review-oct22'],capture_output=True,text=True);(E/'refs-before.txt').write_text(p.stdout);print(p.stdout)
