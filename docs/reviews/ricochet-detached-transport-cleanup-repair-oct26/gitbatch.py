import sys,json
from manage import run
for step in json.load(open(sys.argv[1])):
 run(step['label'],['git','-c','pack.threads=1','-c','pack.window=0','-c','pack.windowMemory=16m','-c','core.preloadIndex=false','-c','index.threads=1',*step['args']],git=True)
