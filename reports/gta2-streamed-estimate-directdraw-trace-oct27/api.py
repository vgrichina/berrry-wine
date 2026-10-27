import pathlib,subprocess,time,json,sys,hashlib
O=pathlib.Path(__file__).parent
def api(command,detach=False):
 assert len(command.encode())<=36000
 d=O/'responses';d.mkdir(exist_ok=True)
 used=sum(p.stat().st_size for p in d.iterdir())
 assert used+8192+1048576<=8388608
 ident=str(time.time_ns());pfx=d/ident
 (O/'commands').mkdir(exist_ok=True)
 (O/'commands'/(ident+'.json')).write_text(json.dumps(dict(command=command,sha256=hashlib.sha256(command.encode()).hexdigest())))
 start=time.monotonic()
 with pathlib.Path(str(pfx)+'.stdout').open('xb') as out,pathlib.Path(str(pfx)+'.stderr').open('xb') as err:
  argv=['/home/user/.ascii/boat','exec','--no-update','--json']+(['--detach'] if detach else ['--timeout','10'])+['bx_cqss3x42',command]
  p=subprocess.Popen(argv,stdout=out,stderr=err)
  pathlib.Path(str(pfx)+'.start.json').write_text(json.dumps(dict(pid=p.pid,pending=True,at=time.time())))
  try:r=p.wait(timeout=20)
  except subprocess.TimeoutExpired:
   p.terminate();p.wait();pathlib.Path(str(pfx)+'.uncertain.json').write_text('{}');raise
 raw=pathlib.Path(str(pfx)+'.stdout').read_bytes();e=pathlib.Path(str(pfx)+'.stderr').read_bytes()
 pathlib.Path(str(pfx)+'.terminal.json').write_text(json.dumps(dict(exit=r,seconds=time.monotonic()-start,bytes=len(raw)+len(e))))
 assert r==0 and len(raw)+len(e)<=8192,(ident,r)
 j=json.loads(raw);assert (detach or j.get('exitCode')==0) and not j.get('stdoutTruncated') and not j.get('stderrTruncated'),(ident,j)
 return j
if __name__=='__main__':print(json.dumps(api(sys.argv[1])))
