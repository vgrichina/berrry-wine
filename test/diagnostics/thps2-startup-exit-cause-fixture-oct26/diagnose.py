#!/usr/bin/env python3
"""Read-only, pinned original PE localization. No guest or emulator execution."""
import argparse, hashlib, json, pathlib, struct, subprocess

EXE_SHA = 'fe5b66dd0a14bf5f3e5b00aceeeda9e1da165c7274a83a22fd1cb106e03d4b26'
TRACE_SHA = '74313246cd6f2df2b23bf330d5819ed1a1925a4b976cde407932e7a4c4af1311'
def u16(b,o): return struct.unpack_from('<H',b,o)[0]
def u32(b,o): return struct.unpack_from('<I',b,o)[0]
class PE:
    def __init__(self,b):
        assert b[:2] == b'MZ'
        p=u32(b,0x3c); assert b[p:p+4] == b'PE\0\0'
        q=p+24; assert u16(b,q)==0x10b
        self.b=b; self.base=u32(b,q+28); self.headers=u32(b,q+60)
        self.import_rva=u32(b,q+104); self.sections=[]
        for i in range(u16(b,p+6)):
            s=q+u16(b,p+20)+40*i
            vs,rv,rs,ro=struct.unpack_from('<IIII',b,s+8)
            self.sections.append(dict(name=b[s:s+8].rstrip(b'\0').decode(),vsize=vs,rva=rv,rawSize=rs,rawOff=ro))
    def off(self,va,n=1):
        r=va-self.base
        if 0<=r and r+n<=self.headers and r+n<=len(self.b): return r
        for s in self.sections:
            d=r-s['rva']
            if 0<=d and d+n<=s['rawSize'] and s['rawOff']+d+n<=len(self.b): return s['rawOff']+d
        raise ValueError('VA is not file-backed: '+hex(va))
    def read(self,va,n):
        o=self.off(va,n); return self.b[o:o+n]
    def string(self,va):
        o=self.off(va); end=self.b.index(0,o); assert end-o<4096
        return self.b[o:end].decode('ascii')
    def imports(self):
        result={}; d=self.base+self.import_rva
        while True:
            original,stamp,chain,name,iat=struct.unpack('<IIIII',self.read(d,20))
            if not any((original,stamp,chain,name,iat)): break
            dll=self.string(self.base+name); j=0
            while True:
                v=u32(self.read(self.base+(original or iat)+4*j,4),0)
                if not v:break
                result[self.base+iat+4*j]=dll+'!'+('#'+str(v&65535) if v&0x80000000 else self.string(self.base+v+2))
                j+=1
            d+=20
        return result
    def calls(self,target):
        # Raw E8 candidates only; selected sites must be instruction-boundary confirmed.
        hits=[]
        for s in self.sections:
            if s['name']!='.text':continue
            for d in range(min(s['vsize'],s['rawSize'])-4):
                o=s['rawOff']+d; va=self.base+s['rva']+d
                if self.b[o]==0xe8 and va+5+struct.unpack_from('<i',self.b,o+1)[0]==target:hits.append(va)
        return hits

def stack_route(b):
    """64+ bytes captured at ExitProcess entry ESP, BEFORE its handler changes ESP."""
    if len(b)<36: raise ValueError('need at least 36 bytes at ExitProcess entry ESP')
    if u32(b,0)!=0x4f03dc or u32(b,4)!=1: raise ValueError('wrong invocation')
    wrapper=u32(b,12)
    if wrapper not in (0x4f0306,0x4f0317):
        return dict(route='unclassified: retain full stack; no wrapper assertion',crtReturn=hex(wrapper))
    status=u32(b,16); quick=u32(b,20); ret=u32(b,24)
    if (status,quick,ret)!=(1,int(wrapper==0x4f0317),0): raise ValueError('CRT arguments inconsistent')
    return dict(route='exit' if wrapper==0x4f0306 else '_exit',callerReturn=hex(u32(b,28)),status=status)

def diagnose(exe,trace):
    b=pathlib.Path(exe).read_bytes(); t=pathlib.Path(trace).read_bytes()
    assert hashlib.sha256(b).hexdigest()==EXE_SHA, 'original EXE SHA mismatch'
    assert hashlib.sha256(t).hexdigest()==TRACE_SHA, 'authentic trace SHA mismatch'
    p=PE(b); imp=p.imports()
    assert p.read(0x4f03d6,6)==bytes.fromhex('ff15b0715000')
    assert imp[0x5071b0].endswith('!ExitProcess')
    assert b'[API #3548] ExitProcess(0x00000001) [esp=0x074ffbd8 ret=0x004f03dc]' in t
    ranges=[(0x4f02f9,0x4f03de),(0x4f20be,0x4f20f8),(0x4e76f1,0x4e771c),(0x4c6397,0x4c63c2)]
    listings=[]
    for a,z in ranges:
        r=subprocess.run(['objdump','-d','-Mintel',f'--start-address={a}',f'--stop-address={z}',str(exe)],capture_output=True,timeout=20,check=True)
        assert len(r.stdout)<8192
        listings.append(dict(start=hex(a),end=hex(z),text=r.stdout.decode()))
    calls=p.calls(0x4f02f9)
    return dict(exeSHA256=EXE_SHA,traceSHA256=TRACE_SHA,imageBase=hex(p.base),sections=p.sections,
        exit=dict(callPC='0x004f03d6',returnPC='0x004f03dc',fileOffset=hex(p.off(0x4f03d6,6)),iat=imp[0x5071b0]),
        rawExitCallCandidates=[hex(x) for x in calls],rawQuickExitCallCandidates=[hex(x) for x in p.calls(0x4f030a)],
        instructionConfirmedCounterexamples=['0x4f20d4: status from WinMain','0x4c63b7: nonzero COM Release count'],
        imports={hex(k):v for k,v in imp.items() if k in [0x5071b0,0x507214,0x507270,0x507278]},
        strings={hex(k):p.string(k) for k in [0x535850,0x54775c,0x547790,0x5477a0,0x5477f0,0x533ffc]},
        actualCaller=None,actualFailedAPI=None,emulatorDefectEstablished=False,disassembly=listings)

if __name__=='__main__':
    a=argparse.ArgumentParser();a.add_argument('exe');a.add_argument('trace');a.add_argument('--stack',help='raw bytes at the observed ExitProcess entry ESP')
    q=a.parse_args();r=diagnose(q.exe,q.trace)
    if q.stack:r['newStackObservation']=stack_route(pathlib.Path(q.stack).read_bytes())
    print(json.dumps(r,indent=2))
