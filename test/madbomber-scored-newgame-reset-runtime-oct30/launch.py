import subprocess,pathlib,json
r=pathlib.Path('/home/user/madbomber-runtime')
p=subprocess.Popen(['/usr/bin/python3','-B',str(r/'reset-runtime.py')],stdin=subprocess.DEVNULL,stdout=(r/'reset-supervisor.stdout').open('wb'),stderr=(r/'reset-supervisor.stderr').open('wb'),start_new_session=True)
print(json.dumps({'supervisorPid':p.pid}))
