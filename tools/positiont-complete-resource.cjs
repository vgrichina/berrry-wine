'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),cp=require('child_process'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),external='/home/user/wine-assembly/scratch/usage-watch/render-positiont-file-log-bounds-readiness-oct23';
const evidence=path.join(root,'docs/re-notes/render-positiont-file-log-bounds-readiness-20261023');
const blob=b=>crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
function footprint(dir){let n=fs.lstatSync(dir).size;for(const x of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,x.name);assert(!x.isSymbolicLink(),'no accounting links');n+=x.isDirectory()?footprint(p):fs.lstatSync(p).size;}return n;}
function calculate(owned,ext,growth,free){const projected=owned+ext+growth+8388608;assert(projected<=67108864,'READINESS: accounting cap exceeded');assert(free-growth>=2982150144,'READINESS: host free floor');return projected;}
function admit(phase,growth=1572864){const owned=footprint(root),ext=footprint(external),disk=fs.statfsSync(root),free=disk.bavail*disk.bsize;const projected=calculate(owned,ext,growth,free);const rec={phase,owned,external:ext,growth,reserve:8388608,projected,cap:67108864,hostFree:free,floor:2982150144};fs.appendFileSync(path.join(evidence,'resources.jsonl'),JSON.stringify(rec)+'\n');return rec;}
function phase(name){
 const manifest=JSON.parse(fs.readFileSync(path.join(evidence,'manifest.json')));
 const release=manifest.filter(([f,h,n,d,life])=>fs.existsSync(path.join(root,f))&&(name==='bundle'?life==='scanner':life!=='concat'));
 const copies=name==='bundle'?manifest.filter(r=>r[5]==='late'):[];
 for(const [f,h] of release)assert.equal(blob(fs.readFileSync(path.join(root,f))),h,'release exact identity '+f);
 const combined=name==='concat'?JSON.parse(fs.readFileSync(path.join(evidence,'admission.json'))).combinedBytes:0;
 const newBytes=copies.reduce((n,r)=>n+r[2],0)+combined+32768;
 const owned=footprint(root)-release.reduce((n,r)=>n+r[2],0),ext=footprint(external),disk=fs.statfsSync(root);
 calculate(owned,ext,newBytes+1572864,disk.bavail*disk.bsize);
 const buffers=copies.map(([f,h,n,d])=>{let b;if(d.includes(':object:')){const donor=d.split(':object:')[0];b=cp.execFileSync('git',['-C',donor,'cat-file','blob',h],{env:{...process.env,GIT_NO_LAZY_FETCH:'1'},maxBuffer:8*1048576});}else b=fs.readFileSync(path.join(d,f));assert.equal(blob(b),h);return b;});
 for(const [f] of release)fs.unlinkSync(path.join(root,f));
 copies.forEach(([f],i)=>{const p=path.join(root,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,buffers[i]);});
 fs.writeFileSync(path.join(evidence,'phase-'+name+'.json'),JSON.stringify({name,released:release.map(r=>[r[0],r[1]]),materialized:copies.map(r=>[r[0],r[1]]),plannedGeneratedBytes:combined})+'\n');
 admit(name,combined+1572864);
}
module.exports={admit,phase,calculate,root,evidence,footprint};
