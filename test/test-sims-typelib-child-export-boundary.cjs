'use strict';
// Pure host controls. --candidate evaluates the exact proposed diagnostic in
// memory during predecessor wait; it never changes the shared implementation.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os');
const path=require('node:path'),vm=require('node:vm');
const file=path.resolve(__dirname,'../lib/vfs-export.js');
const diagnostic=String.raw`const escapedKey = JSON.stringify(key.slice(0, 256)).replace(/[\u007f-\uffff]/g,
        ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
      throw new Error('unsafe child export path key=' + escapedKey +
        ' keyLength=' + key.length + ' provenance=resident driveReadonly=' +
        !!(vfs.readOnlyDrives && vfs.readOnlyDrives.has(key.slice(0, 1).toLowerCase())));`;
function load(candidate=false){
  let source=fs.readFileSync(file,'utf8');
  if(candidate){
    assert.equal(source.split("throw new Error('unsafe child export path');").length,2);
    source=source.replace("throw new Error('unsafe child export path');",'{\n'+diagnostic+'\n}');
  }
  const box={require,module:{exports:{}},Buffer};vm.runInNewContext(source,box,{filename:file});
  return box.module.exports;
}
function run(candidate=false){
  const transport=load(candidate),root=fs.mkdtempSync(path.join(os.tmpdir(),'sims-export-boundary-'));
  let count=0;
  function fixture(entries,readonly=[]){
    const dir=path.join(root,String(++count));fs.mkdirSync(dir);
    const vfs={files:new Map(entries),dirs:new Set(['c:','c:\\']),readOnlyDrives:new Set(readonly)};
    const out=path.join(dir,'out'),reg=path.join(dir,'reg.json'),complete=path.join(dir,'complete.json');
    return {vfs,dir,out,reg,complete,save:()=>transport.saveCompletedChildState(vfs,
      {exportStore:()=>({'reg:fixture':'kept'})},out,reg,complete,'unique-'+count)};
  }
  const resident=()=>({data:Buffer.from('fixture'),attrs:0x20});
  try{
    for(const key of ['', '/absolute','\\absolute','..\\escape','c:drive-relative','d:\\media.bin',
      '\\\\server\\share\\file','\\\\?\\C:\\file','\\\\.\\C:\\file','c:\\a\\..\\b',
      'c:\\a\\.\\b','c:\\a\\\\b','c:\\a/b','c:\\nul\0tail','c:\\nested\\x:y',
      'd:\\line\nforged\r\t\u2028\ud800','d:\\'+('x'.repeat(4000))]){
      const f=fixture([[key,resident()]],['d']);let error;
      try{f.save();}catch(e){error=e;}
      assert(error&&error.message.startsWith('unsafe child export path'),'guard must reject '+JSON.stringify(key));
      assert(!fs.existsSync(f.complete));assert(!fs.existsSync(f.reg));
      assert.equal(fs.readdirSync(f.out).length,0,'all keys validated before first write');
      const match=error.message.match(/^unsafe child export path key=("(?:[^"\\]|\\.)*") keyLength=(\d+) provenance=resident driveReadonly=(true|false)$/);
      assert(match,'diagnostic identifies rejected key without changing rejection');
      assert.equal(JSON.parse(match[1]),key.slice(0,256));assert.equal(+match[2],key.length);
      assert.equal(match[3],String(key.slice(0,1).toLowerCase()==='d'));
      assert(!/[\x00-\x1f\x7f-\uffff]/.test(error.message),'one bounded ASCII escaped line');
      assert(error.message.length<1700,'diagnostic bound');
    }
    // Provider media must not be touched, exported, or mistaken for a write.
    const provider={_provider:{},get data(){throw Error('provider data read');}};
    const f=fixture([['c:\\nested\\ordinary.bin',resident()],['d:\\media.bin',provider]],['d']);
    f.save();assert(fs.existsSync(f.complete));assert.equal(fs.readFileSync(path.join(f.out,'nested','ordinary.bin'),'utf8'),'fixture');
    assert(!fs.existsSync(path.join(f.out,'d:')));
    // Readonly provenance does not authorize a resident non-C key.
    const r=fixture([['d:\\resident.bin',resident()]],['d']);assert.throws(r.save,/driveReadonly=true/);
    assert(!fs.existsSync(r.complete));
    // Nested child exports keep their own completion/token and reject failed
    // inner output; no synthetic complete record or parent merge is created.
    const inner=fixture([['c:\\safe.bin',resident()],['c:\\..\\outside',resident()]]);
    assert.throws(inner.save,/unsafe child export path/);assert(!fs.existsSync(inner.complete));
    assert(!fs.existsSync(path.join(inner.out,'safe.bin')));
    // Reproduce the existing producer boundary without claiming that the
    // retained original contained this particular key. General snapshots can
    // carry a resident D entry; the real include-path producer restores its
    // drive prefix, which the completion guard must continue to reject.
    const producer=fixture([['c:\\ordinary.bin',resident()],['d:\\setup\\source.bin',resident()]],['d']);
    const snapshot=path.join(producer.dir,'snapshot');
    transport.saveVfsToHost(producer.vfs,snapshot);
    const included=require('../lib/vfs-host-files').expandIncludePatterns(snapshot,['**/*']);
    assert(included.some(row=>row.guestPath.toLowerCase()==='d:/setup/source.bin'));
    const mounted=new (require('../lib/filesystem').VirtualFS)();
    for(const row of included){
      const key=/^[a-z]:/i.test(row.guestPath)?row.guestPath:'c:/'+row.guestPath;
      mounted.setLazyFile(key,{size:fs.statSync(row.hostPath).size,load:()=>fs.readFileSync(row.hostPath)});
    }
    assert(mounted.files.has('d:\\setup\\source.bin'));
    assert(!mounted.files.get('d:\\setup\\source.bin')._provider);
    const reconstructed=fixture([...mounted.files],['d']);
    assert.throws(reconstructed.save,/unsafe child export path/);
    assert(!fs.existsSync(reconstructed.complete));
    return {status:'PASS',candidate,adversarialRejected:17,providerUntouched:true,readonlyResidentRejected:true,nestedNoPartialExport:true,
      syntheticResidentDriveProducerRejected:true,originalOffendingKeyKnown:false};
  }finally{fs.rmSync(root,{recursive:true,force:true});}
}
module.exports={diagnostic,run};
if(require.main===module)console.log(JSON.stringify(run(process.argv.includes('--candidate'))));
