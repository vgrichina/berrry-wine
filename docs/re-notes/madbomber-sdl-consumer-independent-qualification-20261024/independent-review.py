import pathlib, json, hashlib, struct, subprocess
P=pathlib.Path(__file__).parent
D=pathlib.Path('/tmp/madbomber-authentic-sdl-error-consumer-oct24/repo')
E=D/'docs/re-notes/madbomber-authentic-sdl-error-consumer-20261024'
R=P/'runtime'
REV='ce17debea05b1e40c2359a25cf1d3d2c41266649'
SOURCE='b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a'
sha=lambda b:hashlib.sha256(b).hexdigest()
log=(P/'git-stderr.log').open('ab')
def git(*args): return subprocess.check_output(['git','-C',str(D),*args],stderr=log)
assert git('rev-parse','HEAD').decode().strip()==REV
seals=json.loads((E/'seals.json').read_text())['files']
for row in seals:
 b=(E/row['path']).read_bytes()
 assert len(b)==row['bytes'] and sha(b)==row['sha256'],row['path']
 assert b==git('show',REV+':docs/re-notes/madbomber-authentic-sdl-error-consumer-20261024/'+row['path'])
binding=(R/'source-binding.json').read_bytes()
assert sha(binding)=='c8c7f3e6a80aaa41255c6a4e952dc442b795d5f6b8caac109791d0f603b910a0'
for row in json.loads(binding)['closure']:
 b=(R/'inputs'/row['path']).read_bytes()
 assert len(b)==row['bytes'] and sha(b)==row['sha256']
 assert b==git('show',SOURCE+':'+row['path'])
for name,spec in [('supervise.py','docs/re-notes/madbomber-authentic-sdl-error-consumer-20261024/supervise.py')]:
 assert (R/name).read_bytes()==git('show',REV+':'+spec)
original=pathlib.Path('/home/user/wine-assembly/scratch/runs/20261018-madbomber-source/original/madbomber-0.2.5/SDL.dll').read_bytes()
assert len(original)==86016 and sha(original)=='55eced17cf8a9b7acc671cc307503de847a3c36fdafafe14cee7917433cfe410'
wasm=pathlib.Path('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/build/wine-assembly.wasm').read_bytes()
assert len(wasm)==1879746 and sha(wasm)=='8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686'
m=pathlib.Path('/tmp/madbomber-authentic-sdl-error-consumer-oct24/sdl-mapped.bin').read_bytes()
meta=json.loads((E/'consumer-static.json').read_text())
assert len(m)==237568 and sha(m)==meta['mappedSHA256']
assert m[0xcff0:0xd04b].hex()==meta['bytes']
assert m[0xd2c5:0xd2d3].hex()=='50b8a8875200e820fdffff83c404'
assert 0xd2d0+struct.unpack_from('<i',m,0xd2cc)[0]==0xcff0
assert m[0xd2bb:0xd2c5].hex()=='ff15386252003bc37418' # waveOutOpen, compare success, skip error
assert struct.unpack_from('<I',m,0xd2bd)[0]==meta['base']+0x23238
assert m[0x257a8:0x257a8+len(b'waveOutOpen()\0')]==b'waveOutOpen()\0'
assert m[0x25758:0x2575b]==b'%s\0' and m[0x2575c:0x25761]==b'%s: \0'
p=meta['winmmImportRecordRVA']
assert struct.unpack_from('<II',m,p)==(0xd2,0x22210)
p+=8;names=[]
while m[p]:
 assert m[p]==1
 end=m.index(0,p+1);names.append(m[p+1:end].decode());p=end+1
