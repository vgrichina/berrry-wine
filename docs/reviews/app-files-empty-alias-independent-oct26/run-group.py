import pathlib,subprocess,json,hashlib,time,os,resource,shutil,sys
p=pathlib.Path(__file__).resolve().parent.parent;r=p/'repo';o=p/'ops';name=sys.argv[1];expected=int(sys.argv[2]);cmd=sys.argv[3:]
mem=int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:')))*1024
assert mem-536870912-16777216>=805306368
assert shutil.disk_usage(p).free-56*1024**2>=2982150144
assert cmd[:4]==['timeout','30s','node','--max-old-space-size=16']
def limits():resource.setrlimit(resource.RLIMIT_FSIZE,(24*1024**2,24*1024**2))
with (o/(name+'.txt')).open('wb') as f:
 proc=subprocess.run(cmd,cwd=r,stdout=f,stderr=subprocess.STDOUT,preexec_fn=limits,timeout=35)
b=(o/(name+'.txt')).read_bytes();assert len(b)<=128*1024
sha=lambda b:hashlib.sha256(b).hexdigest()
files=['lib/app-files.js','host.js','test/app-files-empty-alias-fallback-oct26.test.cjs']
files += [x for x in cmd if x.startswith('test/') and x not in files]
cp=o/'checkpoint.json';data=json.loads(cp.read_text()) if cp.exists() else {'candidate':'e9f3142b68816c6512d65db132ea43ba4e8c36ca','groups':[]}
data['groups'].append({'name':name,'environment':{'APP_FILES_MUTATION':os.environ.get('APP_FILES_MUTATION')},'at':time.time(),'command':cmd,'exitCode':proc.returncode,'expectedExitCode':expected,'sourceAndFixtureHashes':{x:sha((r/x).read_bytes()) for x in files},'evidence':name+'.txt','sha256':sha(b),'bytes':len(b)})
data['remaining']=['independent cases/mutants' if name=='supplied-final' else 'review and publication','current-main integration','browser/runtime/gameplay gates'];tmp=o/'checkpoint.tmp';tmp.write_text(json.dumps(data,indent=2));tmp.replace(cp)
print(name,'exit',proc.returncode,'bytes',len(b));print(b.decode()[-2500:]);assert proc.returncode==expected
