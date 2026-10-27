from pathlib import Path
import json,hashlib
r=Path('/tmp/airstrike-directinput-atomic-independent-accept-oct27')
s=(r/'repo/src/09a8-handlers-directx.wat').read_text()
controls={}
start=s.index('(func $dx_free ');end=s.index(';; Generic IUnknown',start)
body=s[start:end]
needle='(drop (call $host_di_keyboard_buffer (local.get $entry_wa) (i32.const 1) (i32.const 0)))'
assert body.count(needle)==1
mutated=s[:start]+body.replace(needle,'(nop)')+s[end:]
p=r/'ops/control-release-no-host-reset.wat';p.write_text(mutated)
controls['release-no-host-reset']={'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'recipe':'in exact dx_free form replace single keyboard host op1 drop expression with (nop)','expected':'COM final Release must reject surviving FIFO'}
# No activation while returning DI_OK: valid WAT but a silent input loss defect.
start=s.index('(func $handle_IDirectInputDevice_Acquire ');end=s.index('(func $handle_IDirectInputDevice_Unacquire ',start)
body=s[start:end]
needle='(call $host_di_keyboard_buffer (local.get $entry) (i32.const 10) (i32.const 0))'
assert body.count(needle)==1
mutated=s[:start]+body.replace(needle,'(i32.const 0)')+s[end:]
p=r/'ops/control-acquire-no-activation.wat';p.write_text(mutated)
controls['acquire-no-activation']={'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'recipe':'in exact Acquire form replace single op10 activation call with i32.const 0','expected':'Worker partition at cut0 rejects count0 instead of four edges'}
(r/'ops/control-recipes.json').write_text(json.dumps(controls,indent=2)+'\n')
print('two bounded source-copy controls prepared; candidate files unchanged')
