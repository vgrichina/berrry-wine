import os,stat,errno,json
D='/tmp/tvrn/w/domain/D';S=D+'/S';T=D+'/T';E=T+'/E'
for x in (D,S,T,E):os.mkdir(x)
before={x:os.stat(x).st_ino for x in (D,S,T,E)}
try:
 os.rename(S,T)
except OSError as error:
 assert error.errno==errno.ENOTEMPTY,(error.errno,str(error))
 observed_errno=error.errno
else:
 raise AssertionError('nonempty destination replaced')
for x in (D,S,T,E):
 current=os.stat(x);assert stat.S_ISDIR(current.st_mode) and current.st_ino==before[x]
print(json.dumps(dict(checkpoint='rename-nonempty-preserved',errno=observed_errno,directoryInodes=before,nodesPreserved=True),sort_keys=True),flush=True)
