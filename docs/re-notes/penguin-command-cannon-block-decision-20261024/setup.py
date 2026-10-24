import pathlib,subprocess,json,os,hashlib,shutil,time,shlex
H=pathlib.Path(__file__).parent
OLD=pathlib.Path('/tmp/penguin-immediate-shot-state-oct24')
D=pathlib.Path('/tmp/input-consumption-clock-independent-closeout-oct24/repo')
REV='5691793a58b4670fd2a621114d7926100a1e47de'
HIST='b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a'
BRANCH='task/penguin-cannon-block-decision-oct24'
E=H/'repo/docs/re-notes/penguin-command-cannon-block-decision-20261024'
def save(n,j):
 p=H/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(j,indent=2)+'\n')
def sha(b):return hashlib.sha256(b).hexdigest()
def git(*a):return subprocess.check_output(['git','-C',str(H/'repo'),*a],stderr=subprocess.DEVNULL).decode().strip()
def blob(rev,p):return subprocess.check_output(['git','-C',str(D),'show',rev+':'+p],stderr=subprocess.DEVNULL)
def remote(cmd,timeout=30):
 assert len(cmd.encode())<=36000
 p=subprocess.run(['/home/user/.ascii/boat','--no-update','--json','exec','--timeout',str(timeout),'bx_rcsfy9bm',cmd],capture_output=True,text=True,timeout=timeout+15)
 j=json.loads(p.stdout)
 with (H/'api-history.jsonl').open('a') as f:f.write(json.dumps(dict(at=time.time(),requestBytes=len(cmd.encode()),responseBytes=len(p.stdout.encode())+len(p.stderr.encode()),commandSHA256=sha(cmd.encode())))+'\n')
 if p.returncode or j.get('exitCode')!=0 or j.get('stdoutTruncated') or j.get('stderrTruncated'):
  save('first-rejection.json',j);raise RuntimeError(str(j)[:1800])
 return j
def py(code,timeout=30):return remote('python3 -c '+shlex.quote(code),timeout)
if __name__=='__main__':
 repo=H/'repo';subprocess.run(['git','init','-q',str(repo)],check=True)
 objects=[];queue=[D/'.git/objects']
 while queue:
  o=queue.pop().resolve()
  if str(o) in objects:continue
  objects.append(str(o));a=o/'info/alternates'
  if a.exists():queue.extend((o/x).resolve() if not x.startswith('/') else pathlib.Path(x) for x in a.read_text().splitlines())
 (repo/'.git/objects/info/alternates').write_text('\n'.join(objects)+'\n')
 git('config','core.sparseCheckout','true');(repo/'.git/info/sparse-checkout').write_text('/docs/re-notes/penguin-command-cannon-block-decision-20261024.md\n/docs/re-notes/penguin-command-cannon-block-decision-20261024/\n')
 git('update-ref','refs/heads/'+BRANCH,REV);git('symbolic-ref','HEAD','refs/heads/'+BRANCH);git('read-tree','-mu','HEAD');git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git');E.mkdir(parents=True)
 receipts=[]
 for rev in [REV,HIST]:
  manifest=blob(rev,'src/main.watx');(E/(rev[:8]+'-manifest.txt')).write_bytes(manifest)
  assert b'13-exports.wat' in manifest and b'04-cache.wat' in manifest
  for path,groups in [('test/run.js',[(338,347),(1589,1601),(1613,1633),(3902,3925),(10292,10296)] if rev==REV else []),('src/13-exports.wat',[])]:
   b=blob(rev,path);lines=b.decode().splitlines()
   if not groups:
    needles=[';; --trace-eip-range: emit','(func (export "set_trace_eip_range")','(global.set $dbg_chain_guard','(global.set $dbg_tier_guard'] if path.startswith('src/') else ['if (traceEipOn) {']
    groups=[(i+1,min(len(lines),i+12)) for i,l in enumerate(lines) if any(n in l for n in needles)]
   for a,z in groups:
    s=('\n'.join(lines[a-1:z])+'\n').encode();assert len(s)<=8192
    name=f'{rev[:8]}-{path.replace("/","_")}-{a}-{z}.txt';(E/name).write_bytes(s)
    receipts.append(dict(revision=rev,path=path,blob=subprocess.check_output(['git','-C',str(D),'rev-parse',rev+':'+path],stderr=subprocess.DEVNULL).decode().strip(),fileSHA256=sha(b),first=a,last=z,bytes=len(s),sha256=sha(s)))
 contract=pathlib.Path('/tmp/penguin-scheduled-gameplay-oct24/repo/docs/re-notes/penguin-command-scheduled-input-gameplay-20261024/accepted-contract.json');c=json.loads(contract.read_text())
 names=['set_trace_eip_range','get_eax','get_ecx','get_edx','get_ebx','get_esp','get_ebp','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift']
 ex=[x for x in c['exports'] if x['name'] in names];assert len(ex)==len(names)
 assert any(x.get('name')=='log_eip' for x in c['imports'])
 save('static-checkpoint.json',dict(slices=receipts,acceptedContractSHA256=sha(contract.read_bytes()),module=c['module'],exports=ex,imports=[x for x in c['imports'] if x.get('name')=='log_eip'],syntax='--trace-eip-range=0x406d80-0x406f50',fromBatch=39999,detail=True,stream=True,dumpLengths=[8,12,4,4,32],blockEntry=True,boundedness='range + finite 43000 batches/60 seconds + existing supervisor 90 CPU/wall and output guard524288; no buffered trace',passStatic=True))
 print('private sparse repo and exact-source/export checkpoint PASS')
