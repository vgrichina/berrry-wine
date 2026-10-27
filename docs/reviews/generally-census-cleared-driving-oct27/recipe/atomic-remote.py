from common import *
p=H/'remote-v5.py';t=p.read_text().replace('def save(n,x):(H/n).write_text(json.dumps(x,indent=2))',"def save(n,x):\n p=H/n;q=p.with_suffix(p.suffix+'.tmp');q.write_text(json.dumps(x,indent=2));q.replace(p)")
p.write_text(t);q=json.loads((H/'build-continuation-plan.json').read_text());q['wrapperSHA256']=sha(t.encode());q['atomicControllerReceipts']=True;save('build-continuation-plan.json',q)
print('atomic controller replies prepared before guest')
