from run import *
m=json.loads((H/'stage-manifest.json').read_text());c=json.loads((H/'stage-cursor.json').read_text());x=m[c['file']];remaining=sum(r['bytes'] for r in m[c['file']:])-c['offset']
print(json.dumps(dict(cursor=c,current=x,remainingBytes=remaining,totalFiles=len(m),localActual=size(R)+size(H),gameFiles=[r['target'] for r in m if r['kind']=='game' and ',' in r['target']])))
