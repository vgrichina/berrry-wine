#!/usr/bin/env python3
"""Original-media static acceptance; execute only under task supervisor.

Recipe: see docs/re-notes/gltron-integrated-real-media-analysis-oct29.md.
No extraction, installer, guest, network, or fixture replacement is used.
"""
import hashlib
import importlib.util
import json
import os
import re
import sys
import zlib
from pathlib import Path

ROOT=Path('/tmp/gltron-integrated-real-media-analysis-oct29')
REPO=ROOT/'repo'
PAYLOAD=ROOT/'payload'
E=ROOT/'evidence'
SOURCE=REPO/'tools/recovery/gltron-original-win32-recovery-oct28.py'
PIN='aa7d8c7668a6ea466f2099bb1966d8f725ed660c47fcf961826e35f9c19be53d'

def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def load():
    assert digest(SOURCE)==PIN
    assert Path.cwd().resolve()==ROOT and os.environ['PALETTE_BROWSER_SUPERVISED']=='1'
    spec=importlib.util.spec_from_file_location('exact_production',SOURCE)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def pair():
    return {name:(PAYLOAD/name).read_bytes() for name in ('inventory.json','closure.json')}

def assert_expected():
    for name in ('inventory.json','closure.json'):
        assert json.loads((PAYLOAD/name).read_text())==json.loads((E/('expected-'+name)).read_text()),name
    assert not list(PAYLOAD.glob('.analysis-pair-*'))

def record(name,value):
    (E/name).write_text(json.dumps(value,indent=2)+'\n')

def main():
    mode=sys.argv[1]
    if mode=='api':
        module=load()
        result=module.analyze(PAYLOAD/'gltron-0.70-win32.exe')
        assert_expected()
        assert result==json.loads((E/'expected-closure.json').read_text())
        inv=json.loads((PAYLOAD/'inventory.json').read_text())
        record('api-result.json',dict(PASS=True,sourceSHA256=PIN,modules=len(result['modules']),unresolved=result['unresolved'],inventoryCount=inv['count'],inventoryBytes=inv['bytes'],pairSHA256={n:hashlib.sha256(v).hexdigest() for n,v in pair().items()},realObjdumpLogs=[{'name':p.name,'bytes':p.stat().st_size,'sha256':digest(p)} for p in sorted((PAYLOAD/'static').glob('*'))]))
    elif mode=='check-cli':
        assert_expected()
        record('cli-result.json',dict(PASS=True,pairedSameGeneration=True,pairSHA256={n:hashlib.sha256(v).hexdigest() for n,v in pair().items()}))
    elif mode=='failure-control':
        module=load();before=pair()
        # A two-byte PE signature corruption with matching listing checksum
        # reaches real pe_machine AFTER the complete inventory validates.
        target=PAYLOAD/'extracted/app/MSVCR70.dll'
        original=target.read_bytes();bad=b'ZZ'+original[2:]
        listing=PAYLOAD/'inno-list.txt';prior=listing.read_bytes()
        pattern=rb'("app/MSVCR70.dll"[^\n]*Adler32 0x)[ 0-9a-f]{8}'
        updated,count=re.subn(pattern,lambda m:m[1]+f'{zlib.adler32(bad):08x}'.encode(),prior)
        assert count==1
        try:
            target.write_bytes(bad);listing.write_bytes(updated)
            try:module.analyze(PAYLOAD/'gltron-0.70-win32.exe')
            except ValueError as ex:
                assert str(ex)=='invalid DOS header',str(ex)
                assert pair()==before and not list(PAYLOAD.glob('.analysis-pair-*'))
                record('failure-control.json',dict(PASS=True,error=str(ex),boundary='valid inventory -> actual pe_machine rejection',changedBytes=2,priorPairPreserved=True,sourceSHA256=PIN))
            else:raise AssertionError('expected analysis rejection absent')
        finally:
            target.write_bytes(original);listing.write_bytes(prior)
        assert digest(target)==hashlib.sha256(original).hexdigest()
        assert_expected()
    else:raise ValueError(mode)
    print('PASS '+mode)

if __name__=='__main__':main()
