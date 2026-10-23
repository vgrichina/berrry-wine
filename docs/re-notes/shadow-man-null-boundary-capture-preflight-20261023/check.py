#!/usr/bin/env python3
"""Report-only validation. Never runs Node/guest/capture simulation/build/network."""
import hashlib
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent


def require(condition, message):
    if not condition:
        raise ValueError(message)


def main():
    donor = pathlib.Path(sys.argv[1])
    report = json.loads((HERE / 'admission.json').read_text())
    helper = report['plannedHelperVerification']
    publication = report['blockerOnlyPublication']
    require(helper['nodeBytes'] > report['capBytes'], 'Node lower bound not over cap')
    require(helper['admitted'] is False, 'Helper wrongly admitted')
    require(sum(publication['parts'].values()) == publication['upperBytes'], 'Envelope sum')
    require(publication['upperBytes'] < report['capBytes'], 'Report-only envelope over cap')
    require(report['hostFreeBefore'] - publication['upperBytes'] > report['hostFloorBytes'], 'Host floor')
    old = donor / 'docs/re-notes/shadow-man-null-exit-diagnosis-20261023'
    pins = {e['path']: e['blob'] for e in json.loads((old / 'admission.json').read_text())['source']}
    extra = json.loads((old / 'admission-supplement.json').read_text())
    pins[extra['path']] = extra['blob']
    ranges = {
        'test/run.js': [(887, 891), (1526, 1526), (1573, 1582), (6270, 6278), (10463, 10485), (10556, 10583)],
        'src/13-exports.wat': [(75, 81), (146, 163), (322, 328), (623, 623), (649, 661), (2544, 2547), (4855, 4859)],
        'src/09c3a-dialog-runtime.wat': [(229, 234), (266, 299)],
        'src/09b-dispatch.wat': [(961, 980), (1025, 1058)],
    }
    sources = []
    for path, selected in ranges.items():
        data = (donor / path).read_bytes()
        blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        require(blob == pins[path], 'Runtime source mismatch: ' + path)
        lines = data.decode().splitlines()
        sources.append({'path': path, 'blob': blob, 'bytes': len(data),
                        'excerpts': [{'firstLine': a, 'lastLine': b,
                                      'text': '\n'.join(lines[a-1:b])} for a, b in selected]})
    out = {'reportCheckExit': 0, 'classification': 'RESOURCE_ADMISSION_BLOCKER',
           'captureReady': False, 'nodeExecuted': False,
           'helperCaptureFixtures': 'NOT RUN', 'guestEvidence': 'NONE NEW',
           'simulation': 'NONE', 'admissionArithmetic': 'PASS',
           'exactRuntimeSourcePinsVerified': len(sources), 'sources': sources}
    print(json.dumps(out, indent=2))


if __name__ == '__main__':
    main()
