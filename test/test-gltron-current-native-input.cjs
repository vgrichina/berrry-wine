'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {installNativeRouteObserver,inspectNativeRoute,requireNativeRoute}=require('../tools/gltron-current-native-input.cjs');
class Wine {getImports(){this.hostCtx={};return {host:{check_input_token:()=>0,input_consumed:()=>0}};}}
const root={},w=new Wine();w.running=true;w.guestWorker={};w.processId=1;
installNativeRouteObserver(root,Wine);const actual=w.getImports();
assert.equal(root.__gltronNativeRoutes[0].host,actual.host);
const audit=inspectNativeRoute(root,w);assert.equal(audit.scopes[0].guardedInput,false);
assert.equal(audit.scopes[0].nativeInputActor,false);assert.match(audit.scopes[0].tokenImportSource,/=>0/);
assert.throws(()=>requireNativeRoute(audit),/NATIVE_INPUT_UNAVAILABLE/);
const capable={running:true,stopped:false,guestWorker:true,scopes:[{currentContext:true,guardedInput:true,nativeInputActor:true,tokenImport:true,consumedImport:true}]};
assert.throws(()=>requireNativeRoute(capable),/UNQUALIFIED/,'capability is never native proof');
// Execute the real current selector, not a duplicated expected selector.
const source=fs.readFileSync('lib/host-imports.js','utf8');
const start=source.indexOf('  const _glGpsBackend = () => {'),end=source.indexOf('  let _glGpsBridgeObj',start);
assert(start>0&&end>start);
const select=query=>vm.runInNewContext(source.slice(start,end)+';_glGpsBackend()',{
  ctx:{},location:{search:query},URLSearchParams});
assert.equal(select('?gl-renderer=software'),'webgl','legacy selector does not select GPS software');
assert.equal(select('?gl-gps=software'),'software');assert.equal(select('?gl-gps=webgl'),'webgl');
assert.throws(()=>select('?gl-gps=legacy'));
console.log('PASS actual import scope capability refusal and current GPS backend selector (legacy query ignored)');
