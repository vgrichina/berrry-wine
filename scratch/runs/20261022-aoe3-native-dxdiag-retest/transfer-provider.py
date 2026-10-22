from pathlib import Path
import subprocess,json,base64,gzip,hashlib
E=Path(__file__).resolve().parent;remote='/home/user/aoe3-native-dxdiag-retest-oct22'
b=Path('/home/user/wine-assembly/test/binaries/candidates/pirates-2004/dx9/dxdiagn.dll').read_bytes();assert hashlib.sha256(b).hexdigest()=='50e31067ca6872ae0b7b35a65bf2a9d07c1de539b2d603a9472a48f5375c8307'
data=base64.b64encode(gzip.compress(b)).decode();receipts=[]
for n,start in enumerate(range(0,len(data),48000)):
 code='from pathlib import Path;import base64;p=Path('+repr(remote+f'/provider.part{n}')+');assert not p.exists();p.write_bytes(base64.b64decode('+repr(data[start:start+48000])+'))'
 raw=subprocess.check_output(['/home/user/.ascii/boat','--json','exec','bx_h44kbrcy','--timeout','60','--','python3','-c',code]);r=json.loads(raw);receipts.append(r);assert r['exitCode']==0 and not r['stdoutTruncated'],r
(E/'transfer-receipts.json').write_text(json.dumps(receipts,indent=2)+'\n');print('PASS provider transfer chunks',len(receipts),'compressed',len(data)*3//4)
