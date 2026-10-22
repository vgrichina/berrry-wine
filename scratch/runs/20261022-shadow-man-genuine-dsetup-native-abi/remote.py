import subprocess,json,pathlib,sys,shlex,base64
E=pathlib.Path(__file__).resolve().parent
R='/home/user/shadow-man-dsetup-canonical-qualification-oct22'
def run(name,cmd,timeout=300):
 p=subprocess.run(['boat','exec','--json','--timeout',str(timeout),'bx_f3gs8qm2',cmd],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 (E/(name+'-api.json')).write_bytes(p.stdout)
 if p.stderr:(E/(name+'-transport.log')).write_bytes(p.stderr)
 j=json.loads(p.stdout);(E/(name+'.log')).write_text(j.get('stdout','')+j.get('stderr',''))
 print(name,j.get('commandId'),j.get('exitCode'),j.get('stdout','')[-2500:],j.get('stderr','')[-1000:],flush=True)
 assert j['exitCode']==0 and not j.get('stdoutTruncated') and not j.get('stderrTruncated'),name
 return j
def upload(name,files):
 payload={remote:base64.b64encode(pathlib.Path(local).read_bytes()).decode() for local,remote in files}
 code='import pathlib,base64,json;d=json.loads('+repr(json.dumps(payload))+');[(pathlib.Path(p).parent.mkdir(parents=True,exist_ok=True),pathlib.Path(p).write_bytes(base64.b64decode(b))) for p,b in d.items()]'
 return run(name,'python3 -c '+shlex.quote(code))
if __name__=='__main__':run(sys.argv[1],sys.argv[2])
