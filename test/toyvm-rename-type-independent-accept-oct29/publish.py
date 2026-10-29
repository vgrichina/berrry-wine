"""Exact-path publication recipe using the task-owned admitted supervisor."""
import hashlib
import json
from pathlib import Path
import sys

REPO = Path(__file__).resolve().parents[2]
ROOT = REPO.parent
sys.path.insert(0, str(ROOT))
import ops

BRANCH = 'task/toyvm-rename-type-independent-accept-oct29'
PREFIX = 'test/toyvm-rename-type-independent-accept-oct29/'
FILES = sorted(PREFIX + n for n in ('accept.py', 'acceptance.json', 'canonical.json',
               'original-reproducer.json', 'publish.py', 'report.md', 'reproduce.py', 'seal.py'))


def git(label, *args):
    code, output = ops.run(label, ['git', '-C', str(REPO), *args], cwd=REPO, git=True)
    if code:
        raise SystemExit(code)
    return output.strip()


if __name__ == '__main__':
    ops.BASE = ops.configure_parent()
    action = sys.argv[1]
    identity = git(action + '-identity', 'rev-parse', '--show-toplevel', '--absolute-git-dir',
                   '--abbrev-ref', 'HEAD').splitlines()
    assert identity == [str(REPO), str(REPO / '.git'), BRANCH]
    assert REPO.resolve(strict=True) == REPO
    assert (REPO / '.git').resolve(strict=True) == REPO / '.git'
    assert git(action + '-origin', 'remote', 'get-url', 'origin') == 'git@github.com:vgrichina/wine-assembly.git'
    if action == 'stage':
        assert git('stage-head', 'rev-parse', 'HEAD') == 'ee783655f7d8dc7829093943fe73e0091fb440fe'
        git('stage-exact', 'add', '--sparse', '--', *FILES)
        assert git('stage-paths', 'diff', '--cached', '--name-only').splitlines() == FILES
        git('cached-whitespace', 'diff', '--cached', '--check')
        git('cached-review', 'diff', '--cached', '--no-ext-diff', '--no-color')
        git('cached-summary', 'diff', '--cached', '--stat')
    elif action == 'commit':
        assert git('commit-paths', 'diff', '--cached', '--name-only').splitlines() == FILES
        git('commit-whitespace', 'diff', '--cached', '--check')
        git('commit-result', 'commit', '-m', 'test: independently accept ToyVM rename type safety')
    elif action == 'push':
        git('push-result', 'push', 'origin', 'HEAD:refs/heads/' + BRANCH)
        head = git('published-head', 'rev-parse', 'HEAD')
        remote = git('published-remote', 'ls-remote', '--exit-code', 'origin', 'refs/heads/' + BRANCH)
        assert remote.split() == [head, 'refs/heads/' + BRANCH]
        note = dict(outcome='PASS direct-handler contract; 156 cases, nine mutation controls',
                    commit=head, remoteBranch=BRANCH, remoteSHA=head, verified=True,
                    candidate='ee783655f7d8dc7829093943fe73e0091fb440fe',
                    sourcePins=json.loads((REPO / PREFIX / 'canonical.json').read_text())['sourcePins'],
                    canonical=str(REPO / PREFIX / 'canonical.json'),
                    evidence=str(ROOT / 'e'), boardAppendOwner='coordinator (oversized shared board)',
                    remainingGate='Old backend pin in qualify_accounted.py requires separately reviewed pin update and full CLI integration; cycle acceptance owned by separate worker',
                    box=None, productionUnchanged=True)
        (ROOT / 'coordinator-note.json').write_text(json.dumps(note, indent=2) + '\n')
        print(json.dumps({'commit': head, 'remote': BRANCH, 'verified': True,
                          'coordinatorNote': str(ROOT / 'coordinator-note.json')}))
    else:
        raise SystemExit('expected stage, commit or push')
