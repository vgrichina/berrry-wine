#!/usr/bin/env python3
"""Offline predicate controls and original-byte checks; never executes guest code."""
import argparse, hashlib, json, struct
from pathlib import Path

def sha(b): return hashlib.sha256(b).hexdigest()

def pe_offset(b, va):
    pe = struct.unpack_from('<I', b, 0x3c)[0]
    n, opt = struct.unpack_from('<H', b, pe+6)[0], struct.unpack_from('<H', b, pe+20)[0]
    base = struct.unpack_from('<I', b, pe+24+28)[0]
    for i in range(n):
        p = pe+24+opt+40*i
        vs, rva, size, raw = struct.unpack_from('<IIII', b, p+8)
        if rva <= va-base < rva+size: return raw+va-base-rva
    raise ValueError('VA has no file bytes')

def check(b, va, hexbytes):
    want = bytes.fromhex(hexbytes); off = pe_offset(b, va)
    assert b[off:off+len(want)] == want, hex(va)
    return dict(va=hex(va), fileOffset=off, hex=want.hex())

def sync_step(missing, ready, recv=1, kind=0, channel=1, frame=7, expected=7,
              seed=9, expected_seed=9, our=0):
    """Reference SyncNetwork control flow, with packet copy abstracted away.

    missing is the set of initially NULL current-frame player slots. No network,
    clock, SDL or interpreter implementation is simulated by this function.
    """
    missing = set(missing)
    if not missing: return missing, 'success'
    if ready == 0: return missing, 'resend'
    if ready < 0: return missing, 'retry'
    if recv <= 0: return missing, 'error'
    if kind == 1: return missing, 'new-game'
    if kind != 0: return missing, 'unknown-type'
    if channel <= 0: return missing, 'unknown-source'
    if channel-1 not in missing: return missing, 'duplicate'
    if frame != expected:
        return missing, {expected-1:'resend-old',expected+1:'cache-next'}.get(frame,'wrong-frame')
    missing.remove(channel-1)
    action = 'accept'
    if seed != expected_seed: action = 'accept-delay' if our == 0 else 'accept-reseed'
    return missing, 'success' if not missing else action

def controls():
    cases = [({}, {}, 'success'), ({0}, {'ready':0}, 'resend'),
             ({0}, {'ready':-1}, 'retry'), ({0}, {'recv':0}, 'error'),
             ({0}, {'kind':1}, 'new-game'), ({0}, {'kind':2}, 'unknown-type'),
             ({0}, {'channel':0}, 'unknown-source'), ({0}, {'channel':2}, 'duplicate'),
             ({0}, {'frame':6}, 'resend-old'), ({0}, {'frame':8}, 'cache-next'),
             ({0}, {'frame':3}, 'wrong-frame'), ({0}, {}, 'success'),
             ({0,1}, {'seed':10}, 'accept-delay'),
             ({0,1}, {'seed':10,'our':1}, 'accept-reseed')]
    out=[]
    for missing, kw, want in cases:
        actual = sync_step(missing, **({'ready':1}|kw))
        assert actual[1] == want, (kw, actual, want)
        out.append(dict(inputs=sorted(missing), variant=kw, remaining=sorted(actual[0]), action=actual[1]))
    remaining={0}
    for _ in range(972): remaining, action=sync_step(remaining,0)
    assert remaining == {0} and action == 'resend'
    # One completion counter cannot distinguish these source-legal alternatives.
    assert sync_step({0},0)[0] == sync_step({0},1,frame=8)[0] == {0}
    # Signed wraparound deadline comparison, matching historical handle_select.
    signed=lambda x: ((x+2**31)%2**32)-2**31
    assert signed(0xfffffff0-0x20)<0 and signed(0x20-0x20)==0
    return out

def main():
    p=argparse.ArgumentParser();p.add_argument('--original',required=True);p.add_argument('--manifest',required=True)
    a=p.parse_args(); root=Path(a.original); manifest=json.loads(Path(a.manifest).read_text())
    identities=[]; blobs={}
    for name in ['Maelstrom.exe','SDL.dll','SDL_net.dll']:
        b=(root/name).read_bytes(); row=next(x for x in manifest if x['path']==str(root/name))
        assert len(b)==row['bytes'] and sha(b)==row['sha256']
        identities.append(dict(name=name,bytes=len(b),sha256=sha(b)));blobs[name]=b
    exe=blobs['Maelstrom.exe']; dll=blobs['SDL_net.dll']
    anchors=[check(exe,0x40e125,'e8c2530000'),check(exe,0x40e12a,'83c40885c0756e'),
             check(exe,0x40e1b1,'e830530000'),check(exe,0x40e1b6,'83c40885c00f8ecb020000'),
             check(exe,0x40e439,'404b89049524fa4100895c2410'),
             check(exe,0x40e44a,'85db0f85b9fcffff'),check(exe,0x40e452,'8b15f8f94100'),
             check(dll,0x1000135d,'e8ee090000'),check(dll,0x10001362,'8be8ffd783380474a2'),
             check(dll,0x1000139c,'8bc55e5d5b81c414010000c3')]
    rejected=0
    for va,h in [(0x40e44a,'85db0f85b9fcffff'),(0x40e439,'404b89049524fa4100895c2410')]:
        mutant=bytearray(exe);mutant[pe_offset(exe,va)]^=1
        try: check(mutant,va,h)
        except AssertionError: rejected+=1
    assert rejected==2
    print(json.dumps(dict(passChecks=True,identities=identities,anchors=anchors,
                         nativeMutationRejects=rejected,controls=controls(),
                         limitations='Source semantics only; no guest/native/WASM execution and no observed return values.'),indent=2))

if __name__=='__main__': main()
