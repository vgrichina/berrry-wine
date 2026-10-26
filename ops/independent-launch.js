'use strict';
const fs=require('fs'), path=require('path'), assert=require('assert'), cp=require('child_process');
const H='/tmp/gl-launch-controls-independent-accept-oct26';
const helper=require('/tmp/gl-browser-launch-control-repair-oct26/source/test/helpers/palette-browser-launch.js');
const wrapper=path.join(H,'tmp','wrapper,network.sh'), link=path.join(H,'tmp','alias,chrome');
const sentinel=path.join(H,'tmp','MUST-NOT-EXIST');
fs.writeFileSync(wrapper,`#!/bin/sh\necho executed > '${sentinel}'\nexit 93\n`,{mode:0o700});fs.symlinkSync(wrapper,link);
for(const file of [wrapper,link]) assert.throws(()=>helper.checkedExecutable(file),/wrapper rejected before invocation/);
assert(!fs.existsSync(sentinel));
const real=helper.launchConfiguration({CHROME:'/usr/bin/true'});
assert.equal(real.checked.executablePath,fs.realpathSync('/usr/bin/true'));assert.equal(real.options.executablePath,real.checked.executablePath);assert.equal(real.options.detached,false);
// Interpose only the prlimit executable call to observe exact child limits without a second source tree.
// The real production gitIdentity closure captured execFileSync, so use a preload when loading it afresh.
let gitCalls=0;
const original=cp.execFileSync;
cp.execFileSync=function(bin,args,opts){
 if(bin==='/usr/bin/prlimit'){
  assert.deepEqual(args.slice(0,4),['--data=536870912:536870912','--','git','-c']);
  const probe=original('/usr/bin/prlimit',['--data=536870912:536870912','--','/usr/bin/python3','-c','import resource,json;print(json.dumps(resource.getrlimit(resource.RLIMIT_DATA)))'],{encoding:'utf8'});
  assert.deepEqual(JSON.parse(probe),[536870912,536870912]);gitCalls++;
 }
 return original(bin,args,opts);
};
delete require.cache[require.resolve('/tmp/gl-browser-launch-control-repair-oct26/source/test/helpers/palette-browser-launch.js')];
const before=fs.readFileSync('/proc/self/limits','utf8');
require('/tmp/gl-browser-launch-control-repair-oct26/source/test/helpers/palette-browser-launch.js').gitIdentity('/tmp/gl-browser-launch-control-repair-oct26/source');
assert.equal(fs.readFileSync('/proc/self/limits','utf8'),before); assert.equal(gitCalls,2);
console.log(JSON.stringify({passed:true,wrapperAndCommaSymlinkRejected:true,sentinelAbsent:true,trueExecutable:real.checked,gitChildDATA:536870912,nodeLimitsUnchanged:true}));
