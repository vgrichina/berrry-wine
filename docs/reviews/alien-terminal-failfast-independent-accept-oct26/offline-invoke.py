from common import *
a=json.load(open(sys.argv[1]));supervised(a['cmd'],a['git'],a['label'],a['cwd'],a.get('inputPath'))
