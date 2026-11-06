'use strict';
// Microsoft glPushAttrib/glFog semantics; pixels use equations, not runtime mirrors.
module.exports=String.raw`
  // Public fog-stack contract, independent analytical pixels and state values.
  const fogChecks=[],fogFailures=[],fogPixels=[],fogLeases=[];
  function fogEq(name,actual,expected,tolerance=0) {
    const ok=tolerance?actual.length===expected.length&&actual.every((x,i)=>Math.abs(x-expected[i])<=tolerance):JSON.stringify(actual)===JSON.stringify(expected);
    fogChecks.push({name,actual,expected,tolerance,pass:ok});
    if(!ok)fogFailures.push(name);
  }
  const fq=(p,n=1)=>{call('glGetFloatv',[p,out]);return Array.from(new Float32Array(memory.buffer,wa(out),n));};
  const A={enabled:1,mode:0x2601,density:.25,start:0,end:1,index:3.5,color:[0,0,1,1]};
  const B={enabled:0,mode:0x800,density:2,start:.25,end:2,index:7.25,color:[0,1,0,.5]};
  const C={enabled:1,mode:0x801,density:1,start:-1,end:3,index:11.5,color:[1,1,0,.25]};
  function fogSet(s){
    call(s.enabled?'glEnable':'glDisable',[0xb60]);call('glFogi',[0xb65,s.mode]);
    for(const [p,k] of [[0xb62,'density'],[0xb63,'start'],[0xb64,'end'],[0xb61,'index']])call('glFogf',[p,s[k]],[1]);
    call('glFogfv',[0xb66,vec(s.color)]);
  }
  function fogState(){return {enabled:call('glIsEnabled',[0xb60]),mode:query(0xb65)[0],density:fq(0xb62)[0],start:fq(0xb63)[0],end:fq(0xb64)[0],index:fq(0xb61)[0],color:fq(0xb66,4)};}
  function fogDraw(name,s,hold=false){
    call('glClearColor',[0,0,0,1],[0,1,2,3]);call('glClear',[0x4000]);color([1,0,0,1]);
    delay=queued&&hold;call('glBegin',[4]);for(const v of [[-.8,-.8,-.5],[.8,-.8,-.5],[0,.8,-.5]])call('glVertex3f',v,[0,1,2]);call('glEnd');
    if(queued&&hold){
      assert(encoder.snapshot().glQueued>0);encoder._submit();assert.strictEqual(delayed.length,1);
      const item=encoder.buffers.find(item=>item.seq===delayed[0].seq),saved=Buffer.from(item.bytes.subarray(0,item.used));
      fogSet(B);call('glPopAttrib');
      fogEq(name+' immutable queued bytes',Buffer.from(item.bytes.subarray(0,item.used)).equals(saved),true);
      fogLeases.push({name,bytes:saved.length,sha256:crypto.createHash('sha256').update(saved).digest('hex'),immutable:true});
      encoder.releaseHeld();
    }
    call('glFinish');if(encoder)encoder.fence();
    const entry=e.gl_sw_entry()>>>0;assert(entry,'production software drawable');
    const pitch=dv.getUint16(entry+18,true),height=dv.getUint16(entry+14,true),dib=dv.getUint32(entry+20,true);
    const p=dv.getUint32(dib+(height-1-32)*pitch+32*4,true),actual=[p>>>16&255,p>>>8&255,p&255];
    let factor=1;
    if(s.enabled)factor=s.mode===0x2601?(s.end-.5)/(s.end-s.start):s.mode===0x800?Math.exp(-s.density*.5):Math.exp(-Math.pow(s.density*.5,2));
    factor=Math.max(0,Math.min(1,factor));
    const expected=s.color.slice(0,3).map((v,i)=>Math.round(255*((i===0?1:0)*factor+v*(1-factor))));
    fogEq(name+' pixel',actual,expected,2);fogPixels.push({name,actual,expected,factor});
  }
  function fogGetterVariants(s,label){
    for(const [kind,width,read] of [['glGetFloatv',4,'getFloat32'],['glGetDoublev',8,'getFloat64'],['glGetBooleanv',1,'getUint8']]) {
      for(const [p,values] of [[0xb62,[s.density]],[0xb63,[s.start]],[0xb64,[s.end]],[0xb61,[s.index]],[0xb65,[s.mode]],[0xb66,s.color],[0xb60,[s.enabled]]]) {
        new Uint8Array(memory.buffer,wa(out),64).fill(0xa5);call(kind,[p,out+8]);
        const actual=values.map((_,i)=>width===1?dv[read](wa(out)+8+i):dv[read](wa(out)+8+i*width,true));
        fogEq(label+' '+kind+' '+p,actual,width===1?values.map(x=>Number(x!==0)):values);
        assert(new Uint8Array(memory.buffer,wa(out),8).every(x=>x===0xa5),'getter prefix canary');
        assert(new Uint8Array(memory.buffer,wa(out)+8+values.length*width,56-values.length*width).every(x=>x===0xa5),'getter suffix canary');
      }
    }
  }
  bind(a);call('glViewport',[0,0,64,64]);call('glDisable',[0xbd0]);
  call('glMatrixMode',[0x1700]);call('glLoadIdentity');call('glMatrixMode',[0x1701]);call('glLoadIdentity');
  for(const s of [A,B,{...B,enabled:1},C]){fogSet(s);fogEq('setter public state '+s.mode,fogState(),s);fogDraw('analytical control '+s.mode,s);}
  for(const mask of [0x80,0x2000,8,64,0x8000,0x80|64,0xfffff]) {
    fogSet(A);call('glHint',[0xc54,0x1101]);call('glPushAttrib',[mask]);
    fogSet(B);call('glHint',[0xc54,0x1102]);call('glPopAttrib');
    const expected=mask&0x80?A:{...B,enabled:mask&0x2000?A.enabled:B.enabled};
    fogEq('mask '+mask+' public state',fogState(),expected);fogGetterVariants(expected,'mask '+mask);
    fogEq('mask '+mask+' separate fog hint',query(0xc54)[0],mask&0x8000?0x1101:0x1102);
    fogDraw('mask '+mask,expected);
  }
  fogSet(A);call('glPushAttrib',[0x2000]);fogSet(B);fogDraw('enable saved while changed state rendered',B);
  call('glPopAttrib');fogEq('enable after intervening rendering',fogState(),{...B,enabled:1});fogDraw('enable restored after intervening rendering',{...B,enabled:1});
  fogSet(B);call('glPushAttrib',[0x2000]);fogSet(A);call('glPopAttrib');
  fogEq('enable restores disabled without restoring parameters',fogState(),{...A,enabled:0});fogDraw('enable restores disabled',{...A,enabled:0});
  fogSet(A);call('glPushAttrib',[0x80]);fogSet(B);call('glPushAttrib',[0x2000]);fogSet(C);
  call('glPopAttrib');fogEq('mixed nested enable mask',fogState(),{...C,enabled:0});
  call('glPopAttrib');fogEq('mixed nested fog mask',fogState(),A);
  fogSet(A);call('glPushAttrib',[0x80]);fogSet(B);call('glPushAttrib',[0x80]);fogSet(C);
  call('glPopAttrib');fogEq('nested inner public state',fogState(),B);fogDraw('nested inner',B);
  call('glPopAttrib');fogEq('nested outer public state',fogState(),A);fogDraw('nested outer',A);
  const fogOther=call('wglCreateContext',[0]);assert(fogOther);fogSet(A);call('glPushAttrib',[0x80]);fogSet(B);
  bind(fogOther);fogSet(C);call('glPushAttrib',[0x2000]);fogSet(B);
  bind(a);call('glPopAttrib');fogEq('first context owns fog stack',fogState(),A);
  bind(fogOther);call('glPopAttrib');fogEq('second context owns enable stack',fogState(),{...B,enabled:C.enabled});
  bind(a);call('wglDeleteContext',[fogOther]);fogDraw('first context restored pixel',A);
  // Deleting a context with live fog/lighting sidecars must leave the survivor intact.
  for(const mask of [0x80,64,0x80|64]){
    const abandoned=call('wglCreateContext',[fogDc]);assert(abandoned);bind(abandoned);fogSet(B);
    call('glPushAttrib',[mask]);fogSet(C);call('glPushAttrib',[mask]);
    bind(a);fogEq('delete nonempty context '+mask,call('wglDeleteContext',[abandoned]),1);
    fogEq('surviving context state '+mask,fogState(),A);fogEq('surviving context depth '+mask,query(0xbb0)[0],0);
  }
  // Existing complete lighting snapshots must coexist with fog snapshots.
  function materialQuery(face,p){call('glGetMaterialfv',[face,p,out]);return Array.from(new Float32Array(memory.buffer,wa(out),4));}
  function lightQuery(p){call('glGetLightfv',[0x4000,p,out]);return Array.from(new Float32Array(memory.buffer,wa(out),4));}
  fogSet({...A,enabled:0});call('glEnable',[0xb50]);call('glDisable',[0x4000]);
  for(const p of [0x1200,0x1201,0x1202])call('glMaterialfv',[0x408,p,vec([0,0,0,1])]);
  call('glLightModelfv',[0xb53,vec([0,0,0,1])]);call('glMaterialfv',[0x404,0x1600,vec([1,0,0,1])]);call('glMaterialfv',[0x405,0x1600,vec([0,1,0,1])]);
  call('glLightfv',[0x4000,0x1201,vec([.25,.5,.75,1])]);call('glLightfv',[0x4000,0x1203,vec([1,2,3,1])]);
  call('glLightModeli',[0xb51,1]);call('glLightModeli',[0xb52,1]);
  call('glPushAttrib',[64]);
  call('glMaterialfv',[0x408,0x1600,vec([0,0,1,1])]);call('glLightfv',[0x4000,0x1201,vec([1,0,0,1])]);call('glLightfv',[0x4000,0x1203,vec([-1,-2,-3,0])]);
  call('glLightModeli',[0xb51,0]);call('glLightModeli',[0xb52,0]);fogSet(B);call('glPopAttrib');
  fogEq('lighting sidecar front emission',materialQuery(0x404,0x1600),[1,0,0,1]);fogEq('lighting sidecar back emission',materialQuery(0x405,0x1600),[0,1,0,1]);
  fogEq('lighting sidecar diffuse',lightQuery(0x1201),[.25,.5,.75,1]);fogEq('lighting sidecar position',lightQuery(0x1203),[1,2,3,1]);
  fogEq('lighting sidecar viewer',query(0xb51)[0],1);fogEq('lighting sidecar two side',query(0xb52)[0],1);fogEq('lighting keeps changed fog',fogState(),B);fogDraw('lighting restored emission with changed fog',B);
  fogSet(A);call('glPushAttrib',[0x80|64]);fogSet(B);call('glMaterialfv',[0x404,0x1600,vec([0,1,0,1])]);call('glPopAttrib');
  fogEq('combined lighting and fog state',fogState(),A);fogDraw('combined fog and restored emission',A);
  call('glDisable',[0xb50]);
  // Capacity is the public implementation limit; overflow must not consume a pop.
  const capacity=query(0xd35)[0];assert(Number.isInteger(capacity)&&capacity>=16,'documented attribute-stack minimum');
  fogEq('initial public stack depth',query(0xbb0)[0],0);
  for(let i=0;i<capacity;i++){fogSet({...A,index:i});call('glPushAttrib',[0x80]);}
  fogEq('accepted public capacity depth',query(0xbb0)[0],capacity);fogEq('accepted capacity no error',err(),0);
  fogSet(C);const full=fogState();call('glPushAttrib',[0x80]);
  fogEq('overflow error',err(),0x503);fogEq('overflow unchanged state',fogState(),full);fogEq('overflow unchanged depth',query(0xbb0)[0],capacity);
  for(let i=capacity-1;i>=0;i--){call('glPopAttrib');fogEq('accepted frame '+i,fogState(),{...A,index:i});}
  fogEq('all accepted frames popped',query(0xbb0)[0],0);const empty=fogState();call('glPopAttrib');
  fogEq('underflow error',err(),0x504);fogEq('underflow unchanged state',fogState(),empty);fogEq('underflow depth',query(0xbb0)[0],0);
  if(queued){fogSet(A);call('glPushAttrib',[0x80]);fogSet(C);fogDraw('queued captured exponential squared fog',C,true);fogEq('pop after queued draw',fogState(),A);fogDraw('queued later restored fog',A);}
  fogSet(A);const beforeIllegal=fogState(),depthBefore=query(0xbb0)[0];
  call('glBegin',[0]);call('glPushAttrib',[0x80]);call('glPopAttrib');call('glEnd');
  fogEq('Begin rejects stack commands',err(),0x502);fogEq('Begin rejected stack commands preserve state',fogState(),beforeIllegal);fogEq('Begin rejected stack depth',query(0xbb0)[0],depthBefore);
  fogEq('fog qualification final error',err(),0);
  const fogWorker=encoder?.snapshot();
  if(fogWorker){assert(fogWorker.replayCommands>0);fogEq('actual queued renderer zero fallback',fogWorker.fallbacks,0);}
  const fogReport={queued,worker:fogWorker,leases:fogLeases,module:{bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')},checks:fogChecks,pixels:fogPixels,failures:fogFailures};
  if(process.env.GL_FOG_RESULT)fs.writeFileSync(process.env.GL_FOG_RESULT,JSON.stringify(fogReport,null,2)+'\n');
  console.log('PUBLIC_FOG_ATTRIB',JSON.stringify({queued,module:fogReport.module,checks:fogChecks.length,pixels:fogPixels.length,failures:fogFailures}));
  assert.deepStrictEqual(fogFailures,[],'public fog attribute contract');
  fogSet({...A,enabled:0});call('glHint',[0xc54,0x1100]);call('glEnable',[0xbd0]);
`;
