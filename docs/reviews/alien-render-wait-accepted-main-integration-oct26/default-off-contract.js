'use strict';
// Affected integration contract, not a repeat independent acceptance suite.
// Execute the exact production initialization/suspension body, no guest/CLI startup.
const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const source='/tmp/alien-render-wait-accepted-main-integration-oct26/integration-source';
const runner=fs.readFileSync(source+'/test/run.js','utf8');
const start='  const renderWaitAttribution = createRenderWaitAttribution();',end='  let lastSchedSig = null;';
assert.equal(runner.split(start).length,2);const begin=runner.indexOf(start),finish=runner.indexOf(end,begin);assert(finish>begin);
const hooks=runner.slice(begin,finish);
const {createRenderWaitAttribution}=require(source+'/lib/render-wait-attribution');
const ctx={d3d9Bridge:{requests:new Map()},waitD3DRender:()=>Promise.resolve()};
const sandbox={ctx,createRenderWaitAttribution,instance:{exports:{get_yield_reason:()=>16,get_d3d_render_token:()=>-2}},threadManager:{isMainNamedEventWaiting:()=>false},tickState:{batch:0},hasFlag:()=>false,REAL_TICK_SLEEPS:true,console,Date,Promise,setTimeout};
vm.createContext(sandbox);
vm.runInContext(hooks+'\nglobalThis.check=mainExecutionSuspended;',sandbox);
assert.equal(sandbox.check(),true);
console.log(JSON.stringify({productionRunnerSHA256:crypto.createHash('sha256').update(runner).digest('hex'),productionHookSHA256:crypto.createHash('sha256').update(hooks).digest('hex'),flags:[],observedRequests:ctx.renderWaitAttribution?.requests,expectedRequestsWithoutOptIn:0}));
assert.equal(ctx.renderWaitAttribution?.requests||0,0,'integration requires opt-in instrumentation: default CLI records a wait without any flag');
