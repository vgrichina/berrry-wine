import pathlib,subprocess,json,base64
E=pathlib.Path(__file__).resolve().parent
payload=base64.b64encode((E.parents[2]/'test/test-getprocaddress-sparse-name.js').read_bytes()).decode()
code=r'''
import pathlib,subprocess,os,time,json,base64,hashlib
root=pathlib.Path('/home/user/aoe3-independent-review-oct22');e=root/'evidence';rows=[]
def replace(p,b):
 p.unlink();p.write_bytes(b)
def run(variant,label,test='test-getprocaddress-sparse-name',expected=0,contains=None):
 cmd=['node','test/'+test+'.js'];start=time.time();p=subprocess.run(cmd,cwd=root/variant,env=dict(os.environ,NODE_PATH='/home/user/aoe3-original-oct22/runner/node_modules'),capture_output=True,text=True,timeout=180)
 log=p.stdout+'\n'+p.stderr;(e/(label+'.log')).write_text(log);row=dict(label=label,cwd=str(root/variant),command=cmd,exit=p.returncode,expected=expected,seconds=time.time()-start,log=log);rows.append(row);print(label,p.returncode,log[-1600:],flush=True)
 assert p.returncode==expected,(label,log)
 if contains:assert contains in log,(label,log)
def pins():
 o=pathlib.Path('/home/user/aoe3-original-oct22');out=[]
 for base,entries in [(o/'runtime',json.loads((o/'runtime-pins.json').read_text())),(o/'installed',json.loads((o/'installed-audit/installed-manifest.json').read_text())['files'])]:
  for x in entries:
   p=base/x['path'];assert p.stat().st_size==x['size'] and hashlib.sha256(p.read_bytes()).hexdigest()==x['sha256'];out.append(str(p))
 return dict(count=len(out),passAll=True)
pre=pins()
fixed=base64.b64decode('PAYLOAD')
for variant in ['baseline','candidate']:
 replace(root/variant/'test/test-getprocaddress-sparse-name.js',fixed)
 run(variant,variant+'-fixed-sparse')
p=root/'candidate/test/test-getprocaddress-sparse-name.js'
try:
 # Remove only publication of LIVE, reproducing the obsolete fixture.
 bad=fixed.replace(b'(i32.atomic.store (call $dll_lifecycle_row (i32.const 0)) (global.get $DLL_LIFE_LIVE))',b'(i32.atomic.store (call $dll_lifecycle_row (i32.const 0)) (global.get $DLL_LIFE_FREE))')
 assert bad!=fixed;replace(p,bad);run('candidate','control-missing-live',expected=1,contains='real named export resolves')
finally:replace(p,fixed)
# Reject removal of an authentic address-table export: no hiding absent exports.
try:
 bad=fixed.replace(b'dllPut(0x900, 0x2000);',b'dllPut(0x900, 0);');assert bad!=fixed
 replace(p,bad);run('candidate','control-missing-export',expected=1,contains='real named export resolves')
finally:replace(p,fixed)
# A permissive resolver that ignores FREE must fail the new negative oracle.
p=root/'candidate/src/08b-dll-loader.wat';good=p.read_bytes()
try:
 guard=b'(i32.eq (i32.load (call $dll_lifecycle_row (local.get $dll_idx))) (global.get $DLL_LIFE_FREE))'
 assert good.count(guard)==2
 pin_guard=b'(i32.eq (local.get $state) (global.get $DLL_LIFE_FREE))'
 assert good.count(pin_guard)==1
 replace(p,good.replace(guard,b'(i32.const 0)').replace(pin_guard,b'(i32.const 0)'))
 run('candidate','control-bypass-lifecycle',expected=1,contains='FREE DLL row cannot resolve an export')
finally:replace(p,good)
for test in ['test-directx-ordinals','test-directsound-ordinals','test-bstr-byte-length','test-bstr-reallocation','test-dynamic-module-filename','test-loadlibrary-system-path','test-kernel32-image']:
 run('candidate',test,test)
post=pins()
(e/'fixed-results.json').write_text(json.dumps(dict(results=rows,pinsBefore=pre,pinsAfter=post),indent=2));print('RESULTS_JSON='+json.dumps(dict(results=rows,pinsBefore=pre,pinsAfter=post)))
'''.replace('PAYLOAD',payload)
p=subprocess.run(['boat','exec','--json','--timeout','240','bx_32262dnp','--','python3','-c',code],capture_output=True,text=True);(E/'fixed-receipt.json').write_text(p.stdout);print(p.stdout,p.stderr)
