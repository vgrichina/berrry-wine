import pathlib,sys,os,json,subprocess,time,resource,hashlib
H=pathlib.Path(__file__).parent;mode=sys.argv[1];E=H/mode;argv=json.loads((H/(mode+'-args.json')).read_text())
j=dict(argv=argv,cwd='/tmp/ricochet-cleanup-round-play-oct27/runner',at=time.time(),environment=dict(os.environ),limits={str(k):resource.getrlimit(k) for k in [resource.RLIMIT_AS,resource.RLIMIT_DATA,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE]},state='spawning')
(E/'command.json').write_text(json.dumps(j,indent=2))
with (E/'node.stdout').open('wb') as out,(E/'node.stderr').open('wb') as err:
 try:
  if mode=='guest':
   ctl=subprocess.Popen([sys.executable,'-S',str(H/'serial.py')],stdout=open(E/'controller.stdout','wb'),stderr=open(E/'controller.stderr','wb'))
  p=subprocess.Popen(argv,cwd=pathlib.Path('/tmp/ricochet-cleanup-round-play-oct27/runner'),stdout=out,stderr=err);j.update(pid=p.pid,state='started');(E/'command.json').write_text(json.dumps(j,indent=2));rc=p.wait();j.update(returncode=rc,state='terminal',end=time.time());(E/'terminal.json').write_text(json.dumps(j,indent=2));
  if mode=='guest':ctl.wait(timeout=2)
  sys.exit(rc)
 except BaseException as e:
  j.update(exception=repr(e),at=time.time());(E/'spawn-or-wait-exception.json').write_text(json.dumps(j,indent=2));raise
