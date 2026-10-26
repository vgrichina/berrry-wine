import sys,json,io,contextlib,time,os,signal,pathlib
code,mode,log=sys.argv[1:]
with open(log,'a') as f:f.write(json.dumps(dict(pid=os.getpid(),code=code,mode=mode))+'\n')
if mode=='detached-child':
 child=os.fork()
 if child==0:
  os.setsid()
  pathlib.Path(log+'.child').write_text(str(os.getpid()))
  time.sleep(3)
  os._exit(0)
 time.sleep(.04)
 sys.exit(7)
if mode=='held-pipe':
 child=os.fork()
 if child==0:
  pathlib.Path(log+'.child').write_text(str(os.getpid()))
  time.sleep(3);os._exit(0)
 time.sleep(.04);sys.exit(7)
out=io.StringIO();scope={}
j=dict(commandId='independent-local',cwd='.',exitCode=0,launcherFailed=False,oomKilled=False,signal=None,stderr='',stderrTruncated=False,stdoutTruncated=False,success=True,timedOut=False)
try:
 with contextlib.redirect_stdout(out):exec(compile(code,'<actual generated request>','exec'),scope)
 j['stdout']=out.getvalue()
except Exception as e:j.update(exitCode=1,success=False,stdout='',stderr=repr(e))
finally:
 if 'f' in scope:scope['f'].close()
if mode=='denial':j.update(exitCode=403,success=False,stderr='preserved fixture transport denial')
if mode=='hash' and 'h=hashlib' in code:
 meta=json.loads(j['stdout']);meta['sha256']='0'*64;j['stdout']=json.dumps(meta)+'\n'
if mode=='stat' and 'h=hashlib' in code:
 meta=json.loads(j['stdout']);meta['identity'][2]+=1;j['stdout']=json.dumps(meta)+'\n'
if mode=='envelope':j['stdoutTruncated']=True
if mode=='reorder' and 'f.seek(0)' in code:time.sleep(.12)
if mode=='mutate' and 'h=hashlib' in code:
 with open(scope['p'],'ab') as f:f.write(b'growth')
if mode=='replace' and 'h=hashlib' in code:
 p=pathlib.Path(scope['p']);q=p.with_suffix('.replacement');q.write_bytes(p.read_bytes());q.replace(p)
print(json.dumps(j))
