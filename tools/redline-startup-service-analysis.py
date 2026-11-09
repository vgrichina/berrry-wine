#!/usr/bin/env python3
"""Join retained startup consumer, consumed waits, releases and service spans.

Completed CONT -> next consumed stop is an execution-permitted interval, not
CPU time. Consumed stop -> successful resume is a stopped lower bound, never
an attribution to fsync, DBus or the kernel without measured service overlap.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path


def read(path):
    if not path.exists():path=Path(str(path)+'.gz')
    data=path.read_bytes()
    return gzip.decompress(data) if path.suffix=='.gz' else data


def analyze(root):
    raw=read(root/'publication-custody/custody.ndjson')
    custody=[json.loads(line) for line in raw.splitlines()]
    startup=json.loads(read(root/'native-fixture/chrome-startup.json'))
    boundary=json.loads(read(root/'native-fixture/startup-boundary.json'))
    observer=[json.loads(line) for line in read(root/'publication-custody/publication-syscalls.ndjson').splitlines()]
    by_sequence={r['sequence']:r for r in custody}
    begin=startup['started']/1000;end=begin+startup['elapsedMs']/1000
    last_resume={};intervals=[]
    for row in custody:
        task=row.get('pid');kind=row['kind']
        if kind=='wait-consumed' and task in last_resume:
            prev=last_resume.pop(task)
            intervals.append(dict(kind='execution-permitted-UNKNOWN-scheduling',pid=task,
                begin=prev['at'],end=row['at'],fromSequence=prev['sequence'],toSequence=row['sequence']))
        elif kind in ('ptrace-cont-returned','ptrace-syscall-resume-returned'):
            wait=by_sequence[row['waitSequence']]
            intervals.append(dict(kind='consumed-stop-lower-bound',pid=task,
                begin=wait['at'],end=row['at'],fromSequence=wait['sequence'],toSequence=row['sequence'],
                status=wait['waitStatus'],actualRequest=row['actualRequest']))
            last_resume[task]=row
    totals={}
    for row in intervals:
        row['gateSeconds']=max(0,min(end,row['end'])-max(begin,row['begin']))
        if row['gateSeconds']:
            group=totals.setdefault(str(row['pid']),{})
            group[row['kind']]=group.get(row['kind'],0)+row['gateSeconds']
    stepping=[r for r in custody if r['kind']=='ptrace-syscall-resume-returned']
    result=dict(gate=dict(begin=begin,end=end,seconds=startup['elapsedMs']/1000,
                        polls=startup['polls'],pid=startup['pid'],rows=len(boundary['rows']),drops=boundary['dropped']),
                custodySHA256=hashlib.sha256(raw).hexdigest(),intervals=intervals,perTaskSeconds=totals,
                observerRecords=len(observer),observerFooter=observer[-1],
                lastSyscallRelease=stepping[-1] if stepping else None,
                syscallReleasesInsideGate=sum(begin<=r['at']<=end for r in stepping),
                interpretation='No service attribution from interval spans; execution-permitted includes kernel waits and scheduling.')
    try:service=json.loads(read(root/'publication-custody/startup-service.json'))
    except FileNotFoundError:service=None
    if service:
        anchor=service['anchor'];offset=anchor['unixNs']-anchor['monotonicNs']
        rows=service['rows'];by_service={};roles={}
        for r in rows:
            a=(r['beginNs']+offset)/1e9;b=(r['endNs']+offset)/1e9
            overlap=max(0,min(end,b)-max(begin,a))
            if r['kind']=='role' and r.get('identityMatches'):
                roles.setdefault(str(r['pid']),[])
                item={k:r[k] for k in ['comm','exe','cmdlineHex'] if k in r}
                if item not in roles[str(r['pid'])]:roles[str(r['pid'])].append(item)
            if r['kind']=='service' and overlap:
                key=str(r.get('pid'))+':'+r['service'];by_service[key]=by_service.get(key,0)+overlap
        result['measuredServices']=dict(gateOverlapSeconds=by_service,roles=roles,dropped=service['dropped'],
            totals=service['totals'],anchor=anchor,warning='Call wall durations include descheduling; role snapshots do not confer ownership.')
    return result


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('root',type=Path);parser.add_argument('output',type=Path)
    args=parser.parse_args();result=analyze(args.root);args.output.write_text(json.dumps(result,indent=2))
    print(json.dumps({k:v for k,v in result.items() if k not in ['intervals','measuredServices']},indent=2))
