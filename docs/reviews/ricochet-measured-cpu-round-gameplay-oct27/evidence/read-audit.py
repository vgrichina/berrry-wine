from work import read_executor
class Audit:
 def __init__(self,root):self.root=root;self.bytes=0
 def start(self,code,remaining):
  ident=str(time.time_ns());ledger=O/'api-ledger.json';v=json.loads(ledger.read_text());assert v['bytes']+v['pending']+8192+1048576<=v['cap'];v['pending']+=8192;save(ledger.name,v)
  (self.root/('read-'+ident+'-command.json')).write_text(json.dumps(dict(code=code,sha256=sha(code.encode()),remaining=remaining)))
  j=read_executor().start(code,remaining);outer=self
  class Job:
   done=False
   def keep(self):
    if self.done:return
    self.done=True;size=0
    for k,b in zip(['stdout','stderr'],j.buffers):(outer.root/('read-'+ident+'.'+k)).write_bytes(b);size+=len(b)
    v=json.loads(ledger.read_text());v['pending']-=8192;v['bytes']+=size;save(ledger.name,v);outer.bytes+=size;assert size<=8192 and v['bytes']<=v['cap']
   def poll(self):
    try:
     b=j.poll()
     if b is not None:self.keep()
     return b
    except BaseException:self.keep();raise
   def cancel(self):
    try:j.cancel()
    finally:self.keep()
  return Job()
