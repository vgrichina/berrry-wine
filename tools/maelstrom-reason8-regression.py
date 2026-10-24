#!/usr/bin/env python3
"""Offline source-driven interpretation; no wasm, native code, or guest execution."""
import collections, copy, hashlib, json, pathlib, re, struct

ROOT = pathlib.Path(__file__).resolve().parents[1]
E = ROOT/'docs/re-notes/maelstrom-reason8-boundary-cause-20261024-evidence'
def read(path):
    with open(path, 'rb') as f:
        return b''.join(iter(lambda: f.read(8192), b''))
def source(name): return read(E/name).decode()
def parse(text):
    tokens = iter(re.findall(r'\(|\)|[^\s()]+', re.sub(r';;[^\n]*', '', text)))
    def one(t):
        if t != '(': return t
        result = []
        for t in tokens:
            if t == ')': return result
            result.append(one(t))
        raise ValueError('unclosed WAT')
    return [one(t) for t in tokens]

class Jump(Exception): pass
class Returned(Exception): pass
class WAT:
    """Small fail-closed evaluator for retained pre-execution/parking forms only."""
    def __init__(self):
        self.g=collections.defaultdict(int); self.l=collections.defaultdict(int)
        self.mem=collections.defaultdict(int); self.calls=[]; self.now=100; self.ms=200
        self.ready=0; self.funcs={}
    def seq(self, xs):
        result=0
        for x in xs: result=self.ev(x)
        return result
    def ev(self, x):
        if not isinstance(x,list): return x
        op,*a=x
        if op=='i32.const': return int(a[0],0)&0xffffffff
        if op in ('global.get','local.get'): return (self.g if op[0]=='g' else self.l)[a[0]]
        if op in ('global.set','local.set'):
            (self.g if op[0]=='g' else self.l)[a[0]]=self.ev(a[1]); return 0
        if op in ('then','else'): return self.seq(a)
        if op=='if': return self.ev(a[1] if self.ev(a[0]) else (a[2] if len(a)>2 else ['then']))
        if op in ('block','loop'):
            label,*body=a
            for _ in range(100):
                try: return self.seq(body)
                except Jump as j:
                    if j.args[0]!=label: raise
                    if op=='block': return 0
            raise AssertionError('loop bound')
        if op=='br': raise Jump(a[0])
        if op=='br_if':
            if self.ev(a[1]): raise Jump(a[0])
            return 0
        if op=='return': raise Returned()
        if op=='drop': self.ev(a[0]); return 0
        if op in ('i32.load','i32.store'):
            offset=int(a.pop(0).split('=')[1]) if a and isinstance(a[0],str) and a[0].startswith('offset=') else 0
            addr=self.ev(a[0])+offset
            if op=='i32.load': return self.mem[addr]
            self.mem[addr]=self.ev(a[1])&0xffffffff; return 0
        if op=='call':
            name,*args=a; args=[self.ev(v) for v in args];self.calls.append(name)
            if name in self.funcs:
                f=self.funcs[name];params=[v[1] for v in f[2:] if isinstance(v,list) and v[0]=='param']
                saved=self.l;self.l=collections.defaultdict(int,zip(params,args))
                try: return self.seq([v for v in f[2:] if v[0] not in ('param','local')])
                except Returned: return 0
                finally: self.l=saved
            if name=='$vsock_filter_set': return self.ready
            if name=='$vsock_timeval_ms': return self.ms
            if name=='$host_get_ticks': return self.now
            if name in ('$vsock_pump','$gl32'): return 0
            raise AssertionError('unsupported call '+name)
        if op.startswith('i32.'):
            v=[self.ev(y) for y in a];u=v[0];w=v[1] if len(v)>1 else 0
            signed=lambda n:n if n<0x80000000 else n-0x100000000
            operations={'eqz':lambda:int(u==0),'eq':lambda:int(u==w),'ne':lambda:int(u!=w),
                'or':lambda:u|w,'and':lambda:u&w,'add':lambda:(u+w)&0xffffffff,
                'sub':lambda:(u-w)&0xffffffff,'shl':lambda:(u<<(w&31))&0xffffffff,
                'ge_u':lambda:int(u>=w),'lt_u':lambda:int(u<w),
                'lt_s':lambda:int(signed(u)<signed(w))}
            assert op[4:] in operations, op
            return operations[op[4:]]()
        raise AssertionError('unsupported WAT '+op)
    def gates(self, forms):
        try: self.seq(copy.deepcopy(forms)); return 'dispatch-permitted'
        except Jump as j:
            assert j.args==('$halt',); return 'halt'

