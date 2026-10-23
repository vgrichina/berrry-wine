"""Assigned-box API only. Credentials/signed URLs stay in local memory.

No redirects, lifecycle operations, retries, remote credentials or archive staging.
"""
import hashlib, json, pathlib, shlex, subprocess, urllib.request, urllib.error
E=pathlib.Path(__file__).resolve().parent
BOX='bx_vufrds5w'
ROOT='/home/user/shadow-man-launcher-configuration-capture-oct23'
SNAP='3ac9827f-20cf-4e1c-98a8-40b4edcd1b2f'
PREFIX='shadow-man-install-continue-oct22/retained-session'
DONOR=pathlib.Path('/home/user/wine-assembly-shadow-man-snapshot-recovery-feasibility-oct22/scratch/runs/20261022-shadow-man-snapshot-recovery-feasibility')
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args):return None
OPENER=urllib.request.build_opener(NoRedirect)
def save(n,v): (E/n).write_text(json.dumps(v,indent=2)+'\n')
def api(path,data=None,method=None):
 c=json.loads(pathlib.Path('/home/user/.config/ascii/boat/config.json').read_text());assert c['api_url'].rstrip('/')=='https://boat.dev'
 req=urllib.request.Request('https://boat.dev/api/v1/'+path,data=None if data is None else json.dumps(data).encode(),headers={'Authorization':'Bearer '+c['token'],'Content-Type':'application/json'},method=method)
 try:
  with OPENER.open(req,timeout=60) as f:
   b=f.read(1048577);assert len(b)<=1048576;return json.loads(b)
 except urllib.error.HTTPError as e:
  # Do not expose an exception URL or arbitrary response fields.
  b=e.read(65536)
  try:j=json.loads(b);code=j.get('code')
  except Exception:code=None
  save('first-api-error.json',dict(path=path.split('?')[0],status=e.code,code=code));raise RuntimeError('API HTTP '+str(e.code)+' '+str(code)) from None
def run(code,name,timeout=30):
 r=api('sandboxes/'+BOX+'/commands',dict(command='python3 -c '+shlex.quote(code),timeoutSeconds=timeout))
 save(name,r);assert r.get('exitCode')==0, 'Assigned APIexec failed: '+name
 return r
def upload_stream(stream,size,target):
 """Known-size sequential raw PUT, each application buffer at most64KiB."""
 assert target.startswith((ROOT+'/immutable/',ROOT+'/fixed/')) and '..' not in pathlib.PurePosixPath(target).parts
 u=api('sandboxes/'+BOX+'/files/upload-url',dict(path=target,ttlSeconds=900));assert u['method']=='PUT' and u['path']==target
 h=hashlib.sha256();count=0
 def blocks():
  nonlocal count
  while count<size:
   b=stream.read(min(65536,size-count));assert b,'source underflow';assert len(b)<=65536
   count+=len(b);h.update(b);yield b
 req=urllib.request.Request(u['url'],data=blocks(),headers={'Content-Length':str(size),'Content-Type':'application/octet-stream'},method='PUT')
 try:
  with OPENER.open(req,timeout=120) as f:
   assert f.status==200;reply=f.read(65537);assert len(reply)<=65536
 except urllib.error.HTTPError as e:
  save('first-upload-error.json',dict(status=e.code,target=target));raise RuntimeError('Destination upload HTTP '+str(e.code)) from None
 except Exception as e:
  save('first-upload-error.json',dict(errorType=type(e).__name__,target=target));raise RuntimeError('Destination upload '+type(e).__name__) from None
 assert count==size
 return dict(path=target,bytes=count,sha256=h.hexdigest())
def source_file(path,size):
 import urllib.parse
 c=json.loads(pathlib.Path('/home/user/.config/ascii/boat/config.json').read_text())
 req=urllib.request.Request('https://boat.dev/api/v1/snapshots/'+SNAP+'/files?'+urllib.parse.urlencode(dict(path=path)),headers={'Authorization':'Bearer '+c['token'],'Range':f'bytes=0-{size-1}'})
 try:f=OPENER.open(req,timeout=60)
 except urllib.error.HTTPError as e:raise RuntimeError('Snapshot file HTTP '+str(e.code)) from None
 assert f.status==206 and f.headers.get('Content-Range')==f'bytes 0-{size-1}/{size}'
 assert f.headers.get('X-Snapshot-Entry-Kind')=='file'
 return f
