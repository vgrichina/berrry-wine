'use strict';
// Passive capability observation, never an input adapter or delivery ACK.
// Retain the actual installed import scopes rather than calling getImports
// again (which would create a different host context).
function installNativeRouteObserver(root,Wine=root.WineAssembly) {
  if(root.__gltronNativeRoutes)throw Error('native route observer already installed');
  const routes=root.__gltronNativeRoutes=[];
  const p=Wine.prototype,original=p.getImports;
  p.getImports=function(){const imports=original.apply(this,arguments);
    routes.push({wine:this,ctx:this.hostCtx,host:imports.host});return imports;};
}
function inspectNativeRoute(root,wine) {
  const rows=(root.__gltronNativeRoutes||[]).filter(r=>r.wine===wine);
  return {at:Date.now(),processId:wine.processId,running:!!wine.running,stopped:!!wine._stopped,
    guestWorker:!!wine.guestWorker,scopes:rows.map(r=>({
      currentContext:r.ctx===wine.hostCtx,
      guardedInput:!!r.ctx?.guardedInput,
      nativeInputActor:typeof r.ctx?.nativeInputActor==='function',
      tokenImport:typeof r.host?.check_input_token==='function',
      tokenImportSource:r.host?.check_input_token?.toString()??null,
      consumedImport:typeof r.host?.input_consumed==='function'})),
    nativeInputQualified:false,downEffects:0,
    reason:'Capability observation cannot establish native API return or physical UP'};
}
function requireNativeRoute(audit) {
  if(!audit.running||audit.stopped||!audit.guestWorker||!audit.scopes.length||
    audit.scopes.some(s=>!s.currentContext||!s.guardedInput||!s.nativeInputActor||!s.tokenImport||!s.consumedImport))
    throw Error('NATIVE_INPUT_UNAVAILABLE: actual browser import scope lacks guarded native actor/token authority; no DOWN permitted');
  // Even an installed capability must pass the actual same-path qualification.
  throw Error('NATIVE_INPUT_UNQUALIFIED: capability presence is not native API-return/physical-UP proof');
}
module.exports={installNativeRouteObserver,inspectNativeRoute,requireNativeRoute};
