import sys,json,pathlib,subprocess,base64,hashlib
ROOT=pathlib.Path(__file__).parent
BOX='bx_723bg5h6'
def run(args,name,timeout=180):
    p=subprocess.run(['boat','--json','exec',BOX,'--timeout',str(timeout),'--',*args],capture_output=True,text=True)
    v=json.loads(p.stdout)
    (ROOT/(name+'.json')).write_text(json.dumps(v,indent=2))
    assert not v.get('stdoutTruncated') and not v.get('stderrTruncated'),v
    print(v.get('stdout','')[-5000:]);print(v.get('stderr','')[-2000:])
    assert v.get('exitCode')==0,v
    return v
if __name__=='__main__':
    mode=sys.argv[1]
    if mode=='py':
        f=ROOT/sys.argv[2];run(['python3','-c',f.read_text()],f.stem+'-receipt')
    elif mode=='js':
        f=ROOT/sys.argv[2];run(['node','-e',f.read_text()],f.stem+'-receipt')
    elif mode=='get':
        remote,local=sys.argv[2:4]
        p=subprocess.run(['boat','--json','exec',BOX,'--timeout','30','--','node','-e','console.log(require("fs").readFileSync('+json.dumps(remote)+').toString("base64"))'],capture_output=True,text=True)
        v=json.loads(p.stdout);assert v['exitCode']==0 and not v['stdoutTruncated']
        b=base64.b64decode(v.pop('stdout').strip());f=ROOT/local;f.parent.mkdir(parents=True,exist_ok=True);f.write_bytes(b)
        v.update(bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),remotePath=remote)
        (ROOT/(local.replace('/','_')+'-transfer.json')).write_text(json.dumps(v,indent=2));print(v)
