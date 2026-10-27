"""Bounded diagnostic for the unchanged trusted conservative accounting.
No build, guard change, reduced CPU allowance, or runtime access. Linux wait4
on the entire inner-supervisor subtree is the independent unique-CPU control.
"""
import os,sys,pathlib,subprocess,json,importlib.util,hashlib,tempfile
SUP=pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
assert hashlib.sha256(SUP.read_bytes()).hexdigest()=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
BURN='import time; start=time.process_time();\nwhile time.process_time()-start<0.6: pass\ntime.sleep(0.1)'
if len(sys.argv)>1 and sys.argv[1]=='inner':
 spec=importlib.util.spec_from_file_location('trusted',SUP);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 if sys.argv[2]=='flat':cmd=[sys.executable,'-c',BURN]
 else:cmd=[sys.executable,'-c','import subprocess,sys,time;subprocess.run([sys.executable,"-c",'+repr(BURN)+'],check=True);time.sleep(0.1)']
 r=m.supervise(cmd,rss_limit=128*1024**2,cpu_limit=90,wall_limit=120,output_limit=2*1024**2)
 assert not r.pop('output')
 print(json.dumps(r));sys.exit(0 if r['exit']==0 and r['stopReason'] is None and r['cleanupComplete'] else 1)
rows=[]
for mode in ('flat','nested'):
 with tempfile.TemporaryFile() as out,tempfile.TemporaryFile() as err:
  p=subprocess.Popen([sys.executable,__file__,'inner',mode],stdout=out,stderr=err)
  pid,status,usage=os.wait4(p.pid,0);p.returncode=os.waitstatus_to_exitcode(status)
  out.seek(0);err.seek(0);stderr=err.read().decode();assert p.returncode==0,stderr
  r=json.load(out)
 true=usage.ru_utime+usage.ru_stime
 rows.append(dict(mode=mode,reported=r['cpuSeconds'],uniqueWholeSubtreeCPU=true,overcharge=r['cpuSeconds']-true,receipt=r,stderr=stderr))
 # Reject interpreting this reported number as unique aggregate CPU.
 assert r['cpuSeconds']>true+0.25,(mode,r,true)
assert rows[1]['overcharge']>rows[0]['overcharge']+0.25,rows
result={'supervisor':str(SUP),'sha256':hashlib.sha256(SUP.read_bytes()).hexdigest(),'controls':rows,'finding':'Demonstrated conservative duplicate charging, not proof canonical unique CPU was below90. No guard changed; build remains rejected.'}
print(json.dumps(result,indent=2))
