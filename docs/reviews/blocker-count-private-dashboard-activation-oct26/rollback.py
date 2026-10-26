#!/usr/bin/env python3
import pathlib,os,shutil,hashlib
p=pathlib.Path('/tmp/blocker-count-private-dashboard-activation-oct26/backups')
d=pathlib.Path('/home/user/wine-dashboard-b0b9bc090/ops')
for n in ['app.js','blocker-model.js']:
 t=d/('.'+n+'.blocker-count-rollback-oct26')
 shutil.copy2(p/n,t)
 with t.open('rb') as f: os.fsync(f.fileno())
 os.replace(t,d/n)
fd=os.open(d,os.O_RDONLY);os.fsync(fd);os.close(fd)
