import hashlib,json,os,resource,subprocess,sys,time
from pathlib import Path
H=Path(__file__).parent
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def limits():
    resource.setrlimit(resource.RLIMIT_DATA,(16777216,16777216))
    resource.setrlimit(resource.RLIMIT_CPU,(60,60))
    resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
cases=[('identity',''),('cleanup',''),('modes',''),('recipe',''),('identity','skip-duplicate'),('identity','double-charge')]
results=[]
for group,mutation in cases:
    name=group+('-'+mutation if mutation else '')
    env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1',ACCEPT_MUTATION=mutation)
    with (H/(name+'.stdout')).open('xb') as out,(H/(name+'.stderr')).open('xb') as err:
        p=subprocess.run([sys.executable,'-B',str(H/'accept.py'),group],env=env,stdout=out,stderr=err,preexec_fn=limits,timeout=65)
    r=dict(name=name,returncode=p.returncode,expected=1 if group=='modes' or mutation else 0,stdoutSHA256=sha(H/(name+'.stdout')),stderrSHA256=sha(H/(name+'.stderr')),fixtureSHA256=sha(H/'accept.py'),helperSHA256=sha(H.parent/'repo/tools/enigma-bounded-staging.py'))
    r['matchedExpected']=r['returncode']==r['expected'];results.append(r)
    checkpoint=dict(candidate='f1aac7b9ba83e2bbc763cb58d38646653d626468',results=results,remaining=[g+('-'+m if m else '') for g,m in cases[len(results):]],blockers=['nonfont mode preservation'] if any(x['name']=='modes' and x['returncode'] for x in results) else [],time=time.time())
    tmp=H/'checkpoint.new';tmp.write_text(json.dumps(checkpoint,indent=2)+'\n');os.replace(tmp,H/'checkpoint.json')
    (H/('checkpoint-'+name+'.json')).write_text(json.dumps(checkpoint,indent=2)+'\n')
    print(json.dumps(r),flush=True)
    if not r['matchedExpected']:sys.exit(2)
