import pathlib,subprocess,sys,json,time
o=pathlib.Path('/tmp/enigma-full-frame-admitted-runtime-oct27/ops');label=sys.argv[1]
with (o/(label+'.child.stdout')).open('xb') as out,(o/(label+'.child.stderr')).open('xb') as err:
 p=subprocess.Popen(sys.argv[2:],stdout=out,stderr=err)
 (o/(label+'.child.start.json')).write_text(json.dumps(dict(pid=p.pid,at=time.time(),state='pending')))
 r=p.wait()
 (o/(label+'.child.exit.json')).write_text(json.dumps(dict(exit=r,at=time.time())))
sys.exit(r)
