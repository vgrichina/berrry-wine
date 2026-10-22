#!/usr/bin/env python3
"""Offline, revision-specific staging evidence; never invokes a build or gate."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import posixpath
import re
import subprocess
import tempfile

REV = 'c7fae5ac7ea9e29dfa3f83a7c2bd87d092e0b3b2'
MAIN = '63d563df7a2b901d222a311ceaf55a0823a22261'
E = Path(__file__).resolve().parent
# Deliberate directory supersets, not a claim of a minimal dependency graph.
# These close directory enumeration, generated/check inputs, and dynamic loads.
PREFIXES = ('src/', 'lib/', 'tools/', 'test/', 'fonts/')
EXTRA = {'CLAUDE.md', 'AGENTS.md', '.gitignore', 'index.html',
         'package.json', 'package-lock.json',
         'docs/dos-corpus/live/toyvm-bundle.js',
         'docs/dos-corpus/live/toyvm-jit-bundle.js'}


def git(repo, *args):
    return subprocess.check_output(['git', '-C', str(repo), *args])


def sha(data):
    return hashlib.sha256(data).hexdigest()


def tree(repo):
    result = {}
    for line in git(repo, 'ls-tree', '-rlz', REV).split(b'\0'):
        if not line:
            continue
        meta, path = line.split(b'\t')
        mode, kind, oid, size = meta.decode().split()
        result[path.decode()] = dict(mode=mode, kind=kind, blob=oid, bytes=int(size))
    return result


def selected(paths):
    return sorted(p for p in paths if p.startswith(PREFIXES) or p in EXTRA
                  or ('/' not in p and p.endswith('.js')))


def category(p):
    if p.startswith('src/'):
        return 'source-and-pinned-generated-source'
    if p.startswith('test/'):
        return 'gate-scan-and-fixture-directory-superset'
    if p.startswith('fonts/'):
        return 'toyvm-assets-directory-superset'
    if p.startswith('docs/'):
        return 'pinned-generated-browser-bundle-comparison'
    if p.startswith('tools/'):
        return 'gate-generator-compiler-directory-superset'
    return 'host-module-or-build-metadata'


class Blobs:
    def __init__(self, repo):
        self.p = subprocess.Popen(['git', '-C', str(repo), 'cat-file', '--batch'],
                                  stdin=subprocess.PIPE, stdout=subprocess.PIPE)

    def read(self, oid):
        self.p.stdin.write((oid + '\n').encode())
        self.p.stdin.flush()
        header = self.p.stdout.readline().decode().split()
        assert len(header) == 3 and header[1] == 'blob', header
        data = self.p.stdout.read(int(header[2]))
        assert self.p.stdout.read(1) == b'\n'
        assert hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() == oid
        return data

    def close(self):
        self.p.stdin.close()
        assert self.p.wait() == 0


def expected(repo, t, materialize=False):
    rows = []
    batch = Blobs(repo)
    try:
        # Only ONE file is materialized at a time; never a full checkout/archive.
        with tempfile.TemporaryDirectory(prefix='aoe3-one-blob-', dir=E) as temp:
            target = Path(temp) / 'blob'
            for p in selected(t):
                r = t[p]
                assert r['kind'] == 'blob' and r['mode'] in ('100644', '100755'), (p, r)
                data = batch.read(r['blob'])
                assert len(data) == r['bytes']
                if materialize:
                    target.write_bytes(data)
                    os.chmod(target, int(r['mode'], 8) & 0o777)
                    assert target.stat().st_size == len(data) and sha(target.read_bytes()) == sha(data), p
                    target.unlink()
                rows.append(dict(path=p, mode=r['mode'], blob=r['blob'],
                                 bytes=len(data), sha256=sha(data), role=category(p)))
    finally:
        batch.close()
    return rows


def check_rows(rows, truth):
    assert len(rows) == len({r['path'] for r in rows}), 'duplicate input'
    actual = {r['path']: r for r in rows}
    wanted = {r['path']: r for r in truth}
    missing = sorted(wanted.keys() - actual.keys())
    extra = sorted(actual.keys() - wanted.keys())
    assert not missing and not extra, f'missing={missing}; extra={extra}'
    assert actual == wanted, 'blob/size/hash/mode/role mismatch'


def dependency_evidence(repo, t):
    def text(p):
        return git(repo, 'show', f'{REV}:{p}').decode()
    build = text('tools/build.sh')
    entries = sorted(set(re.findall(r'\bnode\s+([^\s;]+)', build)
                         + ['tools/check-test-manifest.sh', 'tools/test-tiers.js',
                            'tools/check-test-timeouts.js', 'tools/struct-offset-census.js',
                            'tools/watx-closure.js', 'tools/watx.js']))
    bundle = text('tools/toyvm/bundle-browser.js')
    arrays = {}
    for name in ('ROOTS', 'JIT_ROOTS', 'ASSETS'):
        body = re.search(r'const ' + name + r' = \[([\s\S]*?)\];', bundle)[1]
        arrays[name] = re.findall(r"'([^']+)'", body)
    q = entries + arrays['ROOTS'] + arrays['JIT_ROOTS']
    edges, seen, external = [], set(), set()
    fs_review = []
    while q:
        p = q.pop()
        if p in seen:
            continue
        assert p in t, p
        seen.add(p)
        s = text(p)
        for i, line in enumerate(s.splitlines(), 1):
            if re.search(r'readFile|readdir|existsSync|execFile|spawn|require\(|writeFile', line):
                fs_review.append(f'{p}:{i}: {line}')
        code = '\n'.join(line for line in s.splitlines() if not line.lstrip().startswith('//'))
        for m in re.finditer(r'''require\(\s*['"]([^'"]+)['"]\s*\)''', code):
            value = m[1]
            if not value.startswith('.'):
                external.add(value)
                continue
            raw = posixpath.normpath(posixpath.join(posixpath.dirname(p), value))
            dep = next((v for v in (raw, raw+'.js', raw+'.json', raw+'/index.js') if v in t), None)
            assert dep, (p, value)
            edges.append([p, dep])
            q.append(dep)
    assert set(seen).issubset(selected(t))
    assert set(arrays['ASSETS']).issubset(selected(t))
    # Explicit dynamic require / vm loader families, all covered by PREFIXES.
    dynamic = ['tools/watx-src/compiler-parser.js', 'tools/watx-src/compiler-stages.js',
               'tools/watx-src/compiler-codegen.js', 'tools/watx-src/compiler.js',
               'lib/compile-wat.js', 'lib/dispatch-trampoline.js',
               'tools/region-layout-hash.js', 'tools/watx-closure.js',
               'lib/gl-compat.js', 'lib/gl-command-stream.js', 'tools/fnt-read.js',
               'tools/watx.js', 'tools/region-layout.js']
    assert set(dynamic).issubset(selected(t))
    region_code = '\n'.join(line.split(';;', 1)[0] for line in text('src/00-regions.wat').splitlines())
    owners = re.findall(r'\(owner\s+"([^":]+):[^"\n]+"\)', region_code)
    owners = sorted(set(p if '/' in p else 'src/'+p for p in owners))
    assert set(owners).issubset(selected(t)), owners
    return dict(entrypoints=entries, toyvm=arrays, literalModuleClosure=sorted(seen),
                literalEdges=sorted(edges), dynamicCompilerAndHostFiles=dynamic,
                regionOwnerFiles=owners, literalExternalRequires=sorted(external)), fs_review


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', type=Path, required=True)
    ap.add_argument('--create', action='store_true')
    ap.add_argument('--manifest', type=Path, default=E/'build-inputs.json')
    ap.add_argument('--staged-root', type=Path)
    args = ap.parse_args()
    t = tree(args.repo)
    assert EXTRA.issubset(t)
    truth = expected(args.repo, t, materialize=True)
    if args.create:
        args.manifest.write_text(json.dumps(dict(revision=REV, main=MAIN,
            selection='conservative complete directory closure; not minimal',
            count=len(truth), bytes=sum(r['bytes'] for r in truth), inputs=truth), indent=2)+'\n')
        dep, review = dependency_evidence(args.repo, t)
        (E/'dependency-review.json').write_text(json.dumps(dep, indent=2)+'\n')
        (E/'filesystem-review.txt').write_text('\n'.join(review)+'\n')
    manifest = json.loads(args.manifest.read_text())
    assert manifest['revision'] == REV and manifest['main'] == MAIN
    check_rows(manifest['inputs'], truth)
    assert manifest['count'] == len(truth) and manifest['bytes'] == sum(r['bytes'] for r in truth)
    dep, _ = dependency_evidence(args.repo, t)
    assert dep == json.loads((E/'dependency-review.json').read_text())
    history = []
    for rev, p in [(REV, 'src/api_table.json'), (MAIN, 'src/api_table.json'),
                   (REV+'^', 'tools/check-silent-stubs.js')]:
        raw = git(args.repo, 'show', rev+':'+p)
        history.append(dict(revision=git(args.repo, 'rev-parse', rev).decode().strip(),
                            path=p, bytes=len(raw), sha256=sha(raw),
                            blob=git(args.repo, 'rev-parse', rev+':'+p).decode().strip()))
    if args.create:
        (E/'history-inputs.json').write_text(json.dumps(history, indent=2)+'\n')
    assert history == json.loads((E/'history-inputs.json').read_text())
    controls = []
    for omit in ('fonts/Terminal.fon', 'tools/toyvm/emit-decoder.js'):
        try:
            check_rows([r for r in truth if r['path'] != omit], truth)
        except AssertionError as error:
            assert omit in str(error)
            controls.append(dict(omission=omit, result='REJECT', diagnostic=str(error)))
        else:
            raise AssertionError('omission accepted: '+omit)
    for rev in (REV, REV+'^', MAIN, '24220bf65a04f665c847fc4037a732f8e82db87c',
                '2977ba3bd08e5bde5bab5e5323a5de71a14d6b49',
                '28379f3d7475317b429c4c18f082c4deb5bbd489'):
        git(args.repo, 'rev-parse', '--verify', rev+'^{commit}')
    for rev in (MAIN, '24220bf65a04f665c847fc4037a732f8e82db87c',
                '2977ba3bd08e5bde5bab5e5323a5de71a14d6b49',
                '28379f3d7475317b429c4c18f082c4deb5bbd489'):
        subprocess.run(['git', '-C', str(args.repo), 'merge-base', '--is-ancestor', rev, REV], check=True)
    if args.staged_root:
        staged_paths = set()
        for prefix in PREFIXES:
            for p in (args.staged_root/prefix).rglob('*'):
                if p.is_file() and 'node_modules' not in p.parts:
                    staged_paths.add(p.relative_to(args.staged_root).as_posix())
        staged_paths.update(p.name for p in args.staged_root.glob('*.js'))
        extras = staged_paths - {r['path'] for r in truth}
        assert not extras, 'extra scanned inputs: '+str(sorted(extras))
        for r in truth:
            p = args.staged_root/r['path']
            assert p.is_file() and p.stat().st_size == r['bytes'] and sha(p.read_bytes()) == r['sha256'], str(p)
            assert p.stat().st_mode & 0o777 == int(r['mode'], 8) & 0o777, str(p)
        assert git(args.staged_root, 'rev-parse', 'HEAD').decode().strip() == REV
        git(args.staged_root, 'show', 'HEAD^:tools/check-silent-stubs.js')
        git(args.staged_root, 'show', MAIN+':src/api_table.json')
    result = dict(result='PASS', revision=REV, files=len(truth), bytes=sum(r['bytes'] for r in truth),
                  manifestSHA256=sha(args.manifest.read_bytes()),
                  largestSingleMaterialization=max(r['bytes'] for r in truth),
                  allBlobsGitSHA1AndSHA256Verified=True, allBlobsMaterializedAndReadBack=True,
                  omissionControls=controls, historyAndAcceptedAncestry='PASS',
                  stagedRootVerified=str(args.staged_root) if args.staged_root else None,
                  buildAttempts=0, guestRuns=0, runtimeAccesses=0)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
