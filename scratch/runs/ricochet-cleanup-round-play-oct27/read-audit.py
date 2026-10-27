# Adapter retains process-creation streams and hashes without modifying accepted transport.
import pathlib,json,time,hashlib
from work import read_executor
class Audit:
 def __init__(self,root):self.root=root;self.bytes=0
 def start(self,code,remaining):
  ident=str(time.time_ns());j=read_executor().start(code,remaining);outer=self
  (self.root/('read-'+ident+'-command.json')).write_text(json.dumps(dict(codeSHA256=hashlib.sha256(code.encode()).hexdigest(),code=code,remaining=remaining)))
  class Job:
   def keep(self):
    for k,b in zip(['stdout','stderr'],j.buffers):(outer.root/('read-'+ident+'.'+k)).write_bytes(b)
   def poll(self):
    try:
     b=j.poll()
     if b is not None:
      self.keep();outer.bytes+=len(b);assert outer.bytes<=2097152
     return b
    except BaseException:self.keep();raise
   def cancel(self):
    try:j.cancel()
    finally:self.keep()
  return Job()
