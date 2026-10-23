'use strict';
// Approved bounded reconciliation: exactly four reviewed producers, no --dump baseline.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..');
const donor='/home/user/wine-assembly-shadow-man-null-hook-independent-review-oct23';
const tool=path.join(donor,'tools/callback-ownership-census.js');
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(tool)).digest('hex'),'680a13027e348a3c19cc8f4ec670e3046372372d6d674fb1cd32e8fe216e707e');
const {scanWat,check}=require(tool);
const file=path.join(root,'tools/callback-ownership-census.json'),baseline=JSON.parse(fs.readFileSync(file));
const before=JSON.parse(JSON.stringify(baseline));
const review={
 'src/13-exports.wat:$run':{kind:'host-entry',reason:'ShadowMan diagnostic review 2026-10-23: first-zero observer is synchronous at loop entry before last_run_halt and enclosing sender restoration; zero saved fields are N/A. Legitimate CACA0005 also reaches it. OFF adds no context write; ON terminates even with returning observer. No zero-writer or invocation-ownership proof; lifetime remains pending.'},
 'src/09c3a-dialog-runtime.wat:$wnd_send_message_inner':{kind:'mixed-dispatch',reason:'ShadowMan diagnostic review 2026-10-23: sender-pre after caller-register save and invocation/depth allocation, before 20-byte callback frame; before-restore after run loop and before token/depth checks/restoration. Saved pair is caller EIP/ESP; observed token belongs to current child, not proven modal owner. Default-off native restored caller and 64-round abandonment seam reviewed; synchronous copies introduce no retained guest context. Ownership remains pending.'},
 'src/09b-dispatch.wat:$win32_dispatch_inner':{kind:'mixed-dispatch',reason:'ShadowMan diagnostic review 2026-10-23: modal-frame-consume after sentinel adjustment/teardown/reentry, before consuming current frame; saved return is retiring local, saved ESP is consumed frame, not original API entry. Complete after previous pump restoration and EAX/EIP/ESP update, before ended/result/quit reset. No modal behavior or frame lifetime changed; earlier final SIZE lifetime review remains applicable. Scripted prefix only; ownership remains pending.'},
 'src/13-exports.wat:export:null_diag_token':{kind:'host-entry',reason:'ShadowMan diagnostic review 2026-10-23: synchronous read-only invocation_current getter, no EIP/context write or retain/release. Signed i64 host string preserves bits, not modal owner attribution. Observer copies token before guest resumes; returning a token is not an ownership assertion. Ownership remains pending.'}
};
const entries=[];for(const f of ['src/13-exports.wat','src/09c3a-dialog-runtime.wat','src/09b-dispatch.wat'])entries.push(...scanWat(fs.readFileSync(path.join(root,f),'utf8'),f));
const delta=[];
for(const e of entries){const key=e.file+':'+e.name,old=baseline.entries.find(x=>x.file===e.file&&x.name===e.name);if(!old||old.sha256!==e.sha256){assert(review[key],key);delta.push({key,before:old||null,after:{...e,...review[key],ownership:'pending'}});}}
assert.deepEqual(delta.map(x=>x.key).sort(),Object.keys(review).sort());
if(process.argv.includes('--apply')){
 for(const d of delta){const i=baseline.entries.findIndex(e=>e.file===d.after.file&&e.name===d.after.name);if(i<0)baseline.entries.push(d.after);else baseline.entries[i]={...d.after,reason:(d.before.reason+' '+d.after.reason)};}
 fs.writeFileSync(file,JSON.stringify(baseline,null,2)+'\n');
}
const scoped=entries.map(e=>baseline.entries.find(x=>x.file===e.file&&x.name===e.name));
if(process.argv.includes('--apply'))assert.deepEqual(check(entries,{version:1,entries:scoped}),[]);
fs.writeFileSync(path.join(__dirname,'census-reconciliation.json'),JSON.stringify({exit:0,scope:'direct scanWat three fragments ONLY; exact four reviewed changes',toolSha256:'680a13027e348a3c19cc8f4ec670e3046372372d6d674fb1cd32e8fe216e707e',delta,fullCensus:'PENDING: complete source closure/export reachability required. test/run.js not scanned by pinned sourceFiles (root JS + lib JS only).',untouched:before.entries.filter(e=>!review[e.file+':'+e.name]).length},null,2)+'\n');
console.log(JSON.stringify({exit:0,reviewed:delta.map(x=>x.key),directProducers:entries.length,fullCensus:'PENDING (incomplete closure)'}));
