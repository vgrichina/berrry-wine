import pathlib,subprocess,json,os,hashlib,base64,time
R=pathlib.Path('/home/user/shadow-man-dsetup-canonical-qualification-oct22');E=R/'evidence-region-fullmodule';os.chdir(R)
assert subprocess.check_output(['git','rev-parse','HEAD']).decode().strip()=='c2f50288da9e5a85995184c60bb2b94bdce35dd9'
assert not E.exists(); assert int(subprocess.check_output(['du','-s','-B1',str(R)]).split()[0])+335544320<1073741824
assert os.statvfs(R).f_bavail*os.statvfs(R).f_frsize>2147483648+335544320
E.mkdir()
env=dict(os.environ,GIT_NO_LAZY_FETCH='1')
for k in ['NODE_OPTIONS','NODE_PATH','WINE_REGION_MAP','WINE_REGION_SHAKE','WINE_WAT_NAMES','WINE_WAT_COMPILER']:env.pop(k,None)
def out(args):return subprocess.check_output(args,env=env)
before=out(['node','tools/region-layout.js','--json']);(E/'layout-before.json').write_bytes(before)
p=R/'src/00-regions.wat';old=p.read_text();(E/'declaration-before.wat').write_text(old)
assert old.count('(owner "09a1-comctl-handlers.wat:$handle_GetFileVersionInfoA")')==1
new=old.replace('  (region.declare $DX_VERSION_INFO (size 0x0000005C) (align 0x00000010)\n    (owner "09a1-comctl-handlers.wat:$handle_GetFileVersionInfoA"))','  ;; Obsolete synthetic DirectX version storage remains reserved so unrelated\n  ;; allocations do not move. The header retains its symbolic base/size globals;\n  ;; file version APIs read actual named-file resources instead of this block.\n  (region.declare $DX_VERSION_INFO (size 0x0000005C) (align 0x00000010)\n    (owner "01-header.wat:$DX_VERSION_INFO"))')
assert new!=old;p.write_text(new)
after=out(['node','tools/region-layout.js','--json']);(E/'layout-after.json').write_bytes(after)
b,a=json.loads(before),json.loads(after)
for rows in [b,a]:
 for row in rows:row.pop('owner',None)
assert b==a
(E/'layout-proof.json').write_text(json.dumps(dict(exactAllFieldsExceptOwnerEqual=True,regions=len(a),dx=[r for r in a if r['name'].lstrip('$')=='DX_VERSION_INFO'],beforeSHA256=hashlib.sha256(before).hexdigest(),afterSHA256=hashlib.sha256(after).hexdigest()),indent=2)+'\n')
controls=r'''const assert=require('assert');const {collectDeclarations,ownerVerdict}=require('./tools/check-region-decls');const d=collectDeclarations().find(d=>d.name==='DX_VERSION_INFO');assert.equal(ownerVerdict(d).state,'ok');const results=[];for(const owner of ['09a1-comctl-handlers.wat:$handle_GetFileVersionInfoA','01-header.wat:$no_such_DX_VERSION_INFO_owner','01-header.wat:$GUEST_BASE']) {const v=ownerVerdict({...d,owner});assert.equal(v.state,'stale');results.push({owner,verdict:v});}console.log(JSON.stringify(results,null,2));'''
(E/'owner-controls.js').write_text(controls)
(E/'owner-controls.log').write_bytes(out(['node','-e',controls]))
preload="const fs=require('fs');const old=fs.readFileSync;fs.readFileSync=function(p,...a){let x=old.call(this,p,...a);if(String(p).endsWith('/src/00-regions.wat')){const s=x.toString();const n=s.replace('(region.declare $DX_VERSION_INFO (size 0x0000005C)', '(region.declare $DX_VERSION_INFO (size 0x0000006C)');if(s===n)throw Error('mutation anchor absent');x=typeof x==='string'?n:Buffer.from(n);}return x;};\n"
(E/'layout-mutation-preload.js').write_text(preload)
r=subprocess.run(['node','-r',str(E/'layout-mutation-preload.js'),'tools/gen-region-map.js','--check'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,env=env)
(E/'layout-negative.log').write_bytes(r.stdout);assert r.returncode!=0 and b'stale' in r.stdout.lower()
# Run every noncompiling shipping gate from the exact script, retaining all outcomes.
# Wrappers aggregate failures and never alter build.sh or a checker. This is NOT a build attempt.
build=(R/'tools/build.sh').read_text();prefix=build.split('echo "Compiling (WATX)..."')[0]
# build.sh's cd is relative to its own pathname; run a separately located inventory with explicit cwd.
prefix=prefix.replace('cd "$(dirname "$0")/.."','cd '+str(R)).replace('set -e','set +e')
wrapper='''
node() {
  printf 'COMMAND node'; printf ' %q' "$@"; printf '\\n'
  command node "$@"
  code=$?
  printf 'GATE_EXIT %s\\n' "$code"
  return 0
}
bash() {
  printf 'COMMAND bash'; printf ' %q' "$@"; printf '\\n'
  command bash "$@"
  code=$?
  printf 'GATE_EXIT %s\\n' "$code"
  return 0
}
'''
script=prefix.replace('set +e','set +e\n'+wrapper,1)
(E/'cheap-gates.sh').write_text(script)
with (E/'cheap-gates.log').open('wb') as f:r=subprocess.run(['bash',str(E/'cheap-gates.sh')],stdout=f,stderr=subprocess.STDOUT,env=env,timeout=240)
text=(E/'cheap-gates.log').read_text();import re
results=[dict(command=m[0],exit=int(m[1])) for m in re.findall(r'COMMAND ([^\n]+)\n.*?GATE_EXIT (\d+)',text,re.S)]
assert len(results)>40,len(results)
(E/'cheap-gates.json').write_text(json.dumps(dict(results=results,failures=[r for r in results if r['exit']],scriptSHA256=hashlib.sha256(build.encode()).hexdigest(),canonicalAttempts=0),indent=2)+'\n')
print(json.dumps(dict(layout=json.loads((E/'layout-proof.json').read_text()),gateCount=len(results),failures=[r for r in results if r['exit']])))
