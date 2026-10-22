from pathlib import Path
import subprocess, json, hashlib, os, time
E=Path('/home/user/aoe3-canonical-c7fae5ac-evidence')
S=Path('/home/user/aoe3-canonical-c7fae5ac-staged')
def run(args, name, **kw):
    with (E/name).open('wb') as out:
        p=subprocess.run(args,stdout=out,stderr=subprocess.STDOUT,**kw)
    assert p.returncode==0,(name,p.returncode)
def pins(name):
    o=Path('/home/user/aoe3-original-oct22')
    groups=[(o/'runtime',json.loads((o/'runtime-pins.json').read_text())),(o/'installed',json.loads((o/'installed-audit/installed-manifest.json').read_text())['files'])]
    assert [len(r) for _,r in groups]==[199,174]
    for base,rows in groups:
        for r in rows:
            p=base/r['path'];assert p.stat().st_size==r['size'] and hashlib.sha256(p.read_bytes()).hexdigest()==r['sha256'],str(p)
    (E/name).write_text('PASS 373 immutable original runtime/installed pins\n')
pins('original-pins-before.log')
assert hashlib.sha256((E/'build-inputs.json').read_bytes()).hexdigest()=='024af340bbe84e09b307c875c52c46c77d26906b0be8310ac041c0b7d5f256fb'
m=json.loads((E/'build-inputs.json').read_text())
patterns='\n'.join('/'+''.join('\\'+c if c in '\\*?[]' else c for c in r['path']) for r in m['inputs'])+'\n'
run(['git','-C',str(S),'sparse-checkout','init','--no-cone'],'sparse-init.log')
run(['git','-C',str(S),'sparse-checkout','set','--no-cone','--stdin'],'sparse-set.log',input=patterns.encode())
run(['git','-C',str(S),'checkout','--detach','c7fae5ac7ea9e29dfa3f83a7c2bd87d092e0b3b2'],'checkout.log')
assert subprocess.check_output(['git','-C',str(S),'rev-parse','--is-shallow-repository']).strip()==b'false'
run(['python3',str(E/'closure.py'),'--repo',str(S),'--staged-root',str(S)],'staged-closure-verification.json')
run(['git','diff','--exit-code','HEAD','--','src','lib','tools','test','fonts','host.js','index.html','CLAUDE.md'],'source-diff-before.log',cwd=S)
run(['git','diff','--cached','--exit-code','HEAD'],'index-diff-before.log',cwd=S)
run(['node','tools/check-api-table.js','--base=63d563df7a2b901d222a311ceaf55a0823a22261'],'api-history-preflight.log',cwd=S)
assert 'index check only' not in (E/'api-history-preflight.log').read_text()
run(['bash','-lc','node --version; git --version; bash --version; sha256sum "$(command -v node)"; du -sb /home/user/aoe3-canonical-c7fae5ac-staged /home/user/aoe3-canonical-c7fae5ac-evidence; df -B1 /home/user; find /home/user/aoe3-original-oct22/runner -maxdepth 2 -type f; cat /home/user/aoe3-original-oct22/runner/package.json'],'environment-preflight.log')
pins('original-pins-after-stage.log')
print('STAGED CLOSURE + HISTORY + API BASE + 373 PINS PASS')
print((E/'staged-closure-verification.json').read_text())
print((E/'environment-preflight.log').read_text())
