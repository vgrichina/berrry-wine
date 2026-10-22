import pathlib,subprocess
E=pathlib.Path(__file__).resolve().parent
code=r'''
import pathlib,subprocess,os,time,json
root=pathlib.Path('/home/user/aoe3-independent-review-oct22');r=root/'candidate';e=root/'evidence';p=r/'src/09a7-handlers-dispatch.wat';good=p.read_bytes();start=good.index(b'  (func $handle_VariantInit ');end=good.index(b'  ;; VariantCopy',start);body=good[start:end];rows=[]
for label,old,new,expected in [
 ('control-handler-no-clear',b'(i32.const 16)',b'(i32.const 0)','actual VariantInit marks garbage VT_EMPTY'),
 ('control-handler-overrun',b'(i32.const 16)',b'(i32.const 17)','VariantInit preserves adjacent storage'),
 ('control-handler-wrong-pop',b'(i32.const 8)',b'(i32.const 12)','VariantInit pops return + one argument')]:
 try:
  assert body.count(old)==1
  p.unlink();p.write_bytes(good[:start]+body.replace(old,new)+good[end:])
  cmd=['node','test/test-oleaut32-ordinals.js'];t=time.time();x=subprocess.run(cmd,cwd=r,env=dict(os.environ,NODE_PATH='/home/user/aoe3-original-oct22/runner/node_modules'),capture_output=True,text=True,timeout=180);log=x.stdout+'\n'+x.stderr;(e/(label+'.log')).write_text(log);rows.append(dict(label=label,command=cmd,cwd=str(r),exit=x.returncode,seconds=time.time()-t,log=log));print(label,x.returncode,log[-2000:],flush=True);assert x.returncode==1 and expected in log
 finally:p.unlink();p.write_bytes(good)
(e/'handler-controls.json').write_text(json.dumps(rows,indent=2));print('RESULTS_JSON='+json.dumps(rows))
'''
p=subprocess.run(['boat','exec','--json','--timeout','120','bx_32262dnp','--','python3','-c',code],capture_output=True,text=True);(E/'handler-receipt.json').write_text(p.stdout);print(p.stdout,p.stderr)
