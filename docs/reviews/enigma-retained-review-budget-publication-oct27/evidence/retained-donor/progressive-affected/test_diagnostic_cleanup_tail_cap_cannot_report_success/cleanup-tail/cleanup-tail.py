
import os,runpy,signal,sys
def tail(*args):
 os.write(2,b'CLEANUP-STDERR\n'+b'E'*4096)
 raise SystemExit(0)
signal.signal(signal.SIGTERM,tail)
sys.argv=sys.argv[1:]
runpy.run_path(sys.argv[0],run_name='__main__')
