import base64,concurrent.futures,hashlib,json,pathlib,subprocess
E=pathlib.Path(__file__).resolve().parent
src=E/'focused-stage.tar.gz'; data=src.read_bytes(); chunk=90000
# Each API exec writes one disjoint part. No SSH retry or credential change.
def part(i):
 b=data[i*chunk:(i+1)*chunk]; code='import pathlib,base64; p=pathlib.Path("/tmp/aoe3-oleaut-repair-parts"); p.mkdir(exist_ok=True); (p/"%04d").write_bytes(base64.b64decode(%r))'%(i,base64.b64encode(b).decode())
 p=subprocess.run(['boat','exec','--json','--timeout','30','bx_32262dnp','--','python3','-c',code],capture_output=True,text=True)
 r=json.loads(p.stdout);assert p.returncode==0 and r.get('exitCode')==0,r
 return {'part':i,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'receipt':r}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 rows=list(pool.map(part,range((len(data)+chunk-1)//chunk)))
(E/'transfer-receipts.json').write_text(json.dumps(rows,indent=2)+'\n')
code='import pathlib,hashlib,tarfile; p=pathlib.Path("/tmp/aoe3-oleaut-repair-parts"); out=pathlib.Path("/tmp/aoe3-oleaut-repair-source.tar.gz"); out.write_bytes(b"".join(x.read_bytes() for x in sorted(p.iterdir()))); assert hashlib.sha256(out.read_bytes()).hexdigest()==%r; dest=pathlib.Path("/home/user/aoe3-oleaut-repair-oct22"); dest.mkdir(); tarfile.open(out).extractall(dest,filter="data"); print(str(dest))'%hashlib.sha256(data).hexdigest()
p=subprocess.run(['boat','exec','--json','--timeout','30','bx_32262dnp','--','python3','-c',code],capture_output=True,text=True); (E/'stage-receipt.json').write_text(p.stdout);r=json.loads(p.stdout);assert p.returncode==0 and r.get('exitCode')==0,r
print('PASS staged',len(rows),'parts',len(data),'bytes',hashlib.sha256(data).hexdigest())
