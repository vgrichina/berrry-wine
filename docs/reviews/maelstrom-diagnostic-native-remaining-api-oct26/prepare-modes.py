import pathlib,hashlib,json,time
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';P=R/'test/maelstrom-diagnostic-canonical-native.cjs';s=P.read_text()
assert hashlib.sha256(P.read_bytes()).hexdigest()=='ddb0d889541d32dddd881b168d6a69a85610050c1d56679765cec1c1531c65e2'
def replace(a,b):
 global s
 assert s.count(a)==1,a
 s=s.replace(a,b)
replace("const allowed=['errno0'","const allowed=['completion-code16','completion-block','completion-uop','errno0'")
replace('const mod=new WebAssembly.Module(bytes);','let completionModeArmed=false,completionModeChanges=0;\nconst mod=new WebAssembly.Module(bytes);')
replace("if(item.module==='host'&&item.name==='socket_event'&&args[0]===3)return 0;", """if(item.module==='host'&&item.name==='socket_event'&&args[0]===3){
   if(completionModeArmed){
    completionModeArmed=false;completionModeChanges++;
    if(scenario==='completion-block')e.set_block_exec(1);
    else if(scenario==='completion-uop')e.set_uop(1);
    else {const t=e.win16_bridge_frame_begin();assert(t!==0n);assert.equal(e.win16_bridge_stack_enter(t),1);assert.equal(e.is_code16(),1);}
   }
   return 0;
  }""")
replace("run('select-completion');assert.equal(e.get_eax(),1);", "completionModeArmed=enabled&&scenario.startsWith('completion-');\n run('select-completion');assert.equal(e.get_eax(),1);")
replace("if(enabled&&scenario==='return-without-call'){", """if(enabled&&scenario.startsWith('completion-')){
  assert.equal(completionModeChanges,1,'one real select host-event transition');
  const reason={'completion-code16':1,'completion-block':2,'completion-uop':3}[scenario];
  const modes={'completion-code16':1,'completion-block':2,'completion-uop':4}[scenario];
  const d=diag();assert.equal(d.status,5);assert.equal(d.rejectReason,reason);assert.equal(d.rejectModes,modes);
  assert.equal(d.rejectExpectedRet,HEAD);assert.equal(d.rejectObservedRet,HEAD);assert.equal(d.rejectPhase,3);
  assert.equal(d.rejectCompletions,1);assert.equal(d.rejectFault,0);assert.equal(d.rejectActive,0);assert.equal(d.rejectCapped,0);
  const frozen=diag();e.mne_start();assert.deepEqual(diag(),frozen,'single-shot immutable compiled completion rejection');
  return {states,starting};
 }
 if(enabled&&scenario==='return-without-call'){""")
p=R/'test/maelstrom-diagnostic-completion-modes-native.cjs';p.write_text(s)
(O/'completion-mode-derivation.json').write_text(json.dumps(dict(at=time.time(),baseFixtureSHA256=hashlib.sha256(P.read_bytes()).hexdigest(),derivedFixtureSHA256=hashlib.sha256(p.read_bytes()).hexdigest(),derivationSHA256=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),scope='only real select socket_event host callback uses existing public mode exports before compiled completion observer; no module/source/ABI/private-global mutation',cases=['completion-code16','completion-block','completion-uop'],preserved='exact base fixture remains unchanged; disjoint initialized spans/counters and native production dispatch'),indent=2))
print(json.dumps(dict(path=str(p),sha256=hashlib.sha256(p.read_bytes()).hexdigest())))
