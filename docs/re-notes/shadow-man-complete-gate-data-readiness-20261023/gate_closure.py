"""Offline inventory of exact mandatory consumers; never executes candidate JS."""
import hashlib, json, pathlib, posixpath, re, subprocess
CANDIDATE = 'b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a'

def inventory(root, evidence, env):
    def git(*args):
        return subprocess.check_output(['git', '-C', str(root), *args], env=env)
    tree = {line.split('\t')[1]: line.split()[2] for line in git('ls-tree', '-r', CANDIDATE).decode().splitlines()}
    cache = {}
    def read(name):
        if name not in cache: cache[name] = git('cat-file', 'blob', tree[name]).decode()
        return cache[name]
    build = read('tools/build.sh').split('echo "Compiling (WATX)..."')[0]
    roots = set(re.findall(r'(?:node|bash) ((?:tools|test)/[\w./-]+)', build))
    # Non-literal execution/read edges, inspected in the exact sources. Bundle
    # roots are text-read recursively, not executed. VM loads are compiler data.
    dynamic = {
        'tools/toyvm/bundle-browser.js': ['tools/toyvm/live.js', 'tools/toyvm/region-prepare.js', 'lib/compile-wat.js'],
        'tools/toyvm/vm.js': ['lib/compile-wat.js'],
        'tools/union-gate.js': ['tools/struct-offset-census.js', 'tools/watx-closure.js'],
        'tools/struct-offset-census.js': ['lib/compile-wat.js'],
        'tools/region-layout.js': ['tools/watx.js'],
        'tools/watx-closure.js': ['tools/watx.js'],
    }
    compiler = ['tools/watx-src/compiler-'+x+'.js' for x in ['parser', 'stages', 'codegen']] + ['tools/watx-src/compiler.js']
    for name in ['tools/watx.js','tools/union-gate.js','tools/gen-layout-offsets.js']:
        dynamic.setdefault(name, []).extend(compiler)
    # These are all non-JS mandatory data consumers, resolved independently of
    # the scanner and the earlier incomplete projection. Conservative releases
    # occur at phase boundaries AFTER their last command, never before it.
    data = {}
    def add(name, consumer, phase='initial'):
        assert name in tree, name
        info = data.setdefault(name, {'consumers': [], 'lastPhase': phase})
        info['consumers'].append(consumer)
        if phase == 'late': info['lastPhase'] = phase
    add('CLAUDE.md', 'tools/check-claude-size.js')
    add('tools/build.sh', 'driver exact canonical-prefix fence', 'late')
    add('tools/check-test-manifest.sh', 'canonical bash; invokes test-tiers and check-test-timeouts')
    add('test/run-all.sh', 'tools/check-test-timeouts.js:72 DEFAULT_TEST_TIMEOUT read')
    add('tools/test-timeouts.json', 'tools/test-timeouts.js:41 loadTimeoutOverrides')
    add('src/api_table.json', 'callback, API/hash/dispatch/handler and esp-epilogue checks', 'late')
    add('src/kernel32-exports.json', 'tools/gen-kernel32-image.js')
    add('src/win16-ordinals.generated.json', 'Git cleanliness scope src in tools/check-silent-stubs.js; retain complete src namespace')
    add('lib/host-import-sigs.generated.json', 'tools/gen-host-import-sigs.js --check')
    add('tools/callback-ownership-census.json', 'tools/callback-ownership-census.js')
    add('tools/aw-census.baseline.json', 'tools/aw-census.js --check')
    add('tools/wat-dup-census.baseline.json', 'tools/wat-dup-census.js --check')
    add('tools/region-census.baseline.json', 'tools/region-census.js modes')
    add('index.html', 'tools/check-browser-cache-versions.js --self-test')
    add('tools/layout-offsets.json', 'tools/gen-layout-offsets.js --check', 'late')
    for name in ['tools/watx-src/CHANGELOG.md','tools/watx-src/PROVENANCE.md']:
        add(name, 'tools/check-watx-provenance.js sealed hashes', 'late')
    seen, edges, sites = set(), [], []
    queue = list(roots)
    while queue:
        name = queue.pop()
        if name in seen: continue
        seen.add(name)
        text = read(name)
        deps = list(dynamic.get(name, []))
        for match in re.finditer(r'require\(([\'"])(\.[^\'"]+)\1\)', text):
            path = posixpath.normpath(posixpath.join(posixpath.dirname(name), match[2]))
            if path not in tree: path += '.js'
            if path in tree: deps.append(path)
        if name.endswith('.sh'):
            deps += re.findall(r'(?:node|bash) ((?:tools|test)/[\w./-]+)', text)
        for dep in sorted(set(deps)):
            edges.append([name, dep])
            if dep.endswith(('.js','.sh')): queue.append(dep)
            elif dep not in data: raise ValueError('unclassified non-JS require '+dep)
        for line, source in enumerate(text.splitlines(), 1):
            if re.search(r'readFile|readdir|existsSync|execFile|execSync|spawnSync|vm.runInContext', source):
                sites.append([name, line, source.strip()])
    provenance = read('tools/check-watx-provenance.js')
    required = re.findall(r"'([^']+)'", provenance.split('const REQUIRED_FILES = [')[1].split('];')[0])
    sealed = re.findall(r'^[0-9a-f]{64}\s+(\S+)$', read('tools/watx-src/PROVENANCE.md'), re.M)
    assert set(required) == set(sealed)
    # The late provenance gate reads these test bytes; it does not run tests.
    assert all(p.endswith('.js') and p in tree for p in required)
    result = dict(candidate=CANDIDATE, data=data, roots=sorted(roots), edges=edges,
                  inspectedSources=[dict(path=p,blob=tree[p],sha256=hashlib.sha256(read(p).encode()).hexdigest()) for p in sorted(seen)],
                  fileAndSubprocessSites=sites, provenanceRequired=required,
                  dynamicEdges=dynamic,
                  bundleData=['fonts/Terminal.fon','docs/dos-corpus/live/toyvm-bundle.js','docs/dos-corpus/live/toyvm-jit-bundle.js'],
                  generated={'build/combined.wat':'concat-wat -> check-parens --no-diff --quiet'},
                  gitReads=['HEAD:src/api_table.json','HEAD^:tools/check-silent-stubs.js; conditional HEAD^ changed src WAT'],
                  absentMetadata=['private .git/MERGE_HEAD (no merge)'],
                  conditionalNotRead=['decode-diff --exe unset; no EXE read','bundle --check; no output regeneration','check-parens --no-diff; no Git combined.wat read'],
                  externalInputs=['Node builtins; installed pngjs only if loaded','/proc/meminfo resource observation','/proc/sys/kernel/random/boot_id if named-event-authority initialization reads it'],
                  scope='mandatory prefix input closure only; runtime/dynamic guest closure unqualified')
    (evidence/'gate-consumers.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
    return result
