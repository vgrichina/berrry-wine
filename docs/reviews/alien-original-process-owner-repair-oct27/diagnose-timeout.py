import sys,subprocess,importlib.util,json
from pathlib import Path
sys.dont_write_bytecode=True
O=Path(__file__).parent
F=Path('/tmp/alien-menu-action-budget-controller-repair-oct27/repo/test/fixtures/alien-menu-controller/test_controller.py')
sys.argv=[str(F),str(O/'diagnose-cleanup'),'Case.test_cleanup_reserved_with_last_three_capture_credits']
s=importlib.util.spec_from_file_location('fixture',F);f=importlib.util.module_from_spec(s);s.loader.exec_module(f)
original=subprocess.run
seq=0
def traced(argv,**kw):
 global seq
 if str(f.CLI) in argv:
  seq+=1
  argv=['strace','-f','-tt','-T','-o',str(O/('timeout-strace-%d.log'%seq)),*argv]
 return original(argv,**kw)
subprocess.run=traced
f.OUT.mkdir()
f.unittest.main(module=f,verbosity=2)
