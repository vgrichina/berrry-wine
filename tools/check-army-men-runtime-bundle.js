'use strict';
// Source/module-resolution preflight only: never require run.js or compile a guest.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const {createRequire}=require('module');
const root=path.resolve(process.argv[2]),report=process.argv[3];
const seen=new Set(),failures=[],optional=[];
const optionalNames=new Set(['@node-3d/glfw','@node-3d/webgl','skia-canvas']);
function walk(file){
 if(seen.has(file))return;seen.add(file);if(!file.endsWith('.js'))return;
 const text=fs.readFileSync(file,'utf8').split('\n').filter(line=>!/^\s*\/\//.test(line)).join('\n');
 const req=createRequire(file);
 for(const m of text.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)){
  try{const resolved=req.resolve(m[1]);if(m[1].startsWith('.'))walk(resolved);}
  catch(error){const entry={from:path.relative(root,file),request:m[1]};if(optionalNames.has(m[1]))optional.push(entry);else failures.push(entry);}
 }
 const result=cp.spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
 if(result.status!==0)failures.push({file:path.relative(root,file),syntax:result.stderr});
}
for(const entry of ['test/run.js','host.js','tools/ctl.js'])walk(path.join(root,entry));
// Dynamic ordinal load, static system seed, API signatures and exact font mounts.
const statics=['src/win16-ordinals.generated.json','src/api_table.json','lib/host-import-sigs.generated.json','build/wine-assembly.wasm','test/binaries/tlbs/stdole2.tlb','fonts/substitutions.json'];
const fonts=require(path.join(root,'lib/font-substitutions.js'));
for(const f of fonts.BUNDLED_BITMAP_FONTS)statics.push('fonts/'+f);
for(const m of fonts.fontMounts(JSON.parse(fs.readFileSync(path.join(root,'fonts/substitutions.json'))),{subset:true}))statics.push('fonts/'+m.file);
for(const file of statics)if(!fs.existsSync(path.join(root,file)))failures.push({static:file});
const result={at:new Date().toISOString(),root,relativeClosure:[...seen].map(p=>path.relative(root,p)).sort(),statics,optionalAbsent:optional,failures,guestExecuted:false,buildExecuted:false,limits:'literal relative requires plus reviewed dynamic/static paths; optional headless GL and decodeImage modes not requested'};
if(report)fs.writeFileSync(report,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({closure:seen.size,statics:statics.length,optionalAbsent:optional,failures}));
process.exitCode=failures.length?1:0;
