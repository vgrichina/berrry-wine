from run import *
import runpy
os.environ['INDEPENDENT_EVIDENCE']=str(H/'cli')
sys.argv=[str(R/'test/test-airstrike-independent-cli-oct27.py')]
runpy.run_path(sys.argv[0],run_name='__main__')
