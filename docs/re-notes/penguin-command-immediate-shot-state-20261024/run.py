from work import *
from account import account
name=os.sys.argv[1];assert name in ['filter','cannon']
assert not (H/(name+'-launch-api.json')).exists()
account('before-'+name)
j=remote('python3 '+shlex.quote(R+'/supervise.py')+' '+name,100);save(name+'-launch-api.json',j)
seals=[]
for f in ['output.log','terminal.json','command.json']:seals.append(get(R+'/'+name+'/'+f,E/name/f))
save(name+'-collection-seals.json',seals)
print(j['stdout'])
log=(E/name/'output.log').read_text()
lines=log.splitlines()
for i,line in enumerate(lines):
 if any(s in line for s in ['TRACE-AT','input-dispatch','0x4130','0x410110','0x413e50','0x413f30']):
  print('\n'.join(lines[max(0,i-1):min(len(lines),i+7)]))
