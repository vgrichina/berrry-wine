const fs=require('fs'),assert=require('assert/strict');const root='/home/user/jedi-current-main',out='/home/user/jedi-original-layout-install';
const {VirtualFS}=require(root+'/lib/filesystem.js');
const rows=[];
function mount(dir){const v=new VirtualFS();function add(p,rel=''){for(const f of fs.readdirSync(p,{withFileTypes:true})){const r=rel+f.name;if(f.isDirectory())add(p+'/'+f.name,r+'/');else if(r!=='launch.json'){const bytes=fs.readFileSync(p+'/'+f.name),g='C:\\'+r.replaceAll('/','\\');v.ensureParentDirs(g);v.setLazyFile(g,{attrs:0x20,size:bytes.length,load:()=>new Uint8Array(bytes)});}}}add(dir);return v;}
function check(v,label,pattern,size){const r=v.findFirstFile(pattern);assert.equal(r.entry?.size??null,size);if(r.handle)v.findClose(r.handle);rows.push({label,pattern,expected:size,actual:r.entry?.size??null});}
const prior=mount('/home/user/jedi-evidence/capture');
for(const [p,s]of [['C:\\WebJedi\\*.*',null],['c:\\webjedi\\*',null],['C:\\Gamedata\\Mininstall\\Res1hi.gob',null],['C:\\Gamedata\\Mininstall\\Res1low.gob',null],['C:\\Jedi.exe',305664],['C:\\JKDEMO.EXE',1388032],['C:\\res1demo.gob',31326451],['C:\\Linstall.bmp',50686],['C:\\missing\\jedi.exe',null]])check(prior,'prior',p,s);
const staged=mount(out+'/faithful-capture'),installed=mount(out+'/install1/vfs');
const proof=JSON.parse(fs.readFileSync(out+'/layout-proof.json'));
for(const f of proof.files){check(staged,'faithful','C:\\'+f.output.replaceAll('/','\\'),f.size);if(f.output.startsWith('WEBJEDI/'))check(installed,'installed','C:\\Program Files\\LucasArts\\Jedi Knight Demo\\'+f.output.slice(8).replaceAll('/','\\'),f.size);}
check(staged,'faithful-absent-root','C:\\Jedi.exe',null);check(staged,'faithful-absent-root','C:\\res1demo.gob',null);check(staged,'absent-sound','C:\\Gamedata\\Mininstall\\Res1hi.gob',null);
const r=staged.findFirstFile('C:\\WebJedi\\*.*');assert(r.handle);let e=r.entry,entries=[];while(e){entries.push(e.name);e=staged.findNextFile(r.handle)}staged.findClose(r.handle);assert(entries.some(x=>x.toLowerCase()==='jedi.exe'));assert(entries.some(x=>x.toLowerCase()==='episode'));
fs.writeFileSync(out+'/controls.json',JSON.stringify({pass:true,checks:rows.length,rows,webJediEntries:entries},null,2));console.log({pass:true,checks:rows.length,entries});
