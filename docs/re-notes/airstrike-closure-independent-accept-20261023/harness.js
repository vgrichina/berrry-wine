// Pure JS host semantics only: never import test/run.js or instantiate wasm.
const fs=require('fs'), path=require('path'), vm=require('vm'), assert=require('assert');
const R='/home/user/wine-assembly';
const A='/tmp/airstrike-original-private-oct23/docs/re-notes/airstrike-original-20261023/release/airstrike-pre6a';
const L='/tmp/airstrike-legacy-zlib-private-oct23/docs/re-notes/airstrike-legacy-zlib-20261023';
const source=fs.readFileSync(R+'/test/run.js','utf8');
const getArgsSource=source.slice(source.indexOf('const getArg ='),source.indexOf('const hasFlag ='));
function parse(args) {
  return vm.runInNewContext(getArgsSource+';({includes:getArgs("vfs-include"),dllArg:getArg("dlls",null)})',{args});
}
const {expandIncludePatterns}=require(R+'/lib/vfs-host-files');
const expected=JSON.parse(fs.readFileSync(L+'/minimal-vfs.json')).files.map(f=>f.path).filter(f=>!f.endsWith('.exe')).sort();
const repeated=parse(['--vfs-include=airstrikerc','--vfs-include=data/**/*']).includes;
const comma=parse(['--vfs-include=airstrikerc,data/**/*']).includes;
assert.deepStrictEqual(Array.from(repeated),Array.from(comma));
const matches=expandIncludePatterns(A,Array.from(repeated));
assert.deepStrictEqual(matches.map(f=>f.relativePath).sort(),expected);
assert.throws(()=>expandIncludePatterns(A,['/data/**/*']),/relative/);
assert.throws(()=>expandIncludePatterns(A,['data/absent-independent-fixture']),/matched no files/);
assert.throws(()=>expandIncludePatterns(A,['']),/empty/);
const dllPaths=['SDL.dll','SDL_image.dll','SDL_mixer.dll','jpeg.dll','libpng1.dll','msvcr70.dll'].map(n=>A+'/'+n).concat(R+'/test/binaries/dlls/msvcrt.dll',L+'/zlib.dll');
const dllArg=parse(['--dlls='+dllPaths.join(',')]).dllArg;
const block=source.slice(source.indexOf('dlls = dllArg.split'),source.indexOf('} else {',source.indexOf('dlls = dllArg.split')));
const configs=vm.runInNewContext('let dlls;'+block+';dlls',{dllArg,path,fs});
assert.equal(configs.length,8);
assert.deepStrictEqual(Array.from(configs,c=>c.name.toLowerCase()).sort(),dllPaths.map(p=>path.basename(p).toLowerCase()).sort());
const {VirtualFS}=require(R+'/lib/filesystem');
const vfs=new VirtualFS();
for(const f of matches) vfs.ensureParentDirs('c:\\'+f.guestPath.replace(/\//g,'\\'));
assert(vfs.setCurrentDirectory('C:\\'));
assert.equal(vfs.getFullPathName('data/title.png').toLowerCase(),'c:\\data\\title.png');
assert(!vfs.setCurrentDirectory('C:\\absent-independent-fixture'));
const receipt={repeat_flags:true,comma_list_also_supported:true,mounted_includes:matches.length,automatic_exe_plus_includes:matches.length+1,explicit_dlls:configs.map(c=>({name:c.name,bytes:c.bytes.length})),controls:['absolute glob rejected','empty glob rejected','unmatched glob rejected','missing cwd rejected'],note:'No harness execution, module loading, guest, renderer, native compilation or wasm'};
fs.writeFileSync(__dirname+'/harness-results.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));
