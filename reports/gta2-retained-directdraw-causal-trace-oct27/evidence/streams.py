import sys,pathlib,subprocess,json,time
O=pathlib.Path('/tmp/gta2-retained-directdraw-causal-trace-oct27/ops');label=sys.argv[1]
with (O/(label+'.stdout')).open('xb') as out,(O/(label+'.stderr')).open('xb') as err:
 try:
  p=subprocess.Popen(sys.argv[2:],stdout=out,stderr=err)
  (O/(label+'.start.json')).write_text(json.dumps(dict(pid=p.pid,at=time.time())))
  r=p.wait()
 except Exception as e:
  err.write((repr(e)+'\n').encode());r=127
 (O/(label+'.exit.json')).write_text(json.dumps(dict(exit=r,at=time.time())))
sys.exit(r)
