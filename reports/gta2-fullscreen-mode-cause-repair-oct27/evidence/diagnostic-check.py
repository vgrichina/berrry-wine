from control import *
import struct,re
rows=json.loads((O/'pe-exports.json').read_text()); checks=[]
def bytes_at(row,va,n):
 b=pathlib.Path(row['path']).read_bytes();rva=va-int(row['imageBase'],16)
 for s in row['sections']:
  if s['rva']<=rva<s['rva']+s['rawSize']:return b[s['raw']+rva-s['rva']:s['raw']+rva-s['rva']+n]
 raise ValueError(hex(va))
def check(name,ok):assert ok,name;checks.append(name)
g=rows[0];v=next(r for r in rows if r['path'].endswith('Dmavideo.dll'))
check('original executable pinned',g['sha256']=='97ad743b6ec9ea1be95282053c3127084acd764a7f37a3e57e2268af52d02ae3')
check('exact exported Vid_SetMode entry',next(e for e in v['exports'] if e['name']=='Vid_SetMode')['va']=='0x1001d30')
check('caller invokes resolved Vid_SetMode',bytes_at(g,0x5ca695,6)==bytes.fromhex('ff15cc696100'))
check('caller branches on actual EAX return',bytes_at(g,0x5ca69b,4)==bytes.fromhex('85c07418'))
check('printed argument is mode in ESI',bytes_at(g,0x5ca69f,1)==b'\x56')
check('printed argument is NOT EAX HRESULT',bytes_at(g,0x5ca69f,1)!=b'\x50')
check('error ID1037 passed by caller',bytes_at(g,0x5ca6aa,5)==bytes.fromhex('680d040000'))
check('format error string is fullscreen mode',g['strings'][0]['text']=='Failed to set fullscreen videomode: %d')
check('SetDisplayMode HRESULT failure collapses to one',bytes_at(v,0x1002122,12)==bytes.fromhex('ff515485c07412b801000000'))
check('GetAttachedSurface HRESULT failure collapses to same one',bytes_at(v,0x1002272,12)==bytes.fromhex('ff513085c07412b801000000'))
check('ambiguous failure controls have distinct COM slots',bytes_at(v,0x1002122,3)!=bytes_at(v,0x1002272,3))
check('v4 IID exact words',bytes_at(v,0x100a130,16)==bytes.fromhex('9a50599cbd39d1118c4a00c04fd930c5'))
trace=(O/'original/guest.stdout').read_text();cmd=json.loads((O/'original/guest-command.json').read_text())['argv']
check('retained dialog establishes only high-level failure','Failed to set fullscreen videomode: 2' in trace)
check('actual invocation suppresses unconditional API lines','--quiet-api' in cmd and not any(a.startswith('--trace-api') for a in cmd))
markers=[int(x,16) for x in re.findall(r'\[i32\] (0x0ed[0-9a-f]+)',trace)];raw=[(x&0xffff)>>8 for x in markers]
check('enumeration callbacks continued for all actual raw mode rows',raw==list(range(19))+list(range(21,30)) and all(x&255==1 for x in markers))
check('retained ordinary error-dismissal exit is1037','[Exit] code=1037' in trace)
for key,path in [('module',None),('compat',None)]:
 m=json.loads((O/'original-receipt.json').read_text())['module'];m=m if key=='module' else m['compat'];p=pathlib.Path(m['local']);b=p.read_bytes();check(key+' preserved original module untouched',len(b)==m['bytes'] and sha(b)==m['sha256'])
save('diagnostic-checks.json',dict(kind='static PE/source evidence consistency; no guest execution, compilation, or API behavioral acceptance',passed=len(checks),checks=checks,rejectedControls=['The formatted number is an HRESULT','Successful EnumDisplayModes callbacks prove SetDisplayMode success','A generic Vid_SetMode failure identifies which DirectDraw call failed','A DDSCAPS2 extended-word rejection proves those guest words were nonzero']))
print('PASS',len(checks),'static evidence assertions, including distinct failure-path controls; no emulator behavioral acceptance')
