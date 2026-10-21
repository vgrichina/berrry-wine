const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const root='/home/user/jedi-current-main',prior='/home/user/jedi-evidence',out='/home/user/jedi-missing-payload-diagnosis';
const {VirtualFS}=require(root+'/lib/filesystem.js');const v=new VirtualFS();
const cap=JSON.parse(fs.readFileSync(prior+'/capture-seal.json'));
for(const f of cap.files)if(f.path!=='launch.json'){const p='C:\\'+f.path.replaceAll('/','\\');v.ensureParentDirs(p);v.setLazyFile(p,{attrs:0x20,size:f.bytes,load:()=>new Uint8Array(fs.readFileSync(prior+'/capture/'+f.path))});}
const rows=[];
for(const [pattern,expected]of [['C:\\WebJedi\\*.*',null],['c:\\webjedi\\*',null],['C:\\Gamedata\\Mininstall\\Res1hi.gob',null],['C:\\Gamedata\\Mininstall\\Res1low.gob',null],['C:\\Jedi.exe',305664],['C:\\JKDEMO.EXE',1388032],['C:\\res1demo.gob',31326451],['C:\\Linstall.bmp',50686],['C:\\missing\\jedi.exe',null]]){
 const r=v.findFirstFile(pattern);if(expected===null){assert.equal(r.handle,0);assert.equal(r.entry,null)}else{assert(r.handle);assert.equal(r.entry.size,expected);v.findClose(r.handle)}rows.push({pattern,expectedSize:expected,result:r});
}
const search=v.findFirstFile('C:\\*.*');let entries=[],e=search.entry;while(e){entries.push(e);e=v.findNextFile(search.handle)}v.findClose(search.handle);assert(entries.some(e=>e.name.toLowerCase()==='jedi.exe'));assert(!entries.some(e=>e.name.toLowerCase()==='webjedi'));
const b=fs.readFileSync('/home/user/jedi-original/jedidemo.exe'),inv=JSON.parse(fs.readFileSync('/home/user/jedi-original/inventory.json'));
const archive=inv.files.map((f,i)=>{const p=f.offset,n=b.readUInt16LE(p+26),extra=b.readUInt16LE(p+28),size=b.readUInt32LE(p+18);const name=b.toString('latin1',p+30,p+30+n);assert.equal(name,f.name);return {name,offset:p,localHeaderExtraBytes:extra,nextLocalHeader:i+1<inv.files.length?inv.files[i+1].offset:null,compressedDataEnd:p+30+n+extra+size};});
const script=fs.readFileSync('/home/user/jedi-original/original/setup.ins');
const report={at:new Date().toISOString(),source:require('child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),loadedCaptureFiles:cap.files.length-1,rows,rootEntries:entries.map(e=>({name:e.name,size:e.size,attrs:e.attrs})),archiveLocalHeaders:archive,scriptOperands:[{offset:0x4580,hex:script.subarray(0x4580,0x45c0).toString('hex'),ascii:script.subarray(0x4580,0x45c0).toString('latin1')}],scope:'Read-only VFS tests of unchanged captured source tree; no alternate mounts, no installed payload, no guest replay, no production edit.'};
fs.writeFileSync(out+'/controls.json',JSON.stringify(report,null,2));console.log(JSON.stringify({pass:true,checks:rows.length,rootEntries:entries.length,archiveHeaders:archive.length}));
