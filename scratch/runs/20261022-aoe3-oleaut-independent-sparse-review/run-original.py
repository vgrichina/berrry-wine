import pathlib,subprocess,json
E=pathlib.Path(__file__).resolve().parent
code=r'''
import pathlib,subprocess,os,time,json
root=pathlib.Path('/home/user/aoe3-independent-review-oct22');e=root/'evidence';e.mkdir(exist_ok=True);rows=[]
for variant in ['baseline','candidate']:
 for test,args in [('test-getprocaddress-sparse-name',[]),('test-oleaut32-ordinals',['--expect-baseline'] if variant=='baseline' else [])]:
  cmd=['node','test/'+test+'.js']+args;start=time.time();p=subprocess.run(cmd,cwd=root/variant,env=dict(os.environ,NODE_PATH='/home/user/aoe3-original-oct22/runner/node_modules'),capture_output=True,text=True,timeout=180)
  label=variant+'-original-'+test;log=p.stdout+'\n'+p.stderr;(e/(label+'.log')).write_text(log);rows.append(dict(label=label,cwd=str(root/variant),command=cmd,exit=p.returncode,seconds=time.time()-start,log=log));print(label,p.returncode,log[-1800:],flush=True)
(e/'original-results.json').write_text(json.dumps(rows,indent=2));print('RESULTS_JSON='+json.dumps(rows))
'''
p=subprocess.run(['boat','exec','--json','--timeout','240','bx_32262dnp','--','python3','-c',code],capture_output=True,text=True);(E/'original-receipt.json').write_text(p.stdout);print(p.stdout,p.stderr)
