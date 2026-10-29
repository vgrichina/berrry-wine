import os,stat,json
D='/tmp/tvrs/w/domain/D';E=D+'/E'
os.mkdir(D);os.mkdir(E)
before={x:os.stat(x).st_ino for x in (D,E)}
os.rename(E,E)
for x in (D,E):
 current=os.stat(x);assert stat.S_ISDIR(current.st_mode) and current.st_ino==before[x]
print(json.dumps(dict(checkpoint='rename-samepath-preserved',directoryInodes=before,nodesPreserved=True),sort_keys=True),flush=True)
