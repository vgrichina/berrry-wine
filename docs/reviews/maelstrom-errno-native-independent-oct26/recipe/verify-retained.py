import pathlib,json,hashlib,importlib.util
O=pathlib.Path('/home/user/maelstrom-errno-api-canonical-native-oct25/ops');W=pathlib.Path('/home/user/maelstrom-errno-native-independent-oct26-v2/ops')
spec=importlib.util.spec_from_file_location('abi',O/'static-abi.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
oracle=json.load(open(O/'static-oracle.json'));assert hashlib.sha256((O/'static-abi.py').read_bytes()).hexdigest()==oracle['helperSHA256']
expected=oracle['exports'].copy()
for prefix,fields in [('msc','started phase token entries parks completions fault capped active api thunk thread regs pre ret post result'),('mne','status event token thread regs pre post selectRet parks result nativeEntry callBlock sourceBlock pc esp eax ebp errno caller socketSet timeout')]:
 for n in fields.split():expected[prefix+'_'+n]=dict(params=[],results=['i32'])
 expected[prefix+'_start']=dict(params=[],results=[])
rows=[]
for name,sha in [('errno-latch.wasm','a77709fb784a21e6775771450f54b709373f0cc8ad2d4878012c949eaae88f69'),('errno-latch.compat.wasm','365db557acdb39180d77acc61c8207e0b89d577c3071ba3e492e63c17900c7d8')]:
 p=O/name;j=a.parse(p);assert j['sha256']==sha;a.compare(j,oracle['imports'],expected,oracle['computedLayout']);assert j['noStart'];assert len(j['imports'])==291
 rows.append(dict(path=str(p),sha256=sha,bytes=p.stat().st_size,imports=len(j['imports']),functionExports=len(expected),noStart=j['noStart'],layout=oracle['computedLayout']))
out=dict(status='PASS',outputs=rows,oracleSHA256=hashlib.sha256((O/'static-oracle.json').read_bytes()).hexdigest(),helperSHA256=oracle['helperSHA256'],inventoryEntries=len(oracle['inventory']),derivedInventoryReused=True,scope='Actual retained binary hashes/import+export type signatures/layout custom payload independently compared to accepted source ABI oracle. Exact source-derived layout inventory acceptance reused, no build.')
(W/'retained-identity.json').write_text(json.dumps(out,indent=2));print(json.dumps(out))
