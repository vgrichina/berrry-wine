from work import *
assert json.load(open(H/'remote-rehash.json'))['exitCode']==0
contract=pathlib.Path('/tmp/penguin-scheduled-gameplay-oct24/repo/docs/re-notes/penguin-command-scheduled-input-gameplay-20261024/accepted-contract.json')
send(contract.read_bytes(),'accepted-contract.json')
s=(OLD/'preflight.py').read_text().replace(str(OLD),R)
(H/'preflight.py').write_text(s);send(s.encode(),'preflight.py')
save('preflight-api.json',remote('python3 '+shlex.quote(R+'/preflight.py'),60))
get(R+'/preflight.json',E/'preflight.json')
# Prior exact-input host ABI receipt is reused, not promoted to a current-main module.
for f in ['actual-host-instantiation-api.json','preflight-api.json']:
 save('reused-'+f,json.load(open(OLD/f)))
s=(OLD/'supervise.py').read_text().replace("name=sys.argv[1];assert name in ['control','treatment']", "assert time.time()<1792821330, 'latest start05:55:30UTC'\nname=sys.argv[1];assert name in ['filter','cannon']").replace('maxBatches=200000','maxBatches=43000').replace('bx_fkg5uw8h',BOX).replace('shutdown05:15UTC','shutdown06:00UTC').replace('2026-10-24T05:24:53.790Z','2026-10-24T06:12:03.889Z')
(H/'supervise.py').write_text(s);send(s.encode(),'supervise.py')
args=json.load(open('/tmp/penguin-postrelease-matched-firing-oct24/treatment-args.json'))
args=[x.replace(str(OLD),R) for x in args if not x.startswith('--input=')]
inputs=['33000:mousemove:420:360','34000:mousedown:420:360','34500:mouseup:420:360','34800:mousemove:260:220','39999:png:'+R+'/filter/b39999.png','40000:keydown:65','40200:keyup:65']
args+=['--input='+','.join(inputs),'--trace-at=0x4031a1','--trace-at-start-batch=39999','--trace-at-limit=1','--trace-at-mem=ebx:20','--trace-at-dump=0x4130a0:8,0x410110:12,0x413e50:4,0x413f30:4']
assert len([x for x in args if x.startswith('--trace-at=')])==1 and ',' not in next(x for x in args if x.startswith('--trace-at='))
save('filter-args.json',args);send((H/'filter-args.json').read_bytes(),'filter-args.json')
save('trace-recipe-validation.json',dict(runnerSHA='3c59fd034391e069f24a6047cf96cd8dac84a791d7d7591d55e5f7cb6e161a5e',singleAddressPreservesBatchSize=True,delayedArmBatch=39999,limit=1,eventBytes=20,dumpLengths=[8,12,4,4],screen='baseline only; immediate breakpoint screenshot unsupported by trace flags',unchangedMenuAimAndKeyInputs=True,hostABIReuse='exact 291-file closure and immutable historical module; prior production host instantiation receipt',passAll=True))
print('new transfer full291 hashes, codec/fonts and exact-input contract PASS; filter recipe ready')
