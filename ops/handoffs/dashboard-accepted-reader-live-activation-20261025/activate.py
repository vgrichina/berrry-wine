import pathlib,os,subprocess,hashlib,json,datetime,sys,time
from probe import sample,api,now,P
live=pathlib.Path('/home/user/wine-dashboard-b0b9bc090');f=live/'ops/readers.js'
old='c0894ddf9fa1d8aaaa2bc45fcde290213a9831fffdcb28ba31b8f77753186e35';new='320ee6362b63497f7094bf6699ac1f95371047554e377b9e261401e6c3fa6137'
def sha(b):return hashlib.sha256(b).hexdigest()
def git(*args):return subprocess.check_output(['git','--no-optional-locks','-C',str(live),*args])
def proc_identity(pid):
 return {'envSHA256':sha(pathlib.Path(f'/proc/{pid}/environ').read_bytes()),'cwd':os.readlink(f'/proc/{pid}/cwd'),'uid':os.stat(f'/proc/{pid}').st_uid}
r={'startedAt':now(),'source':'397cdb6ca37c1f247cdd6e2618f6e1f3529342c4','originalSHA256':old,'acceptedSHA256':new,'restartCount':0,'recoveryRestartCount':0}
try:
 assert git('rev-parse','HEAD').decode().strip()=='a050a9ef28e58bd9d08207fe797352a000f5b550'
 assert subprocess.run(['git','--no-optional-locks','-C',str(live),'diff','--quiet','HEAD','--','ops/readers.js']).returncode==0
 assert sha(f.read_bytes())==old and sha((P/'readers.original.js').read_bytes())==old
 b=(P/'readers.accepted.js').read_bytes();assert sha(b)==new
 pre=sample('immediate-before');r['beforeIdentity']=proc_identity(pre['pid']);st=f.stat()
 tmp=pathlib.Path('/home/user/.dashboard-accepted-reader-live-activation-oct25.tmp');tmp.write_bytes(b);os.chmod(tmp,st.st_mode);os.chown(tmp,st.st_uid,st.st_gid)
 # Last pinned checkout/preimage checks immediately before the single atomic mutation.
 assert git('rev-parse','HEAD').decode().strip()=='a050a9ef28e58bd9d08207fe797352a000f5b550' and sha(f.read_bytes())==old
 assert subprocess.run(['git','--no-optional-locks','-C',str(live),'diff','--quiet','HEAD','--','ops/readers.js']).returncode==0
 os.replace(tmp,f);r['replacedAt']=now();assert sha(f.read_bytes())==new
 r['restartCount']=1
 c=subprocess.run(['systemctl','restart','wine-ops.service'],capture_output=True,text=True,timeout=30);r['restart']={'at':now(),'exit':c.returncode,'stdout':c.stdout,'stderr':c.stderr}
 (P/'activation.json').write_text(json.dumps(r,indent=2)+'\n')
 if c.returncode!=0:
  r['result']='BLOCKER';r['reason']='systemctl restart denied/failed; stop without workaround';raise SystemExit(2)
 post=sample('after-restart');r['afterIdentity']=proc_identity(post['pid'])
 assert post['pid']!=pre['pid'] and r['afterIdentity']==r['beforeIdentity'],'PID/config identity mismatch'
 assert subprocess.check_output(['systemctl','is-active','wine-ops.service'],text=True).strip()=='active'
 assert api('post-refresh'),'API qualification failed'
 sample('after-refresh')
 assert subprocess.check_output(['systemctl','cat','wine-ops.service'])==(P/'unit.before.txt').read_bytes(),'unit changed'
 r['result']='ACTIVATED_PENDING_OBSERVATION'
except SystemExit:raise
except Exception as e:
 r['reason']=repr(e)
 if r['restartCount'] and r.get('restart',{}).get('exit')==0:
  assert sha(f.read_bytes())==new,'owned reader changed unexpectedly; no overwrite'
  b=(P/'readers.original.js').read_bytes();assert sha(b)==old
  tmp=pathlib.Path('/home/user/.dashboard-accepted-reader-live-activation-oct25.rollback.tmp');tmp.write_bytes(b);os.chmod(tmp,st.st_mode);os.chown(tmp,st.st_uid,st.st_gid);os.replace(tmp,f)
  r['recoveryRestartCount']=1;c=subprocess.run(['systemctl','restart','wine-ops.service'],capture_output=True,text=True,timeout=30);r['recovery']={'at':now(),'exit':c.returncode,'stdout':c.stdout,'stderr':c.stderr};r['result']='ROLLED_BACK'
 else:r['result']='BLOCKER'
finally:
 r['finishedAt']=now();(P/'activation.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
