from control import *
assert sha(P/'backups/app.js')==OLD
assert sha(L/'app.js') in [OLD,APP], 'live app has another owner; stop rollback'
t=L/'.app.js.sidebar-private-rollback-oct26'
assert not t.exists()
shutil.copy2(P/'backups/app.js',t)
with t.open('rb') as f:os.fsync(f.fileno())
os.replace(t,L/'app.js')
fd=os.open(L,os.O_RDONLY);os.fsync(fd);os.close(fd)
assert sha(L/'app.js')==OLD
print('prior exact bytes restored atomically; no restart')
