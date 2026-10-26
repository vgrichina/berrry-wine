const fs=require('fs'),path=require('path');
const {references,schemaProblems}=require('/home/user/wine-assembly/ops/check-run-evidence.js');
const root='/home/user/wine-assembly/scratch/runs/civ2-win16-complete-setup-map-gameplay-oct26';
const raw=JSON.parse(fs.readFileSync(root+'/result.json'));
const errors=schemaProblems(raw);
for(const ref of references(raw)){
 const target=path.resolve(root,ref.value);
 if(!target.startsWith(root+'/')||!fs.realpathSync(target).startsWith(root+'/'))errors.push('outside '+ref.value);
 if(!fs.statSync(target).isFile())errors.push('not file '+ref.value);
}
console.log(JSON.stringify({canonicalChecker:'/home/user/wine-assembly/ops/check-run-evidence.js',schemaAndContainedArtifacts:errors.length===0,errors,gameplayClaim:true}));
if(errors.length)process.exitCode=1;
