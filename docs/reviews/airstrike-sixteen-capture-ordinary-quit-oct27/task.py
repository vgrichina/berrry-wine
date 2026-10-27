import sys,pathlib,json,hashlib,base64,zlib,subprocess,time,os,shutil,resource
import run as c
H,R=c.H,c.R
REMOTE='/tmp/airstrike-sixteen-capture-ordinary-quit-oct27'
MAP=c.ROOT/'scratch/usage-watch/airstrike-cleanup-verified-runtime-map-oct27.json'
API_LIMIT=8*1048576
def api(code,label,args=(),detach=False):
    prior=sum(p.stat().st_size for p in H.glob('api-*.stdout'))
    assert prior+8192+1048576<=API_LIMIT,'API reserve exhausted'
    cmd=['/home/user/.ascii/boat','exec','--json']+(['--detach'] if detach else ['--timeout','20'])+['bx_fk6x4peu','python3','-B','-c',code,*args]
    sys.argv=['run','exec','api-'+label,*cmd];c.main()
    raw=(H/('api-'+label+'.stdout')).read_bytes();assert len(raw)<=8192
    q=json.loads(raw)
    assert not q.get('stdoutTruncated') and not q.get('stderrTruncated'),q
    if not detach:assert q.get('exitCode')==0,q
    return q if detach else q['stdout']
def git(label,*args):
    # The enclosing invocation must own both execution pool permits.
    sys.argv=['run','gitblob' if label.startswith('source-') else 'git',label,*args];c.main()
    return (H/(label+('.blob' if label.startswith('source-') else '.stdout'))).read_bytes()
def sendfiles(rows,label):
    assert len(rows)<=40
    code='''import sys,pathlib,json,zlib,base64,hashlib
R=pathlib.Path(sys.argv[1]);rows=json.loads(zlib.decompress(base64.b64decode(sys.argv[2])));n=0
for x in rows:
 p=R/x['target'];p.parent.mkdir(parents=True,exist_ok=True);b=base64.b64decode(x['data']);assert hashlib.sha256(b).hexdigest()==x['sha256'];p.write_bytes(b);n+=len(b)
print(json.dumps(dict(files=len(rows),bytes=n)))'''
    encoded=base64.b64encode(zlib.compress(json.dumps(rows).encode())).decode()
    if len(encoded)<=50000:return api(code,label,[REMOTE,encoded])
    pack=REMOTE+'/transfer.pack'
    for n in range(0,len(encoded),50000):
        api('import pathlib,sys;p=pathlib.Path(sys.argv[1]);p.parent.mkdir(parents=True,exist_ok=True);f=p.open(sys.argv[2]);f.write(sys.argv[3]);f.close();print(p.stat().st_size)',label+'-chunk-'+str(n),[pack,'w' if n==0 else 'a',encoded[n:n+50000]])
    return api(code.replace('sys.argv[2]',"pathlib.Path(sys.argv[2]).read_text()"),label,[REMOTE,pack])
def main():
 mode=sys.argv[1]
 if mode=='source':
    x=json.loads(MAP.read_text())['files'][0]
    b=git('source-pinned-runner','-C',x['gitDonor'],'show',x['gitRevision']+':'+x['source'])
    assert hashlib.sha256(b).hexdigest()==x['sha256'];(H/'production-runner.js').write_bytes(b);(H/'source-pinned-runner.blob').unlink();print(x['sha256'])
 elif mode=='stage':
    rows=json.loads(MAP.read_text())['files'];start=int(sys.argv[2]);end=min(start+40,len(rows));payload=[]
    for i,x in enumerate(rows[start:end],start):
        b=git('source-'+str(i),'-C',x['gitDonor'],'show',x['gitRevision']+':'+x['source']) if x['kind']=='git' else pathlib.Path(x['source']).read_bytes()
        assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256']
        # Source bytes must not be duplicated in retained stdout command logs.
        if x['kind']=='git':(H/('source-'+str(i)+'.blob')).unlink()
        payload.append(dict(target=x['target'],sha256=x['sha256'],data=base64.b64encode(b).decode()))
    print(sendfiles(payload,'stage-'+str(start)))
 elif mode=='boundary':
    import importlib.util
    D=pathlib.Path('/tmp/airstrike-complete-controller-main-integration-oct27/repo')
    spec=importlib.util.spec_from_file_location('fixture',D/'test/test-airstrike-observation-bridge.py');t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)
    os.environ['AIRSTRIKE_BRIDGE_FIXTURES']=str(H);request=t.bridge.Bridge.request;counts={'png':0}
    def guard(self,action,deadline=None,**kw):
        if action=='png':
            assert counts['png']<16,'sixteen capture limit';counts['png']+=1
        return request(self,action,deadline,**kw)
    t.bridge.Bridge.request=guard
    obj,result,inputs=t.Integration().exercise('sixteen-cap',seconds=10)
    assert result['status']=='normal-quit-observed' and counts['png']==16,(result,counts)
    c.dump('boundary-result.json',dict(fixtureOnly=True,result=result,counts=counts,evidence=str(obj.root),pins=[dict(source=x['source'],sha256=x['sha256']) for x in json.loads(MAP.read_text())['files'] if x['kind']=='file' and 'airstrike-' in x['target']]))
    print('16 capture exact production resource fixture PASS; no guest')
 elif mode=='inspect':
    print(api(sys.argv[2],sys.argv[3]))
 elif mode=='extras':
    payload=[]
    for filename in ('remote.py','proxy.py'):
        b=(H/filename).read_bytes();payload.append(dict(target='ops/'+filename,data=base64.b64encode(b).decode(),sha256=hashlib.sha256(b).hexdigest()))
    b=MAP.read_bytes();payload.append(dict(target='ops/runtime-map.json',data=base64.b64encode(b).decode(),sha256=hashlib.sha256(b).hexdigest()))
    b=pathlib.Path('/tmp/airstrike-accepted-focus-menu-quit-api-oct27/ops/abi-preload-relocated.cjs').read_bytes().replace(b'/home/user/airstrike-menu-quit-oct27',REMOTE.encode()).replace(b"/evidence'",b"/ops'")
    payload.append(dict(target='ops/abi-preload.cjs',data=base64.b64encode(b).decode(),sha256=hashlib.sha256(b).hexdigest()))
    b=c.S.read_bytes();payload.append(dict(target='ops/supervisor.py',data=base64.b64encode(b).decode(),sha256=hashlib.sha256(b).hexdigest()))
    print(sendfiles(payload,'extras'))
 elif mode=='launch':
    print(api('import os;os.execv("/usr/bin/python3",["python3","-B",'+repr(REMOTE+'/ops/remote.py')+',"run"])','launch',detach=True))
if __name__=='__main__':main()
