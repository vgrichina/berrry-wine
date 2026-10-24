from api import *
import os,time
os.environ['GIT_NO_LAZY_FETCH']='1'
p='tools/region-layout-hash.js';b=subprocess.check_output(['git','-C','/home/user/wine-assembly-shadow-man-span-static-canonical-oct23','show','b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a:'+p]);send(b,ROOT+'/runner/'+p)
j=json.load(open(H/'admission.json'));j['manifest'].append(dict(path=p,target='runner/'+p,bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),kind='git'));j['projected']+=len(b);j['remotePayload']+=len(b);j['pathCorrection']='Explicit pinned-WASM runtime branch requires region-layout-hash.js absent from supplied 125-file manifest; exact canonical Git blob added without source compilation.';(H/'admission.json').write_text(json.dumps(j,indent=2));send(json.dumps(j['manifest']).encode(),ROOT+'/manifest.json')
p='/home/user/wine-assembly-shadow-man-memory-recovered-handler-qualification-oct23/docs/re-notes/shadow-man-memory-recovered-handler-qualification-20261023/accepted-contract.json';send(pathlib.Path(p).read_bytes(),ROOT+'/accepted-contract.json');print('runtime helper+accepted ABI receipt staged')
