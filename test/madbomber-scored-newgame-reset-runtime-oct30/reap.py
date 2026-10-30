import pathlib,json
rows=[]
for f in pathlib.Path('/proc').glob('[0-9]*/stat'):
 try:
  v=f.read_text().rsplit(')',1)[1].split()
  if int(v[2])==8660: rows.append({'pid':int(f.parent.name),'state':v[0]})
 except (OSError,ValueError):pass
assert not rows,rows
r=pathlib.Path('/home/user/madbomber-runtime'); print(json.dumps({'guestPid':8660,'guestGroupRemaining':rows,'reaped':True,'supervisorStderr':(r/'reset-supervisor.stderr').read_text(),'commands':(r/'commands-reset.jsonl').read_text()}))