def imports(b):
    u16=lambda o:struct.unpack_from('<H',b,o)[0]
    u32=lambda o:struct.unpack_from('<I',b,o)[0]
    pe=u32(60);opt=pe+24;sec=opt+u16(pe+20)
    sections=[struct.unpack_from('<IIII',b,sec+i*40+8) for i in range(u16(pe+6))]
    def off(r):
        for size,va,n,raw in sections:
            if va<=r<va+max(size,n): return raw+r-va
        raise AssertionError('unmapped RVA')
    def string(r):
        p=off(r);return b[p:b.index(0,p)].decode()
    d=off(u32(opt+104));result=[]
    while u32(d+16):
        ilt=u32(d) or u32(d+16);name=string(u32(d+12));j=0
        while (entry:=u32(off(ilt)+4*j)):
            result.append(dict(dll=name,ordinal=entry&65535 if entry>>31 else None,
                               name=None if entry>>31 else string(entry+2),iat=u32(d+16)+4*j));j+=1
        d+=20
    return result

def main():
    provenance=json.loads(source('provenance.json'))
    for r in provenance:
        assert hashlib.sha256(read(E/r['file'])).hexdigest()==r['sha256'],r['file']
    log=source('capture.log')
    rows=[json.loads(l.split('] ',1)[1]) for l in log.splitlines() if l.startswith('[MAELSTROM-HEAD] ')]
    pairs=[(rows[i],rows[i+1]) for i in range(1,13,2)]
    base=int(re.search(r'thunk_base: 0x([\da-f]+)',log)[1],16)
    start=int(re.search(r'DLL: SDL.dll .*?thunks=(\d+)',log)[1])
    end=int(re.search(r'DLL: SDL_net.dll .*?thunks=(\d+)',log)[1])
    entries=imports(read(E/'SDL_net.dll'))
    allocated=[e for e in entries if e['dll'].lower() not in ('sdl.dll','msvcrt.dll')]
    assert len(allocated)==end-start # same loaded dependencies as captured startup
    eip=pairs[-1][0]['state']['eip'];slot=(eip-base)//8
    api=allocated[slot-start]
    assert (eip-base)%8==0 and api['dll']=='WSOCK32.dll'
    ordinal=api['ordinal']
    mapping=re.search(r'\(local.get \$ordinal\) \(i32.const '+str(ordinal)+r'\).*?lookup_api_id "([^"]+)"',source('ordinals.wat'))
    assert mapping and mapping[1]=='select'
    assert api['iat']==0x2050 and slot==2079
    # Neighbor ordinal is a rejecting mapping control, not the same API.
    assert allocated[slot-start-1]['ordinal']!=ordinal
    gates=parse(source('gates.wat'))
    def machine(state):
        m=WAT();m.g.update({'$'+k:v for k,v in state.items() if k in ('eip',)})
        m.g.update({'$yield_reason':state['yieldReason'],'$yield_flag':state['yieldFlag'],
                    '$dbg_any':1,'$bp_addr':state['bp'],'$HIT_COUNT_BASE':0x2000,
                    '$hit_count_n':2,'$reg_base':0x1000})
        m.mem.update({0x2000:0x7a3362,0x2008:0x7a3366})
        return m
    halts=[]
    for before,after in pairs:
        assert before['batch']==after['batch'] and after['ran']
        s=before['state'];t=after['state']
        assert s['eip']!=0x7a3362 and t['eip']!=0x7a3362
        assert s['headEntries']==t['headEntries']==s['interiorEntries']==t['interiorEntries']==0
        if s['yieldReason']==8:
            assert s==t
            m=machine(s);assert m.gates(gates)=='halt'
            assert m.g['$last_run_halt']==t['halt']==4 and m.mem[0x2004]==m.mem[0x200c]==0
            assert not m.calls # guard stops before decode, thunk dispatch or guest instructions
            # Counterfactual: clearing reason8 permits the thunk to be dispatched.
            m.g['$yield_reason']=0;assert m.gates(gates)=='dispatch-permitted'
            halts.append(before['batch'])
        else: assert s['yieldReason']==t['yieldReason']==0 and t['halt']==3
    assert halts==[36165,36166,36167,36168]
    # A guard interpretation that substitutes reason1 for reason8 must fail
    # against these same retained states, even though both codes can halt4.
    wrong=source('gates.wat').replace(
        '(i32.eq (global.get $yield_reason) (i32.const 8))',
        '(i32.eq (global.get $yield_reason) (i32.const 1))')
    assert wrong!=source('gates.wat')
    assert machine(pairs[-1][0]['state']).gates(parse(wrong))=='dispatch-permitted'
    # Evaluate the ACTUAL select and vsock_block forms, using controlled host inputs.
    def select(ready,timeout,ms=200,now=100,waiting=0,deadline=0):
        m=WAT();m.ready=ready;m.ms=ms;m.now=now
        for name in ('park.wat','select.wat'):
            f=parse(source(name))[0];m.funcs[f[1]]=f
        m.g.update({'$reg_base':0x1000,'$current_thunk_eip':eip,
                    '$vsock_sel_waiting':waiting,'$vsock_sel_deadline':deadline})
        m.mem[0x1010]=0x74ffb18;m.mem[0x1000]=0x53000001
        m.ev(['call','$handle_select',['i32.const','0'],['i32.const','0'],['i32.const','0'],
              ['i32.const','0'],['i32.const',str(timeout)],['i32.const','0']])
        return m
    parked=select(0,1)
    assert parked.g['$yield_reason']==8 and parked.g['$eip']==eip
    assert parked.mem[0x1010]==0x74ffb18 and parked.mem[0x1000]==0x53000001
    assert parked.g['$handler_set_eip']==1 and parked.g['$yield_flag']==1
    parked.g.update({'$dbg_any':1,'$bp_addr':0x7a3362})
    assert parked.gates(gates)=='halt' and parked.g['$last_run_halt']==3
    assert parked.g['$yield_flag']==0
    assert parked.gates(gates)=='halt' and parked.g['$last_run_halt']==4
    assert select(0,0).g['$yield_reason']==8 # infinite wait also fits; args unavailable
    for m in (select(1,1),select(0,1,ms=0),select(0,1,now=400,waiting=1,deadline=300)):
        assert m.g['$yield_reason']==0 and m.mem[0x1010]==0x74ffb18+24
    # Reason1 is another guard input, never the observed reason8 provenance.
    s=copy.deepcopy(pairs[-1][0]['state']);s['yieldReason']=1
    assert machine(s).gates(gates)=='halt'
    assert select(0,1).g['$yield_reason']!=s['yieldReason']
    # Entries can rise while pending yields prohibit instruction execution.
    # This rejects the inference even if counts are equal and nonzero (972/972).
    counts={int(pc,16):int(n) for pc,n in re.findall(r'^  (0x[0-9a-f]+) = (\d+)$',log,re.M)}
    assert counts=={0x7a3362:972,0x7a3366:972}
    for pc in counts:
        s.update(eip=pc,yieldReason=8);m=machine(s);m.g['$bp_skip_once']=1
        addr=0x2004 if pc==0x7a3362 else 0x200c;m.mem[addr]=counts[pc]-1
        assert m.gates(gates)=='halt' and m.g['$last_run_halt']==4
        assert m.mem[addr]==counts[pc] # no dispatch reached, despite an entry being counted
    assert '[TRACE-AT #' not in log
    print(json.dumps(dict(status='PASS',pairs=6,pendingReason8Guards=halts,
          eipHex=hex(eip),slot=slot,api='WSOCK32.select',ordinal=ordinal,
          controls=['clear reason8 permits dispatch','neighbor import differs','ready select completes',
                    'zero timeout completes','expired timeout completes','NULL timeout also parks',
                    'reason1 halts but select produces8','972 entries with no execution'],
          limits='Subset WAT evaluator with controlled host calls, not a runtime replay; raw select args/deadline absent.'),indent=2))
if __name__=='__main__': main()
