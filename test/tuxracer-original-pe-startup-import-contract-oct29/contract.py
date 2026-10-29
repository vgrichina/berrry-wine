"""Contract report, stopping classification at demonstrated source-backed blockers."""
from analyze import *
import re

def fnv(name):
 h=0x811c9dc5
 for c in name.encode('ascii'):h=((h^c)*0x01000193)&0xffffffff
 return h

def body(text,name):
 start=text.index('(func $'+name+' ');level=0;quoted=False
 # The selected bodies contain no block comments; discard line comments first.
 text='\n'.join(l.split(';;')[0] for l in text[start:].splitlines())
 for i,c in enumerate(text):
  if c=='"':quoted=not quoted
  if quoted:continue
  level+=(c=='(')-(c==')')
  if level==0:return text[:i+1]
 raise ValueError('unbalanced WAT function')

def build():
 modules=collect();table=json.loads((BASE/'src/api_table.json').read_text());api={r['name']:r for r in table};edges=[]
 hashsrc=(BASE/'src/01b-api-hashes.generated.wat').read_text()
 # Generated hash data is serialized as little-endian byte escapes.
 raw=bytes(int(x,16) for x in re.findall(r'\\([0-9a-fA-F]{2})',hashsrc));pairs=[struct.unpack_from('<II',raw,i) for i in range(0,len(raw)-7,8)]
 hashrows=dict(pairs)
 generated=(BASE/'src/09b2-dispatch-table.generated.wat').read_text()
 for module,m in modules.items():
  for d in m['imports']:
   provider=d['dll'].lower()
   for sym in d['symbols']:
    edge={'from':module,'dll':d['dll'],**sym}
    if provider in modules:
     matches=[e for e in modules[provider]['exports'] if (sym.get('name') in e['names'] if 'name' in sym else sym['ordinal']==e['ordinal'])]
     edge.update(route='bundled guest export',export=matches[0] if matches else None)
     if not matches:raise ValueError('bundled export missing')
    else:
     row=api.get(sym.get('name'));h=fnv(sym['name']) if 'name' in sym else None;actual=hashrows.get(h,65535)
     edge.update(route='emulator API thunk',hash=h,apiId=actual,tableRow=row,status='handler semantics NOT audited after decisive blocker')
     if not row:
      assert actual==65535
      edge['status']='unresolved API hash -> 65535 -> handle_fallback trap (if called); data exports require separate semantics'
     else:
      assert actual==row['id']
      arm=generated.split(') ;; '+str(actual)+': ',1)[1].split(') ;; ',1)[0]
      call=next(l.strip() for l in arm.splitlines()[1:] if '(call ' in l)
      edge['generatedCall']=call
      if '(call $handle_gl_unimplemented ' in call:edge['status']='gl_unimplemented fail-fast (if called)'
      elif row.get('handler')=='gl_unimplemented':edge['status']='generated dispatch overrides table handler; '+call.split(' ')[1]
    edges.append(edge)
 gl=body((BASE/'src/09a8b-handlers-opengl.wat').read_text(),'handle_gl_unimplemented')
 fallback=body((BASE/'src/09a6-handlers-crt.wat').read_text(),'handle_fallback')
 assert '$host_crash_unimplemented' in gl and '(unreachable)' in gl
 assert '$host_crash_unimplemented' in fallback and '(unreachable)' in fallback
 lookup=body((BASE/'src/10-helpers.wat').read_text(),'lookup_api_id');assert '(i32.const 0xFFFF)' in lookup
 dispatch=body((BASE/'src/09b2-dispatch-table.generated.wat').read_text(),'dispatch_api_table');assert '$handle_fallback' in dispatch
 first=next(e for e in edges if e['from']=='tuxracer.exe' and e.get('status','').startswith('gl_unimplemented fail-fast'))
 missing=next(e for e in edges if e['from']=='tuxracer.exe' and e.get('name')=='gluScaleImage')
 assert first['name']=='glVertex2dv' and missing['apiId']==65535
 return {'main':MAIN,'modules':modules,'edges':edges,'firstExeFailFastInDescriptorOrder':first,'firstExeUnresolvedInDescriptorOrder':missing,'firstActuallyExecutedFailure':'UNKNOWN: TLS/DllMain/CRT startup and branch order not executed','dynamicGetProcAddress':'UNKNOWN','computedTclClosure':'UNKNOWN','gameplay':'NOT TESTED','classificationStoppedAt':'decisive direct EXE fail-fast and missing GLU import; other API rows are inventory only','sourceBodies':{'gl_unimplemented':gl,'fallback':fallback,'lookup':lookup,'dispatch':dispatch}}
if __name__=='__main__':
 result=build();(OUT/'contract-evidence.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'edges':len(result['edges']),'modules':len(result['modules']),'firstFailFast':result['firstExeFailFastInDescriptorOrder']['name'],'firstUnresolved':result['firstExeUnresolvedInDescriptorOrder']['name']}))
