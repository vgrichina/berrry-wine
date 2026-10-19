'use strict';
// Existing runner/ctl protocol only. No guest memory writes or automatic input.
const apiNames=['FindResourceA','LoadResource','LockResource','fopen','fgets','fclose','_chdir','_getcwd','_fullpath','CreateFileA','ReadFile','SetCurrentDirectoryA'];
const memorySpecs=['FindResourceA:1:64','fopen:0:128','fopen:1:8','_chdir:0:128','CreateFileA:0:128','SetCurrentDirectoryA:0:128'];
const flags=['--trace-api='+apiNames.join(','),'--trace-api-paused','--trace-api-mem='+memorySpecs.join(',')];
const reviewedMenuCommands=[{action:'trace-api',on:true},{cmd:'click:176:180'}];
const pauseCommands=[{action:'trace-api',on:false}];
module.exports={apiNames,memorySpecs,flags,reviewedMenuCommands,pauseCommands};
if(require.main===module){
 const mode=process.argv[2];
 if(mode==='--flags')console.log(JSON.stringify(flags));
 else if(mode==='--reviewed-menu-click')for(const c of reviewedMenuCommands)console.log(JSON.stringify(c));
 else if(mode==='--pause')for(const c of pauseCommands)console.log(JSON.stringify(c));
 else throw new Error('Use --flags, --reviewed-menu-click (only after screenshot review), or --pause');
}
