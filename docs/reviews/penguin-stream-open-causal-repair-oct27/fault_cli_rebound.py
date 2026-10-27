"""Fault at an I/O boundary, then execute the exact pinned production CLI."""
import pathlib,sys,hashlib,runpy,os
from unittest import mock
SOURCE=pathlib.Path('/tmp/penguin-stream-open-causal-repair-oct27/repo/tools/penguin_capture_contract.py')
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()=='9ec154496d10053252701d786f26e821fc226db3bdcb0e948f45e68ab0045cb0'
fault=sys.argv.pop(1);sys.argv[0]=str(SOURCE)
original_open=pathlib.Path.open
def opened(path,*args,**kwargs):
 if path.name=='startup.stdout' and args and args[0]=='wb':
  raise PermissionError(13,'INDEPENDENT_STDOUT_OPEN_EACCES',str(path))
 return original_open(path,*args,**kwargs)
patch=mock.patch.object(pathlib.Path,'open',opened) if fault=='open' else mock.patch.object(os,'pipe',side_effect=OSError('INDEPENDENT_PIPE_SETUP_FAILURE'))
with patch:
 runpy.run_path(str(SOURCE),run_name='__main__')
