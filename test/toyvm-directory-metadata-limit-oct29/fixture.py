import os,json,stat
os.mkdir('/tmp/tvdm/w/domain/D')
fd=os.open('/tmp/tvdm/w/domain/D/A',os.O_CREAT|os.O_RDWR,0o600)
os.close(fd)
assert stat.S_ISDIR(os.stat('/tmp/tvdm/w/domain/D').st_mode)
assert stat.S_ISREG(os.stat('/tmp/tvdm/w/domain/D/A').st_mode) and os.stat('/tmp/tvdm/w/domain/D/A').st_size==0
print(json.dumps(dict(checkpoint='before-directory-metadata-over-budget',existingDirectory=True,existingEmptyFile=True,attemptedNewDirectory='D/E')),flush=True)
os.mkdir('/tmp/tvdm/w/domain/D/E')
