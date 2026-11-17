'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');
const {resolve}=require('../tools/neverhood-installed-shortcut.cjs');
const base='scratch/runs/20261117-neverhood-visible-startup-normal-install-room';
const proof=JSON.parse(fs.readFileSync(base+'/second/installed-provenance.json'));
const row=proof.files.find(r=>r.path===proof.shortcut.path),link=fs.readFileSync(base+'/second/original/'+row.artifact);
const target=proof.shortcut.target.toLowerCase(),bodies=new Map([[row.path,link],[target,Buffer.from('authored-target')]]);
const records=[{path:target,kind:'file'}],r=resolve(bodies,records,row.path);
assert.equal(r.exe,target);assert.equal(r.cwd,proof.shortcut.effectiveWorkingDirectory.toLowerCase());assert.equal(r.args,'');
assert.throws(()=>resolve(bodies,[{path:target,kind:'whiteout'}],row.path));
assert.throws(()=>resolve(new Map([[row.path,link]]),records,row.path));
assert.throws(()=>resolve(new Map([[row.path,Buffer.alloc(10)]]),records,row.path));
const code=`import importlib.util,os
s=importlib.util.spec_from_file_location('runtime','tools/neverhood-original-current-runtime.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
assert m.limits()==(900,920,90)
os.environ['NEVERHOOD_INSTALLED_SHORTCUT']='1'
assert m.limits()==(1800,1820,180)
assert m.POLICY==dict(confirmationMs=500,physicalUpMs=1750,observationMs=3000,gameFreshnessSeconds=15,menuFreshnessSeconds=30)
`;
const p=cp.spawnSync('python3',['-B','-c',code],{encoding:'utf8'});assert.equal(p.status,0,p.stderr);
console.log('PASS authentic shortcut parser/kept entry target/cwd/args; missing/whiteout/malformed refusal; installed timing and unchanged native limits');
