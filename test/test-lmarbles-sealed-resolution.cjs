'use strict';
// Real Node resolution with transient sealed inputs; no live dependency writes.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const r = spawnSync('python3', ['-B', '-c', String.raw`
import pathlib,subprocess,os,hashlib,base64,importlib.util
root=pathlib.Path.cwd()
s=importlib.util.spec_from_file_location('sup',root/'tools/lmarbles-supervisor.py');sup=importlib.util.module_from_spec(s);s.loader.exec_module(sup)
sha=lambda b:hashlib.sha256(b).hexdigest()
assert not (root/'lib/__sealed_absent_dependency.js').exists()
files={
 'lib/__sealed_entry.js':b"module.exports=require('./nested/../__sealed_absent_dependency')",
 'lib/__sealed_absent_dependency.js':b"module.exports={value:42,json:require('./__sealed_data.json'),pkg:require('__sealed_pkg')}",
 'lib/__sealed_data.json':b'{"pinned":true}',
 'node_modules/__sealed_pkg/package.json':b'{"main":"dist/entry.js"}',
 'node_modules/__sealed_pkg/dist/entry.js':b"module.exports='package-pinned'",
 # Real live file exists, but its bytes must never be compiled.
 'lib/host-imports.js':b"module.exports='sealed-mismatch'",
 'lib/__sealed_escape.js':b"require('../../outside-inventory.js')"
}
rows=[dict(path=n,sha256=sha(b),body=base64.b64encode(b).decode()) for n,b in files.items()]
packed,pin=sup.indexed_source(rows);source=sup.seal('resolution-test',packed)
env=os.environ.copy();env.update(NODE_OPTIONS='--require='+str(root/'tools/lmarbles-native-source-view.cjs'),LMARBLES_SOURCE_FD='/proc/self/fd/'+str(source),LMARBLES_SOURCE_INDEX_SHA256=pin)
def run(code):
 p=subprocess.Popen(['node','-e',code],cwd=root,env=env,pass_fds=(source,),stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
 try:a,b=p.communicate(timeout=10)
 except subprocess.TimeoutExpired:
  import signal
  os.killpg(p.pid,signal.SIGKILL);p.communicate();raise
 return p.returncode,a.decode(),b.decode()
rc,a,b=run("const a=require('node:assert/strict');const m=require('./lib/__sealed_entry');a.deepEqual(m,{value:42,json:{pinned:true},pkg:'package-pinned'});a.equal(require.resolve('./lib/__sealed_absent_dependency'),'"+str(root)+"/lib/__sealed_absent_dependency.js');a.equal(require('./lib/host-imports'),'sealed-mismatch');console.log('PINNED_OK')")
assert rc==0 and 'PINNED_OK' in a,(rc,a,b)
for request in ['./lib/process-desktop','./lib/__unlisted_absent','./lib/__sealed_escape']:
 rc,a,b=run('require('+repr(request)+')');assert rc!=0 and 'unsealed runtime input' in b,(request,rc,a,b)
os.close(source)
print('PASS absent-live dependency, normalized relative import, JSON, package main, require.resolve, existing-live mismatch, outside-inventory refusal; actual Node waits and both EOFs')
`], { encoding: 'utf8', timeout: 45000 });
process.stdout.write(r.stdout || ''); process.stderr.write(r.stderr || '');
assert.equal(r.status, 0);
