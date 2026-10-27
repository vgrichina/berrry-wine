from common import *
m=json.loads((H/'stage-manifest.json').read_text());cursor=json.loads((H/'stage-cursor.json').read_text()) if (H/'stage-cursor.json').exists() else dict(file=0,offset=0,complete=False,calls=0)
start=time.monotonic();calls=0
while cursor['file']<len(m) and time.monotonic()-start<25:
 rows=[];fi=cursor['file'];off=cursor['offset']
 while fi<len(m) and len(rows)<40:
  x=m[fi];p=pathlib.Path(x['path'])
  with p.open('rb') as f:f.seek(off);b=f.read(18000)
  row=[x['target'],'wb' if off==0 else 'ab',base64.b64encode(b).decode()]
  if len(transfer_command(rows+[row]).encode())>36000:break
  rows.append(row);off+=len(b)
  if off>=x['bytes']:fi+=1;off=0
 assert rows
 remote(transfer_command(rows));cursor=dict(file=fi,offset=off,complete=fi==len(m),calls=cursor['calls']+1);calls+=1;save('stage-cursor.json',cursor)
print(json.dumps(dict(**cursor,operationCalls=calls,apiUsed=used())))
