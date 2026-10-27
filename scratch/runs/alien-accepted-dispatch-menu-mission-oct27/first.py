from drive import *
from control import admission
assert json.loads((O/'checkpoint.json').read_text())['guestInvocations']==0
admission();save('checkpoint.json',dict(phase='launch intent persisted',guestInvocations=1,accepted='a9d65e0459445616d16b7a85fd99c1c93ec992ac',reuse='all accepted source groups',next='ONE guest no uncertain launch replay'))
save('guest-detach.json',remote('python3 '+shlex.quote(R+'/supervisor.py')+' guest',detach=True))
j=py('''import socket,time,pathlib,json
h=pathlib.Path('''+repr(R)+''');deadline=time.monotonic()+10
while True:
 assert not (h/'guest/terminal.json').exists(),'guest ended before control ready'
 try:
  s=socket.create_connection(('127.0.0.1',18129),timeout=.2);s.close();break
 except OSError:
  assert time.monotonic()<deadline,'control listener unavailable';time.sleep(.05)
print(json.dumps(dict(listening=True,at=time.time())))
''',timeout=15);save('initial-listening.json',j)
phase('configuration',steps(50)+[frame('configuration')]);fetch('configuration')
