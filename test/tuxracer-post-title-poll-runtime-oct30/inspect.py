import control as c,json,pathlib,hashlib
B='/home/user/.ascii/boat'
def call(n,*args):
 b=c.run(n,[B,'--no-update','--json',*args],cwd=c.O,wall=60)
 return json.loads(b)
if __name__=='__main__':
 c.admission()
 v=call('snapshot-tree','snapshot','tree','bx_jdx249hm')
 c.save('snapshot-tree.json',v)
 print(json.dumps(v)[:2000])
