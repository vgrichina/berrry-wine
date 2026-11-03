'use strict';
const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert');
const root=process.cwd(),target=path.join(root,'test/test-gl-exact-source-web.js');
let text=fs.readFileSync(target,'utf8');
const start=text.indexOf('async function exactProbe('),end=text.indexOf('async function main()');
assert(start>0&&end>start,'bounded runner anchors');
const probe=fs.readFileSync(path.join(__dirname,'gl-logic-operations-web-probe.js'),'utf8').replace('LITERAL_TABLES',fs.readFileSync(path.join(__dirname,'gl-logic-operation-literals.json'),'utf8'));
text=text.slice(0,start)+probe+'\n'+text.slice(end);
text=text.replace('/tmp/wine-gl-exact-source-profile','/tmp/wine-gl-full-logic-profile');
// Mutation controls alter only the served test copy, never production files.
const mutations={
 'copy-only':['if(waLogicOp<0.)return source;','return source;'],
 'stale-destination':['for(let j=0;j<indices.length;j++){','for(let j=0;j<indices.length&&at===0;j++){'],
 'shared-destination':['const index=indices[j];','const index=indices[0];'],
 'attachment-feedback':['this.bindTexture(d.logicSnapshots[index],3+j);','this.bindTexture(d.colors[index],3+j);'],
 'no-dither':["this.setUniform(program,'waLogicDither','1f',command.logicDither?1:0);","this.setUniform(program,'waLogicDither','1f',0);"],
 'blend-active':['gl.disable(gl.BLEND);gl.disable(gl.DITHER);','gl.disable(gl.DITHER);'],
 'eight-bit-surrogate':['_drawableColorSpec(colorFormat) {',"_drawableColorSpec(colorFormat) {colorFormat='rgba8';"],
};
const mutationAnchor="   const mutation=process.argv.find(s=>s.startsWith('--mutation='))?.slice(11);";
assert.strictEqual(text.split(mutationAnchor).length,2);
text=text.replace(mutationAnchor,mutationAnchor+'\n'+
 '   const control='+JSON.stringify(mutations)+';if(name===\'gpu-backend\'&&control[mutation]){const [a,b]=control[mutation];if(source.split(a).length!==2)throw Error(\'logic mutation anchor \'+mutation);source=source.replace(a,b);}');
const servedAnchor="   sources+=source+'\\n';await evaluate(source);";
assert.strictEqual(text.split(servedAnchor).length,2);
text=text.replace(servedAnchor,"   console.log('TESTED_WEB_SOURCE',JSON.stringify({name,bytes:Buffer.byteLength(source),sha256:require('crypto').createHash('sha256').update(source).digest('hex'),mutation:mutation||null}));\n"+servedAnchor);
if(process.argv.includes('--check-expanded')){new(require('vm').Script)(text,{filename:target});console.log('syntax PASS; no browser execution');}
else {const m=new Module(target,module);m.filename=target;m.paths=Module._nodeModulePaths(path.dirname(target));m._compile(text,target);}
