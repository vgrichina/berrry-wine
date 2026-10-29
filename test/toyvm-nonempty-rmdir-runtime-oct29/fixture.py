import os,stat,errno,json
D='/tmp/tvne/w/domain/D';E=D+'/E'
os.mkdir(D);os.mkdir(E)
before={x:os.stat(x).st_ino for x in (D,E)}
try:
 os.rmdir(D)
except OSError as error:
 assert error.errno==errno.ENOTEMPTY,(error.errno,str(error))
 observed_errno=error.errno
else:
 raise AssertionError('nonempty directory removed')
for x in (D,E):
 current=os.stat(x);assert stat.S_ISDIR(current.st_mode) and current.st_ino==before[x]
print(json.dumps(dict(checkpoint='nonempty-rmdir-preserved',errno=observed_errno,directoryInodes=before,childPreserved=True),sort_keys=True),flush=True)
