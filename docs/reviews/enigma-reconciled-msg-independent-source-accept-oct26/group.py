from common import *
D=pathlib.Path('/tmp/enigma-accepted-msg-current-tree-reconcile-oct26/repo')
name=sys.argv[1]
cmd=[NODE,'--max-old-space-size=64',str(O/(name+'.js')),str(O),str(D)]
print(pool(cmd,label=name).decode()[:8192])
j=json.load(open(O/'checkpoint.json'));j['completed'].append(name);j['remaining']=[n for n in j['remaining'] if n!=dict(**{'independent-runner':'independent reconciled runner challenges','independent-signatures':'independent final signature mapping'}).get(name,'')];save('checkpoint.json',j)
