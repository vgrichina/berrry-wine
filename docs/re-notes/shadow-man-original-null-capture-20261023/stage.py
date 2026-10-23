"""Exact candidate source plus standing accepted inputs; no archive or compiler."""
import json,pathlib,hashlib
from transport import *
def main():
 rows=[]
 for x in json.loads((E/'candidate-runtime-manifest.json').read_text()):
  rows.append(dict(x,source=str(E.parents[2]/'runtime'/x['path'])))
 rows+=json.loads((E/'standing-inputs.json').read_text())
 staged=[]
 for x in rows:
  p=pathlib.Path(x['source']);size=p.stat().st_size
  assert size==x['bytes'] and size<=25165824
  with p.open('rb') as f:assert hashlib.file_digest(f,'sha256').hexdigest()==x['sha256']
  with p.open('rb') as f:r=upload_stream(f,size,ROOT+'/immutable/runtime/'+x['path'])
  assert r['sha256']==x['sha256'];staged.append(r)
  save('staging-progress.json',staged)
 for n in ['transfer-files.jsonl','accepted-installed-payload.json','accepted-parent-registry.json']:
  p=E/n
  with p.open('rb') as f:upload_stream(f,p.stat().st_size,ROOT+'/immutable/receipts/'+n)
 save('staging-complete.json',dict(files=len(staged),bytes=sum(x['bytes'] for x in staged),filesManifest=staged))
if __name__=='__main__':main()
