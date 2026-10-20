'use strict';
// Execute unchanged CLI entrypoints against exact Git base + isolated files.
// Missing sparse files are read from base objects, never another worktree.
const fs=require('fs'),cp=require('child_process'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const repo=path.resolve(process.argv[2]), entry=process.argv[3], args=process.argv.slice(4), base='ac72debe7522d4d57034627712b8ec000f8e1d92';
const cache=new Map(), seals={};
const tree=cp.execFileSync('git',['ls-tree','-r','--name-only',base],{cwd:repo,encoding:'utf8'}).trim().split('\n');
function read(file){const p=path.join(repo,file);const b=fs.existsSync(p)?fs.readFileSync(p):cp.execFileSync('git',['show',base+':'+file],{cwd:repo,maxBuffer:16e6});seals[file]=crypto.createHash('sha256').update(b).digest('hex');return b;}
const rel=p=>path.relative(repo,p);
const inside=p=>typeof p==='string'&&!rel(p).startsWith('..')&&!path.isAbsolute(rel(p));
const vfs={...fs,readFileSync(p,opts){if(!inside(p))return fs.readFileSync(p,opts);const b=read(rel(p));return typeof opts==='string'||opts?.encoding?b.toString(typeof opts==='string'?opts:opts.encoding):b;},existsSync(p){return fs.existsSync(p)||(inside(p)&&tree.includes(rel(p)));},readdirSync(p,opts){if(!inside(p)||opts)return fs.readdirSync(p,opts);const prefix=rel(p)+'/';return [...new Set(tree.filter(f=>f.startsWith(prefix)).map(f=>f.slice(prefix.length).split('/')[0]))];},writeFileSync(){throw Error('CLI write forbidden');}};
let main;
function load(file){if(!/\.(js|json)$/.test(file))file+='.js';if(cache.has(file))return cache.get(file).exports;const m={exports:{},filename:path.join(repo,file)};cache.set(file,m);if(file===entry)main=m;if(file.endsWith('.json'))return m.exports=JSON.parse(read(file));const req=n=>n==='fs'?vfs:n.startsWith('.')||n.startsWith(repo+'/')?load(path.relative(repo,path.resolve(repo,path.dirname(file),n))):require(n);req.main=main;const proc={...process,argv:['node',path.join(repo,entry),...args],exit(code){if(code)throw Error('CLI exited '+code);}};vm.runInThisContext('(function(require,module,exports,__dirname,__filename,process){\n'+read(file).toString().replace(/^#![^\n]*\n/,'')+'\n})',{filename:file})(req,m,m.exports,path.dirname(m.filename),m.filename,proc);return m.exports;}
load(entry); console.log('INPUT_SHA256 '+JSON.stringify(seals));
