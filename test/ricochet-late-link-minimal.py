"""Expected nonzero: exact candidate incorrectly accepts a final-scan symlink.
Run: python3 -S test/ricochet-late-link-minimal.py
No guest/process/network execution; candidate remains read-only.
"""
import hashlib,importlib.util,os,pathlib,tempfile
from unittest.mock import patch
p=pathlib.Path('/tmp/ricochet-consumed-control-accounting-repair-oct27/repo/tools/ricochet/runtime-accounting.py')
assert hashlib.sha256(p.read_bytes()).hexdigest()=='857e30508c1e4db1c943b765a0e7551842973032cc5431eb08235dabda903364'
s=importlib.util.spec_from_file_location('candidate',p);a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
with tempfile.TemporaryDirectory() as d:
 h=pathlib.Path(d);serial=h/'serial';serial.mkdir();c=serial/'continue.json';c.write_text('{}');retained=h/'retained';retained.write_text('x')
 ledger=a.RuntimeAccounting([h],ephemeral_files={c:24*1048576},ceiling=256*1048576)
 real=os.scandir;hits=[]
 def scandir(fd):
  if isinstance(fd,int) and os.readlink('/proc/self/fd/'+str(fd))==str(serial):
   hits.append(1)
   if len(hits)==2:c.unlink();c.symlink_to(retained)
  return real(fd)
 accepted=None
 with patch.object(os,'scandir',scandir):
  try:accepted=ledger.sample()
  except (a.AccountingError,OSError):pass
 assert len(hits)==2
 print('symlink_at_return=',c.is_symlink(),'accepted_bytes=',None if accepted is None else accepted['bytes'])
 assert accepted is None,'REJECT: final-inventory symlink returned an accepted sample'
