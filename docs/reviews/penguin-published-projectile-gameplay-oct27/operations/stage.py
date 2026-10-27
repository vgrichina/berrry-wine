from common import *
m=json.loads((H/'manifest.json').read_text());allrows=[];pins=[]
for x in m:
 p=H/'inputrepo'/x['path'] if x['kind']=='git' else pathlib.Path(x['path'])
 b=p.read_bytes();assert len(b)==x['bytes'] and sha(b)==x['sha256'],x
 pins.append(dict(target=x['target'],source=str(p),bytes=len(b),sha256=sha(b),kind=x['kind'],donor=x.get('donor'),revision=x.get('revision')))
 for off in range(0,len(b),18000):allrows.append([x['target'],'wb' if off==0 else 'ab',base64.b64encode(b[off:off+18000]).decode()])
save('local-pins.json',pins)
start=json.loads((H/'stage-cursor.json').read_text())['next'] if (H/'stage-cursor.json').exists() else 0
t=time.monotonic();cursor=start;calls=0
while cursor<len(allrows) and time.monotonic()-t<75:
 rows=[];n=cursor
 while n<len(allrows) and len(rows)<40 and len(transfer_command(rows+[allrows[n]]).encode())<=36000:rows.append(allrows[n]);n+=1
 assert rows
 remote(transfer_command(rows));cursor=n;calls+=1;save('stage-cursor.json',dict(next=cursor,total=len(allrows),calls=calls,complete=cursor==len(allrows)))
print(json.dumps(dict(start=start,next=cursor,total=len(allrows),calls=calls,complete=cursor==len(allrows))))
