'use strict';
// Uploads are derived from the actual prepared manifest, never a parallel list.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function provider(root,relative){
 root=fs.realpathSync(root);
 if(typeof relative!=='string'||!relative||path.isAbsolute(relative)||relative.split('/').some(p=>p==='..'||p==='.'||!p))throw Error('provider outside root: '+relative);
 const target=fs.realpathSync(path.resolve(root,relative)),rel=path.relative(root,target);
 if(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw Error('provider outside root: '+relative);
 if(!fs.statSync(target).isFile())throw Error('provider is not a file: '+relative);
 const b=fs.readFileSync(target);return {path:relative,size:b.length,sha256:sha(b)};
}
function validate(root,rows){
 if(!Array.isArray(rows)||!rows.length)throw Error('empty provider closure');
 const seen=new Set();
 for(const pin of rows){
  if(seen.has(pin.path))throw Error('duplicate provider: '+pin.path);seen.add(pin.path);
  const actual=provider(root,pin.path);
  if(actual.size!==pin.size||actual.sha256!==pin.sha256)throw Error('provider SHA/size mismatch: '+pin.path);
 }
 return rows;
}
function assertClosure(root,prepared,upload){
 validate(root,prepared.files);validate(root,upload.files);
 const staged=new Map(upload.files.map(p=>[p.path,p]));
 for(const p of prepared.files){
  const q=staged.get(p.path);
  if(!q||q.size!==p.size||q.sha256!==p.sha256)throw Error('omitted or changed prepared provider: '+p.path);
 }
 return {preparedProviders:prepared.files.length,uploadProviders:upload.files.length,subset:true};
}
function derive(root,manifest,extra=[]){
 const raw=fs.readFileSync(manifest),prepared=JSON.parse(raw);
 validate(root,prepared.files);
 const rows=new Map(prepared.files.map(p=>[p.path,p]));
 for(const name of extra){const p=provider(root,name),prior=rows.get(name);if(prior&&(prior.size!==p.size||prior.sha256!==p.sha256))throw Error('extra provider changed prepared bytes');rows.set(name,p)}
 const upload={...prepared,preparedManifestSha256:sha(raw),files:[...rows.values()]};
 assertClosure(root,prepared,upload);return upload;
}
module.exports={provider,validate,assertClosure,derive};
if(require.main===module){
 const [root,manifest,destination,...extra]=process.argv.slice(2);
 const upload=derive(root,manifest,extra);
 fs.writeFileSync(destination,JSON.stringify(upload,null,2),{flag:'wx'});
 console.log(JSON.stringify(assertClosure(root,JSON.parse(fs.readFileSync(manifest)),upload)));
}
