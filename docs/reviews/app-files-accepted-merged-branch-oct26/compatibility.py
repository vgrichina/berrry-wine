import sys, os, pathlib, json, subprocess, hashlib, time, resource
sys.path.insert(0,str(pathlib.Path(__file__).parent))
from integrate import R,O,resources,git,save,sha,blob,MAIN,C,A
resources('precompatibility')
wrapper='test/app-files-accepted-merged-compat-oct26.cjs'
git('add','--',wrapper)
tested=git('write-tree').decode().strip()
checkpoint={'candidate':C,'acceptance':A,'main':MAIN,'testedTree':tested,'groups':[],'remaining':['merged compatibility supplied7','merged compatibility independent8','docs-only report','task-only remote publication']}
for name,count in [('supplied',7),('independent',8)]:
 resources('before-'+name)
 cmd=['timeout','30s','node','--max-old-space-size=16','--test','--test-concurrency=1',wrapper]
 env=dict(os.environ,COMPAT_FIXTURE=name);env.pop('APP_FILES_MUTATION',None)
 def limits(): resource.setrlimit(resource.RLIMIT_FSIZE,(24*1024**2,24*1024**2))
 with (O/('merged-'+name+'.txt')).open('wb') as f:
  proc=subprocess.run(cmd,cwd=R,env=env,stdout=f,stderr=subprocess.STDOUT,timeout=35,preexec_fn=limits)
 log=(O/('merged-'+name+'.txt')).read_bytes();assert len(log)<=128*1024
 files=['lib/app-files.js','host.js',wrapper,'test/app-files-empty-alias-fallback-oct26.test.cjs','test/app-files-empty-alias-independent-oct26.test.cjs']
 g={'at':time.time(),'name':name,'command':cmd,'environment':{'COMPAT_FIXTURE':name,'APP_FILES_MUTATION':None},'exitCode':proc.returncode,'expectedPass':count,'evidence':'merged-'+name+'.txt','bytes':len(log),'sha256':sha(log),'sourceAndFixtureHashes':{p:sha((R/p).read_bytes()) for p in files}}
 checkpoint['groups'].append(g);checkpoint['remaining']=['independent8 compatibility' if name=='supplied' else 'docs-only report','task-only remote publication'];tmp=O/'checkpoint.tmp';tmp.write_text(json.dumps(checkpoint,indent=2)+'\n');tmp.replace(O/'checkpoint.json')
 assert proc.returncode==0 and ('ℹ pass '+str(count)).encode() in log and b'\xe2\x84\xb9 fail 0' in log,(proc.returncode,log[-1500:])
 print(name,proc.returncode,len(log))
save('tested-tree.json',{'tree':tested,'base':MAIN,'candidate':C,'acceptance':A,'validation':'7 supplied + 8 independent merged compatibility PASS; only old full-host pin adapted in-memory, all original assertions unchanged; 3 exact closure rejecting mutants reused','completed':['integration','preservation','73 accepted manifest payloads','exact Node/fixture/method closure','merged compatibility 7+8'],'remaining':['docs-only finalization','task-only push','exact remote verification']})
resources('postcompatibility')
