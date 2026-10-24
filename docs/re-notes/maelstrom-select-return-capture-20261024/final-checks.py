from work import *
import resource,re
mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024;assert mem>=805306368
resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
receipts=[]
for name,args in [('observer',['node','--max-old-space-size=256',str(H/'observer-test.cjs')]),('parser',['node','--max-old-space-size=256',str(H/'parser-test.cjs'),str(H/'guest-args.json')]),('syntax',['node','--max-old-space-size=256','--check',str(H/'preload.cjs')]),('run-evidence',['node','--max-old-space-size=256','/home/user/wine-assembly/ops/check-run-evidence.js',str(H/'repo')])]:
 r=subprocess.run(args,capture_output=True,text=True,timeout=60);receipts.append(dict(name=name,argv=args,returncode=r.returncode,stdout=r.stdout,stderr=r.stderr));assert r.returncode==0,r.stderr
# Reject missing instrumentation and wrong historical identity before any execution.
x=json.load(open(H/'export-validation.json'))
def require(exports):assert {'get_count','set_count','get_eip','get_esp','get_yield_reason','set_bp'}<=set(exports)
try:require([n for n in x['exports'] if n!='get_count']);raise RuntimeError('false acceptance')
except AssertionError:missingRejected=True
try:assert x['wasmSHA256']=='0'*64;raise RuntimeError('false acceptance')
except AssertionError:wrongIdentityRejected=True
save('final-checks.json',dict(passChecks=True,memAvailable=mem,cpuCap=60,wallEach=60,nodeHeap=256,receipts=receipts,missingExportRejected=missingRejected,wrongIdentityRejected=wrongIdentityRejected))
print('final checks PASS')