assert names.index('waveOutOpen')==10
assert names.index('waveOutGetErrorTextA')==15
assert 0x1000+0x22210+4*15==0x2324c
assert struct.unpack_from('<I',m,0xd031)[0]==meta['base']+0x2324c
assert m[0xcff0:0xcff6]==bytes.fromhex('81ec00010000') and m[0xd044:0xd04b]==bytes.fromhex('81c408010000c3')
source=git('show',SOURCE+':src/13-exports.wat')
assert sha(source)=='739397dc54a77e93b367334fd4ca96c921180f57a7558913a3301f1de4520b86'
fixture=(R/'test-madbomber-sdl-error-consumer-candidate.js').read_bytes()
originalFixture=git('show',REV+':test/test-madbomber-sdl-error-consumer-candidate.js')
old=b"  assert.equal(dv.getUint32(wa(base + 0x2324c), true), wave, 'authentic resolved consumer IAT');"
new=b"""  // Packed SDL and this lookup receive distinct records for the same API.
  // Compare both names and pinned dispatch IDs, never pointer equality.
  const { describeSystemThunk } = require('./system-thunk-identity');
  const consumerWave = dv.getUint32(wa(base + 0x2324c), true);
  const thunkIdentity = [consumerWave, wave].map(address => describeSystemThunk(e,
    memory.buffer, address, 'waveOutGetErrorTextA', 4590));"""
assert fixture==originalFixture.replace(old,new).replace(b"waveIATRVA: '2324c', calls, results",b"waveIATRVA: '2324c', thunkIdentity, calls, results"), 'only allowed fixture identity repair; output oracle byte-exact preserved'
assert b"original SDL consumer output oracle" in fixture
assert b"expected.replace('supported.', 'SUPPORTED.')" in fixture
checks={
 'consumer':'91 original bytes; four relocation operands only; EAX label, stack MMRESULT, RET; caller ADD ESP,4',
 'imports':'recovered UPX metadata: waveOutOpen index10 at23238, waveOutGetErrorTextA index15 at2324c; repaired fixture checks both thunk records named waveOutGetErrorTextA and pinned API ID4590',
 'VM':'historical call_func pushes four args plus zero sentinel; set_eax occurs after setup; stdcall entry+4*(argc+1), internal plain RET entry+4',
 'buffer':'256 native locals at entry-256; prefill A5, exact local string/NUL, all trailing bytes A5; caller MMRESULT and zero return slot unchanged',
 'output':'native SDL_SetError cdecl then original exported SDL_GetError; exact two labels/code32 text; bounded1024 read; EIP0/yield0/ESP asserted',
 'negative':'unchanged --reject-output alters expected capitalization only, must fail specifically original SDL consumer output oracle',
 'scope':'internal native consumer with emulated historical CRT imports; no public SDL failure/real waveOutOpen failure/gameplay/current-main build claim',
 'mount':'no CLI mounts; exact fs inputs and guest module path enumerated by unchanged input-map.json; canonical mount argv parser inapplicable',
}
report={'verdict':'STATIC ACCEPT: eligible for conditional capacity admission, no native acceptance yet','inputCommit':REV,'source':SOURCE,'producerEvidenceSealsVerified':len(seals),'historicalClosureFiles':len(json.loads(binding)['closure']),'fixtureSHA256':sha(fixture),'supervisorSHA256':sha((R/'supervise.py').read_bytes()),'mappedEvidenceOnlySHA256':sha(m),'originalSDL':sha(original),'normalModule':sha(wasm),'callFuncSourceSHA256':sha(source),'importNames':names,'checks':checks,'reusedControls':['static-tests.json','reject-source.json','reject-module.json','reject-changed-source.json','identity.json','syntax.json'],'priorDenial':json.loads((E/'identify-denial.json').read_text())}
api=git('show',SOURCE+':src/api_table.json');assert json.loads(api)[4590]['name']=='waveOutGetErrorTextA'
report['apiTableSHA256']=sha(api)
handler=git('show',SOURCE+':src/09a0-handlers-base.wat')
report['GetProcAddressSourceSHA256']=sha(handler)
report['repair']='First baseline exit1: different same-API thunk pointers. Historical GetProcAddress reserves a new record per lookup. Replaced pointer equality with bounded/aligned name+ID identity, preserving every consumer/local/output/stack assertion and reject-output oracle.'
report['originalFixtureSHA256']=sha(originalFixture)
(P/'review.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'verdict':report['verdict'],'seals':len(seals),'closure':report['historicalClosureFiles']}))
